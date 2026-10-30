"""A3 transitions are serialized per tenant; lifecycle writes and audit are atomic."""
from contextlib import contextmanager
from datetime import timedelta
import hashlib
import secrets

from fastapi import HTTPException
from pydantic import SecretStr
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.email_key import EmailKey
from app.models.foundation import Department, Organization, Role, User
from app.models.invitation import OrganizationInvitation as Invitation
from app.models.tenant_access_event import TenantAccessEvent
from app.schemas.invitation import InvitationAcceptance, InvitationCreate, InvitationOutput, MembershipActivated
from app.services.auth_service import MANAGED_ROLE_NAMES, hash_password
from app.services.invitation_mailer import InvitationMailer, InvitationMessage
from app.services.tenant_context import account_query, context_for_user


@contextmanager
def invitation_transaction(db: Session):
    try:
        yield
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Invitation conflicts with the current membership state.") from None
    except Exception:
        db.rollback()
        raise


def database_now(db: Session):
    return db.scalar(select(func.clock_timestamp()))


def lock_organization(db: Session, organization_id: int):
    if db.get_bind().dialect.name != "postgresql":
        raise HTTPException(503, "Invitations require PostgreSQL.")
    # NO KEY UPDATE serializes A3 operations without blocking FK key-share locks.
    organization = db.query(Organization).filter(Organization.id == organization_id).with_for_update(key_share=True).first()
    if organization is None:
        raise HTTPException(404, "Workspace not found.")
    return organization


def locked_administrator(db: Session, organization_id: int, user_id: int):
    # Keep authority stable against UPDATE/DELETE, without blocking audit FKs.
    user = account_query(db).filter(User.id == user_id, User.organization_id == organization_id).with_for_update(of=User, key_share=True).first()
    context = context_for_user(user)
    if context.role_name != "System Administrator":
        raise HTTPException(403, "You do not have permission to perform this operation.")
    return user


def event(db: Session, invitation: Invitation, action: str, *, actor_id=None, source="system", **metadata):
    # Callers supply named, reviewed fields only; never accept client metadata.
    allowed = {"role_id", "department_id", "purpose", "previous_invitation_id", "delivery_status",
               "operator_id", "authorization_digest", "key_id", "replacement_authorization_id", "deployment_id"}
    if not metadata.keys() <= allowed:
        raise RuntimeError("Unapproved invitation event metadata.")
    db.add(TenantAccessEvent(
        organization_id=invitation.organization_id, actor_id=actor_id,
        invitation_id=invitation.id, target_user_id=invitation.accepted_user_id,
        action=action, source=source,
        bootstrap_authorization_id=invitation.bootstrap_authorization_id if source == "bootstrap" else None,
        event_metadata=metadata,
    ))


def output(db: Session, invitation: Invitation, now=None) -> InvitationOutput:
    status = invitation.status
    if status == "pending" and invitation.expires_at <= (now or database_now(db)):
        status = "expired"
    return InvitationOutput(
        id=invitation.id, organization_id=invitation.organization_id, email=invitation.email,
        role_id=invitation.role_id, department_id=invitation.department_id,
        purpose=invitation.purpose, target_user_id=invitation.target_user_id, status=status,
        created_at=invitation.created_at, expires_at=invitation.expires_at,
        delivery_status=invitation.delivery_status, delivery_attempts=invitation.delivery_attempts,
        last_delivery_at=invitation.last_delivery_at,
    )


def validate_assignment(db, organization_id, role_id, department_id):
    # SHARE prevents role/department mutation, but permits FK KEY SHARE checks
    # from A2's user updates. UPDATE here creates a role -> user -> role cycle.
    role = db.query(Role).filter(Role.id == role_id, Role.organization_id == organization_id).with_for_update(read=True).first()
    if role is None:
        raise HTTPException(404, "Tenant role not found.")
    if role.name not in MANAGED_ROLE_NAMES:
        raise HTTPException(400, "Unsupported invitation role.")
    if department_id is not None:
        department = db.query(Department).filter(Department.id == department_id, Department.organization_id == organization_id).with_for_update(read=True).first()
        if department is None:
            raise HTTPException(404, "Tenant department not found.")
    return role


