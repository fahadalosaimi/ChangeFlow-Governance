"""Permission dependencies share A2's current-DB tenant boundary."""
from fastapi import Depends, HTTPException

from app.services.permissions import ALL_PERMISSIONS, permissions_for_user
from app.services.tenant_context import TenantContext, get_tenant_context


def require_permissions(*required: str):
    needed = frozenset(required)
    if not needed or not needed <= ALL_PERMISSIONS:
        raise ValueError("Unknown or empty permission requirement.")

    def permission_checker(context: TenantContext = Depends(get_tenant_context)):
        if not needed <= context.permissions:
            raise HTTPException(403, "You do not have permission to perform this operation.")
        return context.user

    return permission_checker


def ensure_permission(user, permission: str) -> None:
    if permission not in permissions_for_user(user):
        raise HTTPException(403, "You do not have permission to perform this operation.")
