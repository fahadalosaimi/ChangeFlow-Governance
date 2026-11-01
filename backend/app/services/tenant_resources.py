"""SQL scopes for A4 resources, including both ends of nested references.

Inconsistent legacy relationships are quarantined from reads/counts/mutations;
this service never rewrites or deletes them. Resource helpers accept the trusted
DB user already authenticated by the HTTP permission dependency.
"""
from sqlalchemy import and_, exists, false, or_, select

from app.models.foundation import Department, ITService, ITSystem, Incident, Role, SystemDependency, User
from app.models.change_management import (
    ManagedChangeRequest, ManagedChangeAffectedSystem, ChangeApproval, ChangeStatusHistory, AuditLog,
)
from app.models.change_execution import ChangeImplementation
from app.models.notification import Notification
from app.services.authorization import ensure_permission
from app.services.permissions import permissions_for_user


# Explicit content classification, set by trusted producers, never a client flag.
# Current producers emit only CHANGE_* events. GENERAL is reserved for notices
# with no protected resource content; unknown unlinked legacy events fail closed.
GENERAL_NOTIFICATION_TYPES = frozenset({"GENERAL"})


def local_user_ids(organization_id):
    return select(User.id).where(User.organization_id == organization_id).correlate(None)


def service_condition(organization_id):
    return and_(ITService.organization_id == organization_id,
        or_(ITService.department_id.is_(None), ITService.department.has(Department.organization_id == organization_id)))


def system_condition(organization_id):
    return and_(ITSystem.organization_id == organization_id,
        or_(ITSystem.department_id.is_(None), ITSystem.department.has(Department.organization_id == organization_id)),
        or_(ITSystem.service_id.is_(None), ITSystem.service.has(service_condition(organization_id))),
        or_(ITSystem.owner_id.is_(None), ITSystem.owner.has(User.organization_id == organization_id)))


def local_system_ids(organization_id):
    return select(ITSystem.id).where(system_condition(organization_id)).correlate(None)


def tenant_systems(db, organization_id):
    return db.query(ITSystem).filter(system_condition(organization_id))


def tenant_services(db, organization_id):
    return db.query(ITService).filter(service_condition(organization_id))


def tenant_users(db, organization_id):
    return db.query(User).filter(User.organization_id == organization_id,
        User.role.has(Role.organization_id == organization_id),
        or_(User.department_id.is_(None), User.department.has(Department.organization_id == organization_id)))


def dependency_condition(organization_id):
    ids = local_system_ids(organization_id)
    return and_(SystemDependency.source_system_id.in_(ids), SystemDependency.target_system_id.in_(ids))


def tenant_dependencies(db, organization_id):
    return db.query(SystemDependency).filter(dependency_condition(organization_id))


def tenant_incidents(db, organization_id):
    return db.query(Incident).filter(Incident.system_id.in_(local_system_ids(organization_id)))


def foreign_user(reference, organization_id):
    return and_(reference.is_not(None), reference.not_in(local_user_ids(organization_id)))


def change_condition(organization_id):
    bad_implementation = exists().where(
        ChangeImplementation.change_request_id == ManagedChangeRequest.id,
        foreign_user(ChangeImplementation.coordinator_id, organization_id)).correlate(ManagedChangeRequest)
    return and_(ManagedChangeRequest.organization_id == organization_id,
        or_(ManagedChangeRequest.requester_id.is_(None), ManagedChangeRequest.requester.has(User.organization_id == organization_id)),
        ~ManagedChangeRequest.affected_systems.any(ManagedChangeAffectedSystem.system_id.not_in(local_system_ids(organization_id))),
        ~ManagedChangeRequest.status_history.any(foreign_user(ChangeStatusHistory.changed_by, organization_id)),
        ~ManagedChangeRequest.audit_logs.any(foreign_user(AuditLog.actor_id, organization_id)),
        ~ManagedChangeRequest.approvals.any(foreign_user(ChangeApproval.approver_id, organization_id)),
        ~bad_implementation)


def readable_change_condition(user):
    """The same current-role resource boundary for changes and derived content."""
    if "changes.read" not in permissions_for_user(user):
        return false()
    condition = change_condition(user.organization_id)
    if user.role.name == "Requester":
        condition = and_(condition, ManagedChangeRequest.requester_id == user.id)
    return condition


def scope_changes(query, user):
    ensure_permission(user, "changes.read")
    return query.filter(readable_change_condition(user))


def tenant_notifications(db, user):
    changes = select(ManagedChangeRequest.id).where(readable_change_condition(user)).correlate(None)
    # Apply before search/count/pagination AND read-state updates. Keeping the
    # original rows permits access to return if the resource grant is restored.
    general_notice = and_(Notification.change_request_id.is_(None),
        Notification.notification_type.in_(GENERAL_NOTIFICATION_TYPES))
    return db.query(Notification).filter(Notification.organization_id == user.organization_id,
        Notification.recipient_id == user.id,
        or_(Notification.actor_id.is_(None), Notification.actor_id.in_(local_user_ids(user.organization_id))),
        or_(general_notice, Notification.change_request_id.in_(changes)))