def validate_identity(db, organization_id, email, purpose, target_user_id):
    existing = db.query(User).filter(User.organization_id == organization_id, EmailKey(User.email) == EmailKey(email)).with_for_update().first()
    if purpose == "directory_activation":
        if existing is None or existing.id != target_user_id or existing.password_hash is not None:
            raise HTTPException(409, "Invitation conflicts with the current membership state.")
        if existing.membership_confirmed_at is not None or existing.email_verified_at is not None:
            raise HTTPException(409, "Invitation conflicts with the current membership state.")
    elif existing is not None:
        raise HTTPException(409, "Invitation conflicts with the current membership state.")
    return existing


def expire_pending_email(db, organization_id, email, now):
    pending = db.query(Invitation).filter(
        Invitation.organization_id == organization_id, Invitation.status == "pending",
        EmailKey(Invitation.email) == EmailKey(email),
    ).with_for_update().first()
    if pending is not None:
        if pending.expires_at > now:
            raise HTTPException(409, "A pending invitation already exists.")
        pending.status = "expired"
        event(db, pending, "INVITATION_EXPIRED")
        db.flush()


def persist_invitation(db, organization, email, role_id, department_id, purpose, *, actor_id=None,
                       target_user_id=None, bootstrap_authorization_id=None, expires_at=None):
    now = database_now(db)
    token = secrets.token_urlsafe(32)
    invitation = Invitation(
        organization_id=organization.id, email=email, role_id=role_id, department_id=department_id,
        purpose=purpose, invited_by=actor_id, target_user_id=target_user_id,
        bootstrap_authorization_id=bootstrap_authorization_id,
        token_hash=hashlib.sha256(token.encode("ascii")).hexdigest(), status="pending",
        created_at=now, expires_at=expires_at or now + timedelta(hours=24),
        delivery_status="pending", delivery_attempts=1, last_delivery_at=now,
    )
    db.add(invitation)
    db.flush()
    return invitation, InvitationMessage(invitation.id, email, organization.slug,
                                          invitation.expires_at, SecretStr(token))


def deliver(db: Session, invitation_id: int, message: InvitationMessage, mailer: InvitationMailer):
    try:
        mailer.send_invitation(message)
        state = "sent"
    except Exception:
        # Do not log/serialize the exception: providers may include the raw token.
        state = "failed"
    with invitation_transaction(db):
        changed = db.execute(update(Invitation).where(
            Invitation.id == invitation_id, Invitation.delivery_status == "pending",
        ).values(delivery_status=state).returning(Invitation.id)).scalar_one_or_none()
        if changed is not None:
            invitation = db.get(Invitation, invitation_id, populate_existing=True)
            event(db, invitation, "INVITATION_DELIVERY_" + state.upper(), delivery_status=state)
    return output(db, db.get(Invitation, invitation_id, populate_existing=True))


def create_invitation(db: Session, organization_id: int, actor_id: int,
                      payload: InvitationCreate, mailer: InvitationMailer):
    with invitation_transaction(db):
        organization = lock_organization(db, organization_id)
        locked_administrator(db, organization_id, actor_id)
        role = validate_assignment(db, organization_id, payload.role_id, payload.department_id)
        email = db.scalar(select(EmailKey(payload.email)))
        validate_identity(db, organization_id, email, payload.purpose, payload.target_user_id)
        expire_pending_email(db, organization_id, email, database_now(db))
        expiry = database_now(db) + timedelta(hours=1 if role.name == "System Administrator" else 24)
        invitation, message = persist_invitation(
            db, organization, email, role.id, payload.department_id, payload.purpose,
            actor_id=actor_id, target_user_id=payload.target_user_id, expires_at=expiry,
        )
        event(db, invitation, "INVITATION_CREATED", actor_id=actor_id, source="administrator",
              role_id=role.id, department_id=payload.department_id, purpose=payload.purpose)
        invitation_id = invitation.id
    return deliver(db, invitation_id, message, mailer)


def list_invitations(db: Session, organization_id: int, limit: int, offset: int):
    now = database_now(db)
    invitations = db.query(Invitation).filter(Invitation.organization_id == organization_id).order_by(
        Invitation.created_at.desc(), Invitation.id.desc(),
    ).offset(offset).limit(limit).all()
    return [output(db, invitation, now) for invitation in invitations]


def lock_managed_invitation(db, organization_id, invitation_id):
    invitation = db.query(Invitation).filter(
        Invitation.organization_id == organization_id, Invitation.id == invitation_id,
        Invitation.purpose != "bootstrap",
    ).populate_existing().with_for_update().first()
    if invitation is None:
        raise HTTPException(404, "Invitation not found.")
    return invitation


