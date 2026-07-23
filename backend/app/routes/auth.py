from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.foundation import (
    Organization,
    Role,
    User,
)
from app.schemas.auth import (
    AdminUserOutput,
    AdminUserUpdate,
    CurrentUserOutput,
    RoleOptionOutput,
    TokenOutput,
    UserRegistrationInput,
)
from app.services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


MANAGED_ROLE_NAMES = {
    "Requester",
    "Change Manager",
    "CMDB Manager",
    "System Administrator",
}


def build_current_user_output(
    user: User,
) -> CurrentUserOutput:
    return CurrentUserOutput(
        id=user.id,
        organization_id=user.organization_id,
        department_id=user.department_id,
        full_name=user.full_name,
        email=user.email,
        job_title=user.job_title,
        role_name=(
            user.role.name
            if user.role
            else "Unknown"
        ),
        department_name=(
            user.department.name
            if user.department
            else None
        ),
    )


def build_admin_user_output(
    user: User,
) -> AdminUserOutput:
    return AdminUserOutput(
        id=user.id,
        organization_id=user.organization_id,
        department_id=user.department_id,
        full_name=user.full_name,
        email=user.email,
        job_title=user.job_title,
        role_name=(
            user.role.name
            if user.role
            else "Unknown"
        ),
        department_name=(
            user.department.name
            if user.department
            else None
        ),
        is_active=user.is_active,
        created_at=user.created_at,
    )


def count_active_system_administrators(
    db: Session,
) -> int:
    return (
        db.query(User)
        .join(
            Role,
            User.role_id == Role.id,
        )
        .filter(
            Role.name == "System Administrator",
            User.is_active == "active",
        )
        .count()
    )


@router.post(
    "/register",
    response_model=CurrentUserOutput,
    status_code=status.HTTP_201_CREATED,
)
def register_requester(
    payload: UserRegistrationInput,
    db: Session = Depends(get_db),
):
    full_name = payload.full_name.strip()
    email = payload.email.strip().lower()

    if not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required.",
        )

    email_domain = (
        email.rsplit("@", 1)[-1]
        if "@" in email
        else ""
    )

    if (
        "@" not in email
        or "." not in email_domain
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid email address.",
        )

    existing_user = (
        db.query(User)
        .filter(
            func.lower(User.email) == email
        )
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An account with this email "
                "already exists."
            ),
        )

    organization = (
        db.query(Organization)
        .order_by(Organization.id.asc())
        .first()
    )

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No organization is configured "
                "for account registration."
            ),
        )

    requester_role = (
        db.query(Role)
        .filter(Role.name == "Requester")
        .first()
    )

    if not requester_role:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The Requester role is not configured.",
        )

    user = User(
        organization_id=organization.id,
        department_id=None,
        role_id=requester_role.id,
        full_name=full_name,
        email=email,
        password_hash=hash_password(
            payload.password
        ),
        job_title=(
            payload.job_title.strip()
            if (
                payload.job_title
                and payload.job_title.strip()
            )
            else "Change Requester"
        ),
        is_active="active",
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return build_current_user_output(user)


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
        .filter(
            func.lower(User.email) == email
        )
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
            headers={
                "WWW-Authenticate": "Bearer"
            },
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
    current_user: User = Depends(
        get_current_user
    ),
):
    return build_current_user_output(
        current_user
    )


@router.get(
    "/admin/roles",
    response_model=list[RoleOptionOutput],
)
def get_managed_roles(
    current_user: User = Depends(
        require_roles("System Administrator")
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(Role)
        .filter(
            Role.name.in_(MANAGED_ROLE_NAMES)
        )
        .order_by(Role.name.asc())
        .all()
    )


@router.get(
    "/admin/users",
    response_model=list[AdminUserOutput],
)
def get_managed_users(
    current_user: User = Depends(
        require_roles("System Administrator")
    ),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .order_by(
            User.full_name.asc()
        )
        .all()
    )

    return [
        build_admin_user_output(user)
        for user in users
    ]


@router.patch(
    "/admin/users/{user_id}",
    response_model=AdminUserOutput,
)
def update_managed_user(
    user_id: int,
    payload: AdminUserUpdate,
    current_user: User = Depends(
        require_roles("System Administrator")
    ),
    db: Session = Depends(get_db),
):
    target_user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )

    update_data = payload.model_dump(
        exclude_unset=True
    )

    requested_role_name = update_data.get(
        "role_name"
    )
    requested_status = update_data.get(
        "is_active"
    )

    if requested_role_name is not None:
        requested_role_name = (
            requested_role_name.strip()
        )

        if requested_role_name not in MANAGED_ROLE_NAMES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported user role.",
            )

    if target_user.id == current_user.id:
        if requested_status == "inactive":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "You cannot deactivate "
                    "your own account."
                ),
            )

        if (
            requested_role_name is not None
            and requested_role_name
            != "System Administrator"
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "You cannot remove your own "
                    "System Administrator role."
                ),
            )

    target_is_active_system_admin = (
        target_user.role is not None
        and target_user.role.name
        == "System Administrator"
        and target_user.is_active == "active"
    )

    removes_system_admin_access = (
        (
            requested_role_name is not None
            and requested_role_name
            != "System Administrator"
        )
        or requested_status == "inactive"
    )

    if (
        target_is_active_system_admin
        and removes_system_admin_access
        and count_active_system_administrators(db)
        <= 1
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "The last active System Administrator "
                "cannot be deactivated or assigned "
                "another role."
            ),
        )

    if requested_role_name is not None:
        new_role = (
            db.query(Role)
            .filter(
                Role.name == requested_role_name
            )
            .first()
        )

        if not new_role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Requested role was not found.",
            )

        target_user.role = new_role

    if requested_status is not None:
        target_user.is_active = requested_status

    db.commit()
    db.refresh(target_user)

    return build_admin_user_output(
        target_user
    )