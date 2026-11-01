"""Explicit A4 grants. Names identify DB roles, never JWT/client claims.

Legacy Admin/Approver/System Owner/Viewer retain the previously open catalog
reads only. They are not aliases for managed administrative/business roles.
"""
from types import MappingProxyType


CATALOG_READ_ROLES = frozenset({"System Administrator", "Requester", "Change Manager", "CMDB Manager",
                               "Admin", "System Owner", "Approver", "Viewer"})
_READ = frozenset({"identity.read", "foundation.read", "notifications.own", "risk_rules.read"})
_EXTRA = {
    "Requester": {"changes.read", "changes.create", "changes.revise"},
    "Change Manager": {"changes.read", "changes.approve", "changes.implement"},
    "CMDB Manager": {"foundation.write", "changes.read", "risk_rules.write"},
    "System Administrator": {"users.read", "users.update", "audit.read", "invitations.manage"},
}
ROLE_PERMISSIONS = MappingProxyType({role: _READ | frozenset(_EXTRA.get(role, ())) for role in CATALOG_READ_ROLES})
ALL_PERMISSIONS = frozenset().union(*ROLE_PERMISSIONS.values())


def permissions_for_role(role_name: str | None) -> frozenset[str]:
    return ROLE_PERMISSIONS.get(role_name, frozenset())


def permissions_for_user(user) -> frozenset[str]:
    # Query helpers take the authenticated DB user for existing service callers;
    # HTTP authentication/membership is still mandatory in Tenant Context.
    if user.role is None or user.organization_id is None or user.role.organization_id != user.organization_id:
        return frozenset()
    return permissions_for_role(user.role.name)