def revoke_invitation(db: Session, organization_id: int, actor_id: int, invitation_id: int):
    with invitation_transaction(db):
        lock_organization(db, organization_id)
        locked_administrator(db, organization_id, actor_id)
        invitation = lock_managed_invitation(db, organization_id, invitation_id)
        if invitation.status != "pending":
            raise HTTPException(409, "Invitation is no longer pending.")
        invitation.status = "revoked"
        invitation.revoked_at = database_now(db)
        event(db, invitation, "INVITATION_REVOKED", actor_id=actor_id, source="administrator")
    return output(db, invitation)


def resend_invitation(db: Session, organization_id: int, actor_id: int,
                      invitation_id: int, mailer: InvitationMailer):
    with invitation_transaction(db):
        organization = lock_organization(db, organization_id)
        locked_administrator(db, organization_id, actor_id)
        old = lock_managed_invitation(db, organization_id, invitation_id)
        if old.status not in {"pending", "expired"}:
            raise HTTPException(409, "Invitation cannot be resent.")
        role = validate_assignment(db, organization_id, old.role_id, old.department_id)
        validate_identity(db, organization_id, old.email, old.purpose, old.target_user_id)
        now = database_now(db)
        if old.status == "pending":
            if old.expires_at <= now:
                old.status = "expired"
                action = "INVITATION_EXPIRED"
            else:
                old.status, old.revoked_at = "revoked", now
                action = "INVITATION_REVOKED"
            event(db, old, action, actor_id=actor_id, source="administrator")
            db.flush()  # release A1's pending-email index before inserting replacement
        expire_pending_email(db, organization_id, old.email, now)
        invitation, message = persist_invitation(
            db, organization, old.email, old.role_id, old.department_id, old.purpose,
            actor_id=actor_id, target_user_id=old.target_user_id,
            expires_at=now + timedelta(hours=1 if role.name == "System Administrator" else 24),
        )
        event(db, invitation, "INVITATION_RESENT", actor_id=actor_id, source="administrator",
              previous_invitation_id=old.id, role_id=old.role_id, department_id=old.department_id,
              purpose=old.purpose)
        new_id = invitation.id
    return deliver(db, new_id, message, mailer)


def unavailable_invitation():
    return HTTPException(400, "Invitation is invalid or unavailable.")


def require_first_administrator(db, organization_id):
    # This is first provisioning, not an implicit recovery mechanism. Even an
    # inactive existing administrator requires a separately authorized recovery.
    existing = db.query(User.id).join(Role, User.role_id == Role.id).filter(
        User.organization_id == organization_id, Role.organization_id == organization_id,
        Role.name == "System Administrator",
    ).first()
    completed = db.query(Invitation.id).filter(
        Invitation.organization_id == organization_id, Invitation.purpose == "bootstrap",
        Invitation.status == "accepted",
    ).first()
    if existing is not None or completed is not None:
        raise HTTPException(409, "Bootstrap cannot provision this workspace; recovery is a separate operation.")


def create_bootstrap_invitation(db: Session, grant, mailer: InvitationMailer):
    # Only the operational CLI supplies a verified BootstrapGrant. No HTTP
    # endpoint accepts approval references or constructs grants from a request.
    with invitation_transaction(db):
        organization = lock_organization(db, grant.organization_id)
        now = database_now(db)
        if grant.expires_at <= now:
            raise HTTPException(403, "Bootstrap authorization has expired.")
        require_first_administrator(db, organization.id)
        role = validate_assignment(db, organization.id, grant.role_id, grant.department_id)
        if role.name != "System Administrator":
            raise HTTPException(403, "Bootstrap requires a tenant administrator role.")
        used = db.query(Invitation.id).filter(
            Invitation.organization_id == organization.id,
            Invitation.bootstrap_authorization_id == grant.authorization_id,
        ).first()
        if used is not None:
            raise HTTPException(409, "Bootstrap authorization was already used.")
        email = db.scalar(select(EmailKey(grant.email)))
        validate_identity(db, organization.id, email, "bootstrap", None)
        old = db.query(Invitation).filter(
            Invitation.organization_id == organization.id, Invitation.purpose == "bootstrap",
            Invitation.status == "pending",
        ).with_for_update().first()
        if old is not None:
            if old.expires_at <= now:
                old.status = "expired"
            else:
                old.status, old.revoked_at = "revoked", now
            event(db, old, "BOOTSTRAP_INVITATION_SUPERSEDED", source="bootstrap",
                  operator_id=grant.operator_id, replacement_authorization_id=grant.authorization_id)
            db.flush()
        expire_pending_email(db, organization.id, email, now)
        invitation, message = persist_invitation(
            db, organization, email, role.id, grant.department_id, "bootstrap",
            bootstrap_authorization_id=grant.authorization_id,
            expires_at=min(grant.expires_at, now + timedelta(hours=1)),
        )
        event(db, invitation, "BOOTSTRAP_INVITATION_CREATED", source="bootstrap",
              operator_id=grant.operator_id, authorization_digest=grant.authorization_digest,
              key_id=grant.key_id, deployment_id=grant.deployment_id,
              role_id=role.id, department_id=grant.department_id, purpose="bootstrap")
        invitation_id = invitation.id
    return deliver(db, invitation_id, message, mailer)


