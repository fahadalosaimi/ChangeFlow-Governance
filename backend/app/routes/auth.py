from app.services.authorization import require_permissions
from app.services.permissions import permissions_for_user
from app.services.tenant_resources import local_user_ids
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Query,
    Form,
)

from sqlalchemy import func
from sqlalchemy.orm import Session,aliased
from sqlalchemy import or_
from app.database import get_db
from app.models.foundation import (
    Department,
    Role,
    User,
    UserAdministrationAudit,
)
from app.schemas.auth import (
    AdminUserOutput,
    AdminUserPageOutput,
    AdminUserUpdate,
    CurrentUserOutput,
    RoleOptionOutput,
    TokenOutput,
    UserAdministrationAuditOutput,
    UserAdministrationAuditPageOutput,
)
from app.services.auth_service import (
    MANAGED_ROLE_NAMES,
    create_access_token,
    authenticate_user,
)


from app.services.tenant_context import membership_is_ready


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


def build_current_user_output(
    user: User,
) -> CurrentUserOutput:
    return CurrentUserOutput(
        permissions=sorted(permissions_for_user(user)),
        workspace_slug=user.organization.slug,
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


def build_user_admin_audit_output(
    db: Session,
    audit: UserAdministrationAudit,
    organization_id: int,
) -> UserAdministrationAuditOutput:
    actor = (
        db.query(User)
        .filter(User.id == audit.actor_id, User.organization_id == organization_id)
        .first()
    )

    target_user = (
        db.query(User)
        .filter(User.id == audit.target_user_id, User.organization_id == organization_id)
        .first()
    )

    return UserAdministrationAuditOutput(
        id=audit.id,
        action=audit.action,

        actor_id=audit.actor_id,
        actor_name=(
            actor.full_name
            if actor
            else f"User #{audit.actor_id}"
        ),

        target_user_id=audit.target_user_id,
        target_user_name=(
            target_user.full_name
            if target_user
            else f"User #{audit.target_user_id}"
        ),
        target_user_email=(
            target_user.email
            if target_user
            else "Unknown"
        ),

        old_role=audit.old_role,
        new_role=audit.new_role,

        old_status=audit.old_status,
        new_status=audit.new_status,

        details=audit.details,
        created_at=audit.created_at,
    )


def count_active_system_administrators(
    db: Session,
    organization_id: int,
) -> int:
    return (
        db.query(User)
        .join(
            Role,
            User.role_id == Role.id,
        )
        .filter(
            User.organization_id
            == organization_id,
            Role.organization_id == organization_id,
            Role.name
            == "System Administrator",
            User.is_active == "active",
        )
        .count()
    )


@router.post("/register", deprecated=True)
def register_requester():
    # The old first-organization/global-role path cannot create A2 memberships.
    # Provisioning is deliberately deferred to the authorized A3 workflows.
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Public registration is disabled.",
    )


@router.post("/login", response_model=TokenOutput)
def login(
    tenant_slug: str = Form(default=""),
    email: str = Form(default=""),
    password: str = Form(default=""),
    db: Session = Depends(get_db),
):
    # Empty/missing credentials follow the same generic 401 path.
    user = authenticate_user(db, tenant_slug, email, password)
    return TokenOutput(access_token=create_access_token(user), token_type="bearer")


