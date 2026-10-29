"""Database-backed authentication boundary shared by all protected routes."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
import math
import re

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.foundation import User
from app.settings import settings


# Handle missing/invalid bearer credentials through the same error path as JWTs.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)
AUTHENTICATION_FAILURE = "Invalid authentication credentials."


def authentication_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=AUTHENTICATION_FAILURE,
        headers={"WWW-Authenticate": "Bearer"},
    )


@dataclass(frozen=True)
class TenantContext:
    user_id: int
    organization_id: int
    role_id: int
    role_name: str
    user: User = field(repr=False, compare=False)
    # A2 preserves existing role gates. No granular permissions have been
    # approved yet (A4); neither JWT claims nor role descriptions grant any.
    permissions: frozenset[str] = field(default_factory=frozenset)


def membership_is_ready(user: User) -> bool:
    if user.membership_source == "legacy":
        # Migration deliberately did not invent verification timestamps.
        return True
    return (
        user.membership_source in {"invitation", "bootstrap"}
        and user.membership_confirmed_at is not None
        and user.email_verified_at is not None
        and bool(user.password_hash)
    )


def context_for_user(user: User | None) -> TenantContext:
    """Validate the actual account, also before issuing a login token."""
    if (
        user is None
        or user.organization_id is None
        or user.organization is None
        or user.is_active != "active"
        or not user.password_hash
        or not membership_is_ready(user)
        or user.role is None
        or user.role.organization_id != user.organization_id
        or (
            user.department_id is not None
            and (
                user.department is None
                or user.department.organization_id != user.organization_id
            )
        )
    ):
        raise authentication_error()
    return TenantContext(
        user_id=user.id,
        organization_id=user.organization_id,
        role_id=user.role.id,
        role_name=user.role.name,
        user=user,
    )


def account_query(db: Session):
    # Refresh even when a caller has already loaded an identity in this Session.
    return db.query(User).options(
        joinedload(User.organization), joinedload(User.role), joinedload(User.department),
    ).populate_existing()


def get_tenant_context(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> TenantContext:
    if not token:
        raise authentication_error()
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm],
            options={"require_sub": True, "require_exp": True},
        )
        user_id, tenant_id = payload.get("sub"), payload.get("tid")
        if (
            type(payload.get("ver")) is not int or payload["ver"] != 2
            or not isinstance(user_id, str)
            or re.fullmatch(r"[1-9][0-9]{0,9}", user_id) is None
            or int(user_id) > 2147483647
            or type(tenant_id) is not int or not 0 < tenant_id <= 2147483647
            or type(payload.get("exp")) not in (int, float)
            or not math.isfinite(payload["exp"])
            or payload["exp"] <= datetime.now(timezone.utc).timestamp()
        ):
            raise authentication_error()
    except (JWTError, ValueError, TypeError, OverflowError):
        raise authentication_error() from None

    user = account_query(db).filter(
        User.id == int(user_id), User.organization_id == tenant_id,
    ).first()
    return context_for_user(user)