def validate_bootstrap_acceptance(db, invitation):
    require_first_administrator(db, invitation.organization_id)
    evidence = db.query(TenantAccessEvent).filter(
        TenantAccessEvent.invitation_id == invitation.id,
        TenantAccessEvent.organization_id == invitation.organization_id,
        TenantAccessEvent.action == "BOOTSTRAP_INVITATION_CREATED",
        TenantAccessEvent.source == "bootstrap",
        TenantAccessEvent.bootstrap_authorization_id == invitation.bootstrap_authorization_id,
    ).first()
    role = validate_assignment(db, invitation.organization_id, invitation.role_id, invitation.department_id)
    if (evidence is None or role.name != "System Administrator"
            or evidence.event_metadata.get("role_id") != invitation.role_id
            or evidence.event_metadata.get("department_id") != invitation.department_id):
        raise unavailable_invitation()


def accept_invitation(db: Session, payload: InvitationAcceptance):
    digest = hashlib.sha256(payload.token.get_secret_value().encode("ascii")).hexdigest()
    try:
        with invitation_transaction(db):
            found = db.query(Invitation.id, Invitation.organization_id).filter(Invitation.token_hash == digest).first()
            if found is None:
                raise unavailable_invitation()
            lock_organization(db, found.organization_id)
            invitation = db.query(Invitation).filter(
                Invitation.id == found.id, Invitation.token_hash == digest,
            ).populate_existing().with_for_update().first()
            if (invitation is None or invitation.status != "pending"
                    or invitation.expires_at <= database_now(db)):
                raise unavailable_invitation()
            if invitation.purpose == "bootstrap":
                validate_bootstrap_acceptance(db, invitation)
            else:
                locked_administrator(db, invitation.organization_id, invitation.invited_by)
            validate_assignment(db, invitation.organization_id, invitation.role_id, invitation.department_id)
            target = validate_identity(db, invitation.organization_id, invitation.email,
                                       invitation.purpose, invitation.target_user_id)
            if target is None:
                if payload.full_name is None:
                    raise unavailable_invitation()
                target = User(organization_id=invitation.organization_id, email=invitation.email,
                              full_name=payload.full_name, role_id=invitation.role_id,
                              membership_source="invitation", is_active="inactive")
                db.add(target)
            password_hash = hash_password(payload.password.get_secret_value())
            now = database_now(db)  # sample after waiting for locks and computing bcrypt
            if now >= invitation.expires_at:
                raise unavailable_invitation()
            target.role_id, target.department_id = invitation.role_id, invitation.department_id
            target.password_hash = password_hash
            target.membership_source = "bootstrap" if invitation.purpose == "bootstrap" else "invitation"
            target.membership_confirmed_at = target.email_verified_at = now
            target.is_active = "active"
            db.flush()
            # Do not let a token that expires while hashing become consumed.
            changed = db.execute(update(Invitation).where(
                Invitation.id == invitation.id, Invitation.token_hash == digest,
                Invitation.status == "pending", Invitation.expires_at > func.clock_timestamp(),
            ).values(status="accepted", consumed_at=now, accepted_user_id=target.id)
              .returning(Invitation.id)).scalar_one_or_none()
            if changed is None:
                raise unavailable_invitation()
            invitation.accepted_user_id = target.id
            event(db, invitation, "MEMBERSHIP_ACTIVATED",
                  source="bootstrap" if invitation.purpose == "bootstrap" else "system", role_id=invitation.role_id,
                  department_id=invitation.department_id, purpose=invitation.purpose)
            result = MembershipActivated(user_id=target.id, organization_id=target.organization_id)
        return result
    except HTTPException:
        # Neither membership state nor invitation authority is disclosed publicly.
        raise unavailable_invitation() from None