@router.get(
    "/me",
    response_model=CurrentUserOutput,
)
def read_current_user(
    current_user: User = Depends(
        require_permissions("identity.read")
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
        require_permissions("users.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(Role)
        .filter(
            Role.organization_id == current_user.organization_id,
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
        require_permissions("users.read")
    ),
    db: Session = Depends(get_db),
):
    users = (
        db.query(User)
        .filter(
            User.organization_id
            == current_user.organization_id,
        )
        .order_by(
            User.full_name.asc()
        )
        .all()
    )

    return [
        build_admin_user_output(user)
        for user in users
    ]


@router.get(
    "/admin/users/paged",
    response_model=AdminUserPageOutput,
)
def get_managed_users_paged(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
    role_name: str | None = Query(default=None),
    is_active: str | None = Query(default=None),
    current_user: User = Depends(
        require_permissions("users.read")
    ),
    db: Session = Depends(get_db),
):
    query = (
        db.query(User)
        .outerjoin(
            Role,
            User.role_id == Role.id,
        )
        .outerjoin(
            Department,
            User.department_id == Department.id,
        )
        .filter(
            User.organization_id
            == current_user.organization_id
        )
    )

    if search and search.strip():
        search_value = f"%{search.strip().lower()}%"

        query = query.filter(
            or_(
                func.lower(User.full_name).like(search_value),
                func.lower(User.email).like(search_value),
                func.lower(User.job_title).like(search_value),
                func.lower(Role.name).like(search_value),
                func.lower(Department.name).like(search_value),
                func.lower(User.is_active).like(search_value),
            )
        )

    if role_name and role_name.strip():
        query = query.filter(
            Role.name == role_name.strip()
        )

    if is_active and is_active.strip():
        normalized_status = is_active.strip().lower()

        if normalized_status not in {
            "active",
            "inactive",
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported account status.",
            )

        query = query.filter(
            User.is_active == normalized_status
        )

    total = query.count()

    users = (
        query
        .order_by(User.full_name.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    total_pages = max(
        1,
        (total + page_size - 1) // page_size,
    )

    return AdminUserPageOutput(
        items=[
            build_admin_user_output(user)
            for user in users
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )

@router.patch(
    "/admin/users/{user_id}",
    response_model=AdminUserOutput,
)
def update_managed_user(
    user_id: int,
    payload: AdminUserUpdate,
    current_user: User = Depends(
        require_permissions("users.update")
    ),
    db: Session = Depends(get_db),
):
    target_user = (
        db.query(User)
        .filter(
            User.id == user_id,
            User.organization_id
            == current_user.organization_id,
        )
        .first()
    )


    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account not found.",
        )
    old_role_name = (
        target_user.role.name
        if target_user.role
        else None
    )

    old_status = target_user.is_active

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
        and count_active_system_administrators(
            db,
            current_user.organization_id,
        )
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
                Role.organization_id == current_user.organization_id,
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

    if requested_status == "active" and not membership_is_ready(target_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User membership is not ready for activation.",
        )
    if requested_status is not None:
        target_user.is_active = requested_status


    new_role_name = (
        target_user.role.name
        if target_user.role
        else None
    )

    new_status = target_user.is_active


    if old_role_name != new_role_name:
        db.add(
            UserAdministrationAudit(
                actor_id=current_user.id,
                target_user_id=target_user.id,
                action="ROLE_CHANGED",
                old_role=old_role_name,
                new_role=new_role_name,
                old_status=old_status,
                new_status=new_status,
                details=(
                    f"User role changed from "
                    f"'{old_role_name or 'Unknown'}' to "
                    f"'{new_role_name or 'Unknown'}'."
                ),
            )
        )

    if old_status != new_status:
        status_action = (
            "ACCOUNT_ACTIVATED"
            if new_status == "active"
            else "ACCOUNT_DEACTIVATED"
        )

        db.add(
            UserAdministrationAudit(
                actor_id=current_user.id,
                target_user_id=target_user.id,
                action=status_action,
                old_role=old_role_name,
                new_role=new_role_name,
                old_status=old_status,
                new_status=new_status,
                details=(
                    f"User account status changed from "
                    f"'{old_status}' to '{new_status}'."
                ),
            )
        )


    db.commit()
    db.refresh(target_user)

    return build_admin_user_output(
        target_user
    )

@router.get(
    "/admin/audit-logs",
    response_model=list[UserAdministrationAuditOutput],
)
def get_user_administration_audit_logs(
    current_user: User = Depends(
        require_permissions("audit.read")
    ),
    db: Session = Depends(get_db),
):
    audit_logs = (
        db.query(UserAdministrationAudit)
        .join(
            User,
            UserAdministrationAudit.target_user_id
            == User.id,
        )
        .filter(
            User.organization_id
            == current_user.organization_id,
            UserAdministrationAudit.actor_id.in_(local_user_ids(current_user.organization_id)),
        )
        .order_by(
            UserAdministrationAudit.created_at.desc(),
            UserAdministrationAudit.id.desc(),
        )
        .all()
    )

    return [
        build_user_admin_audit_output(
            db,
            audit,
            current_user.organization_id,
        )
        for audit in audit_logs
    ]

@router.get(
    "/admin/audit-logs/paged",
    response_model=UserAdministrationAuditPageOutput,
)
def get_user_administration_audit_logs_paged(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    search: str | None = Query(default=None),
    action: str | None = Query(default=None),
    current_user: User = Depends(
        require_permissions("audit.read")
    ),
    db: Session = Depends(get_db),
):
    actor_user = aliased(User)
    target_user = aliased(User)

    query = (
        db.query(UserAdministrationAudit)
        .join(
            actor_user,
            UserAdministrationAudit.actor_id
            == actor_user.id,
        )
        .join(
            target_user,
            UserAdministrationAudit.target_user_id
            == target_user.id,
        )
        .filter(
            target_user.organization_id
            == current_user.organization_id,
            actor_user.organization_id == current_user.organization_id,
        )
    )

    if search and search.strip():
        search_value = f"%{search.strip().lower()}%"

        query = query.filter(
            or_(
                func.lower(
                    UserAdministrationAudit.action
                ).like(search_value),

                func.lower(
                    actor_user.full_name
                ).like(search_value),

                func.lower(
                    target_user.full_name
                ).like(search_value),

                func.lower(
                    target_user.email
                ).like(search_value),

                func.lower(
                    UserAdministrationAudit.old_role
                ).like(search_value),

                func.lower(
                    UserAdministrationAudit.new_role
                ).like(search_value),

                func.lower(
                    UserAdministrationAudit.old_status
                ).like(search_value),

                func.lower(
                    UserAdministrationAudit.new_status
                ).like(search_value),
            )
        )

    if action and action.strip():
        query = query.filter(
            UserAdministrationAudit.action
            == action.strip()
        )

    total = query.count()

    audit_logs = (
        query
        .order_by(
            UserAdministrationAudit.created_at.desc(),
            UserAdministrationAudit.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    total_pages = max(
        1,
        (total + page_size - 1) // page_size,
    )

    return UserAdministrationAuditPageOutput(
        items=[
            build_user_admin_audit_output(
                db,
                audit,
                current_user.organization_id,
            )
            for audit in audit_logs
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
