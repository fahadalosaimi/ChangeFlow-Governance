from datetime import (
    datetime,
    timedelta,
    timezone,
)

import bcrypt
import re
from fastapi import (
    Depends,
    HTTPException,
    status,
)
from jose import jwt

from app.models.email_key import EmailKey
from app.models.foundation import Organization
from app.models.foundation import User
from sqlalchemy.orm import Session
from app.services.tenant_context import (
    TenantContext, account_query, authentication_error, context_for_user,
    get_tenant_context, oauth2_scheme,
)
from app.settings import settings


# New hashes and the minimum login work budget use cost 12. Higher-cost legacy
# hashes remain supported and are never rewritten or downgraded during login.
_BCRYPT_TARGET_COST = 12
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(
    bcrypt.gensalt(), bcrypt.gensalt(rounds=_BCRYPT_TARGET_COST),
).decode("ascii")
# A bcrypt salt is 22 characters; its last character encodes only two bits.
# Reject invalid salts before checkpw, which otherwise fails without doing work.
_BCRYPT_HASH = re.compile(
    r"\$2[aby]\$(?P<cost>0[4-9]|[12][0-9]|3[01])\$"
    r"[./A-Za-z0-9]{21}[.Oeu][./A-Za-z0-9]{31}"
)


def hash_password(password: str) -> str:
    if not password:
        raise ValueError(
            "Password cannot be empty."
        )

    password_bytes = password.encode("utf-8")

    return bcrypt.hashpw(
        password_bytes,
        bcrypt.gensalt(),
    ).decode("utf-8")


def verify_password(
    plain_password: str,
    password_hash: str,
) -> bool:
    if not plain_password or not password_hash:
        return False

    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def _verify_login_password(password: str, password_hash: str | None) -> bool:
    """Pad low-cost legacy checks to approximately cost-12 bcrypt work.

    This equalizes nominal exponential work, not wall-clock response time.
    High-cost legacy hashes, per-call overhead, database access and system load
    still produce timing differences. Padding never changes a stored hash.
    """
    match = _BCRYPT_HASH.fullmatch(password_hash) if password_hash else None
    cost = int(match["cost"]) if match else _BCRYPT_TARGET_COST
    verified = verify_password(password, password_hash if match else _DUMMY_PASSWORD_HASH)
    # A check at cost c plus padding checks at c, c+1, ..., 11 has nominal work
    # 2**c + sum(2**k for k in range(c, 12)) == 2**12. Cost >= 12 needs no padding.
    for padding_cost in range(cost, _BCRYPT_TARGET_COST):
        padding_hash = _DUMMY_PASSWORD_HASH[:4] + f"{padding_cost:02d}" + _DUMMY_PASSWORD_HASH[6:]
        verify_password("login-timing-padding", padding_hash)
    return match is not None and verified


def create_access_token(
    user: User,
) -> str:
    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=(
                settings
                .access_token_expire_minutes
            )
        )
    )

    payload = {
        "sub": str(user.id),
        "tid": user.organization_id,
        "ver": 2,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def authenticate_user(
    db: Session, tenant_slug: str, email: str, password: str,
) -> User:
    # Both operands use A1's DB collation and ASCII-space trimming policy.
    # Do not use Python lower/casefold/strip() for the email key.
    identifiers_valid = bool(email.strip(" ")) and "\x00" not in tenant_slug and "\x00" not in email
    user = account_query(db).join(Organization, User.organization_id == Organization.id).filter(
        Organization.slug == (tenant_slug if identifiers_valid else ""),
        EmailKey(User.email) == EmailKey(email if identifiers_valid else ""),
    ).first()
    stored_hash = user.password_hash if user else None
    password_bytes = password.encode("utf-8")
    usable_password = 0 < len(password_bytes) <= 72
    password_matches = _verify_login_password(
        password if usable_password else "invalid-password-padding",
        stored_hash,
    )
    if not (identifiers_valid and usable_password and password_matches):
        raise authentication_error()
    context_for_user(user)
    return user


def get_current_user(
    context: TenantContext = Depends(get_tenant_context),
) -> User:
    return context.user


# Compatibility name: both dependencies enforce the complete A2 boundary.
get_current_active_user = get_current_user


def require_roles(*allowed_roles: str):
    def role_checker(
        context: TenantContext = Depends(get_tenant_context),
    ) -> User:
        current_role = context.role_name

        if current_role not in allowed_roles:
            raise HTTPException(
                status_code=(
                    status.HTTP_403_FORBIDDEN
                ),
                detail=(
                    "You do not have permission "
                    "to perform this operation."
                ),
            )

        return context.user

    return role_checker
