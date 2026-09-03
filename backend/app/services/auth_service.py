from datetime import (
    datetime,
    timedelta,
    timezone,
)

import bcrypt
from fastapi import (
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.foundation import User
from app.settings import settings


oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login"
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
        "email": user.email,
        "role": (
            user.role.name
            if user.role
            else None
        ),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    authentication_error = HTTPException(
        status_code=(
            status.HTTP_401_UNAUTHORIZED
        ),
        detail=(
            "Invalid or expired "
            "authentication token."
        ),
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[
                settings.jwt_algorithm
            ],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise authentication_error

        user_id = int(user_id)

    except (JWTError, ValueError):
        raise authentication_error

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        raise authentication_error

    if user.is_active != "active":
        raise HTTPException(
            status_code=(
                status.HTTP_403_FORBIDDEN
            ),
            detail=(
                "This user account is inactive."
            ),
        )

    return user


def require_roles(*allowed_roles: str):
    def role_checker(
        current_user: User = Depends(
            get_current_user
        ),
    ) -> User:
        current_role = (
            current_user.role.name
            if current_user.role
            else None
        )

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

        return current_user

    return role_checker
