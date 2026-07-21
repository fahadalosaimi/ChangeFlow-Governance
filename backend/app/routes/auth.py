from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.foundation import User
from app.schemas.auth import (
    CurrentUserOutput,
    TokenOutput,
)
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    verify_password,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=TokenOutput,
)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    email = form_data.username.strip().lower()

    user = (
        db.query(User)
        .filter(func.lower(User.email) == email)
        .first()
    )

    if (
        not user
        or not user.password_hash
        or not verify_password(
            form_data.password,
            user.password_hash,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.is_active != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account is inactive.",
        )

    access_token = create_access_token(user)

    return TokenOutput(
        access_token=access_token,
        token_type="bearer",
    )


@router.get(
    "/me",
    response_model=CurrentUserOutput,
)
def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return CurrentUserOutput(
        id=current_user.id,
        organization_id=current_user.organization_id,
        department_id=current_user.department_id,
        full_name=current_user.full_name,
        email=current_user.email,
        job_title=current_user.job_title,
        role_name=(
            current_user.role.name
            if current_user.role
            else "Unknown"
        ),
        department_name=(
            current_user.department.name
            if current_user.department
            else None
        ),
    )