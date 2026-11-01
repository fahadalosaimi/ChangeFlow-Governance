from app.services.tenant_resources import tenant_systems, tenant_services, tenant_users, tenant_dependencies, tenant_incidents
from app.services.authorization import require_permissions
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.foundation import (
    Department,
    Incident,
    ITService,
    ITSystem,
    Organization,
    RiskRule,
    Role,
    SystemDependency,
    User,
)
from app.schemas.foundation import (
    DepartmentCreate,
    DepartmentOutput,
    IncidentCreate,
    IncidentOutput,
    ITServiceOutput,
    ITSystemCreate,
    ITSystemOutput,
    OrganizationOutput,
    RiskRuleCreate,
    RiskRuleOutput,
    RiskRuleUpdate,
    RoleOutput,
    SystemDependencyCreate,
    SystemDependencyOutput,
    SystemImpactProfileOutput,
    UserOutput,
)


router = APIRouter(
    prefix="/foundation",
    tags=["Foundation Data"],
)


def ensure_requested_organization(
    requested_organization_id: int | None,
    current_user: User,
) -> None:
    if (
        requested_organization_id is not None
        and requested_organization_id
        != current_user.organization_id
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "You cannot manage foundation data "
                "for another organization."
            ),
        )


def get_organization_system(
    db: Session,
    system_id: int,
    organization_id: int,
) -> ITSystem:
    system = (
        tenant_systems(db, organization_id)
        .filter(
            ITSystem.id == system_id,
            ITSystem.organization_id
            == organization_id,
        )
        .first()
    )

    if not system:
        raise HTTPException(
            status_code=404,
            detail=(
                "Configuration item not found or "
                "access is not permitted."
            ),
        )

    return system


@router.get("/overview")
def get_foundation_overview(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    organization_id = current_user.organization_id
    return {
        "organizations": 1,
        "departments": db.query(Department).filter(Department.organization_id == organization_id).count(),
        "users": tenant_users(db, organization_id).count(),
        "roles": db.query(Role).filter(Role.organization_id == organization_id).count(),
        "services": tenant_services(db, organization_id).count(),
        "systems": tenant_systems(db, organization_id).count(),
        "dependencies": tenant_dependencies(db, organization_id).count(),
        "incidents": tenant_incidents(db, organization_id).count(),
        # Global legacy policy/count remains a documented Batch B boundary.
        "risk_rules": db.query(RiskRule).count(),
    }


@router.get(
    "/organizations",
    response_model=list[OrganizationOutput],
)
def get_organizations(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(Organization)
        .filter(
            Organization.id
            == current_user.organization_id
        )
        .all()
    )


@router.get(
    "/roles",
    response_model=list[RoleOutput],
)
def get_roles(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(Role)
        .filter(Role.organization_id == current_user.organization_id)
        .order_by(Role.name.asc())
        .all()
    )


@router.get(
    "/departments",
    response_model=list[DepartmentOutput],
)
def get_departments(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(Department)
        .filter(
            Department.organization_id
            == current_user.organization_id
        )
        .order_by(Department.name.asc())
        .all()
    )


@router.get(
    "/users",
    response_model=list[UserOutput],
)
def get_users(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        tenant_users(db, current_user.organization_id)
        .filter(
            User.organization_id
            == current_user.organization_id
        )
        .order_by(User.full_name.asc())
        .all()
    )


@router.get(
    "/services",
    response_model=list[ITServiceOutput],
)
def get_services(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        tenant_services(db, current_user.organization_id)
        .filter(
            ITService.organization_id
            == current_user.organization_id
        )
        .order_by(ITService.name.asc())
        .all()
    )


@router.get(
    "/systems",
    response_model=list[ITSystemOutput],
)
def get_systems(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        tenant_systems(db, current_user.organization_id)
        .filter(
            ITSystem.organization_id
            == current_user.organization_id
        )
        .order_by(ITSystem.name.asc())
        .all()
    )


@router.get(
    "/systems/{system_id}",
    response_model=ITSystemOutput,
)
def get_system_by_id(
    system_id: int,
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return get_organization_system(
        db,
        system_id,
        current_user.organization_id,
    )


@router.get(
    "/systems/{system_id}/dependencies",
    response_model=list[
        SystemDependencyOutput
    ],
)
def get_system_dependencies(
    system_id: int,
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    get_organization_system(
        db,
        system_id,
        current_user.organization_id,
    )

    return (
        tenant_dependencies(db, current_user.organization_id)
        .filter(
            SystemDependency.source_system_id
            == system_id
        )
        .order_by(SystemDependency.id.asc())
        .all()
    )


@router.get(
    "/systems/{system_id}/incidents",
    response_model=list[IncidentOutput],
)
def get_system_incidents(
    system_id: int,
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    get_organization_system(
        db,
        system_id,
        current_user.organization_id,
    )

    return (
        tenant_incidents(db, current_user.organization_id)
        .filter(
            Incident.system_id == system_id
        )
        .order_by(Incident.occurred_at.desc())
        .all()
    )


@router.get(
    "/systems/{system_id}/impact-profile",
    response_model=SystemImpactProfileOutput,
)
def get_system_impact_profile(
    system_id: int,
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    system = get_organization_system(
        db,
        system_id,
        current_user.organization_id,
    )

    outgoing_dependencies = (
        tenant_dependencies(db, current_user.organization_id)
        .filter(
            SystemDependency.source_system_id
            == system_id
        )
        .all()
    )

    incoming_dependencies = (
        tenant_dependencies(db, current_user.organization_id)
        .filter(
            SystemDependency.target_system_id
            == system_id
        )
        .all()
    )

    incidents = (
        tenant_incidents(db, current_user.organization_id)
        .filter(
            Incident.system_id == system_id
        )
        .order_by(Incident.occurred_at.desc())
        .all()
    )

    outgoing_names: list[str] = []

    for dependency in outgoing_dependencies:
        target_system = get_organization_system(
            db,
            dependency.target_system_id,
            current_user.organization_id,
        )

        outgoing_names.append(
            f"{system.name} depends on "
            f"{target_system.name} "
            f"({dependency.impact_level})"
        )

    incoming_names: list[str] = []

    for dependency in incoming_dependencies:
        source_system = get_organization_system(
            db,
            dependency.source_system_id,
            current_user.organization_id,
        )

        incoming_names.append(
            f"{source_system.name} depends on "
            f"{system.name} "
            f"({dependency.impact_level})"
        )

    incident_titles = [
        f"{incident.title} "
        f"({incident.severity})"
        for incident in incidents
    ]

    department_name = (
        system.department.name
        if system.department
        else None
    )
    service_name = (
        system.service.name
        if system.service
        else None
    )
    owner_name = (
        system.owner.full_name
        if system.owner
        else None
    )

    impact_summary = (
        f"{system.name} is a "
        f"{system.criticality} criticality "
        "system. It belongs to "
        f"{department_name or 'an unspecified department'} "
        "and supports "
        f"{service_name or 'an unspecified service'}. "
        f"It has {len(outgoing_dependencies)} "
        "outgoing dependencies, "
        f"{len(incoming_dependencies)} incoming "
        "dependencies, and "
        f"{len(incidents)} previous incident(s)."
    )

    return SystemImpactProfileOutput(
        system_id=system.id,
        system_name=system.name,
        criticality=system.criticality,
        department_name=department_name,
        service_name=service_name,
        owner_name=owner_name,
        outgoing_dependencies=outgoing_names,
        incoming_dependencies=incoming_names,
        previous_incidents=incident_titles,
        impact_summary=impact_summary,
    )


@router.get(
    "/incidents",
    response_model=list[IncidentOutput],
)
def get_incidents(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        tenant_incidents(db, current_user.organization_id)
        .join(
            ITSystem,
            Incident.system_id == ITSystem.id,
        )
        .filter(
            ITSystem.organization_id
            == current_user.organization_id
        )
        .order_by(Incident.occurred_at.desc())
        .all()
    )


@router.post(
    "/incidents",
    response_model=IncidentOutput,
    status_code=201,
)
def create_incident(
    payload: IncidentCreate,
    current_user: User = Depends(
        require_permissions("foundation.write")
    ),
    db: Session = Depends(get_db),
):
    get_organization_system(
        db,
        payload.system_id,
        current_user.organization_id,
    )

    incident = Incident(
        **payload.model_dump(
            exclude_none=True
        )
    )

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return incident


@router.get(
    "/risk-rules",
    response_model=list[RiskRuleOutput],
)
def get_risk_rules(
    current_user: User = Depends(
        require_permissions("risk_rules.read")
    ),
    db: Session = Depends(get_db),
):
    return (
        db.query(RiskRule)
        .order_by(RiskRule.id.asc())
        .all()
    )


@router.post(
    "/risk-rules",
    response_model=RiskRuleOutput,
    status_code=201,
)
def create_risk_rule(
    payload: RiskRuleCreate,
    current_user: User = Depends(
        require_permissions("risk_rules.write")
    ),
    db: Session = Depends(get_db),
):
    name = payload.name.strip()

    duplicate_rule = (
        db.query(RiskRule)
        .filter(
            RiskRule.name == name,
        )
        .first()
    )

    if duplicate_rule:
        raise HTTPException(
            status_code=409,
            detail=(
                "A risk rule with this name "
                "already exists."
            ),
        )

    risk_rule = RiskRule(
        name=name,
        condition_type=(
            payload.condition_type.strip()
        ),
        condition_value=(
            payload.condition_value.strip()
        ),
        score=payload.score,
        description=payload.description,
        is_active=payload.is_active,
    )

    db.add(risk_rule)
    db.commit()
    db.refresh(risk_rule)

    return risk_rule


@router.patch(
    "/risk-rules/{rule_id}",
    response_model=RiskRuleOutput,
)
def update_risk_rule(
    rule_id: int,
    payload: RiskRuleUpdate,
    current_user: User = Depends(
        require_permissions("risk_rules.write")
    ),
    db: Session = Depends(get_db),
):
    risk_rule = (
        db.query(RiskRule)
        .filter(
            RiskRule.id == rule_id,
        )
        .first()
    )

    if not risk_rule:
        raise HTTPException(
            status_code=404,
            detail=(
                "Risk rule not found or access "
                "is not permitted."
            ),
        )

    update_data = payload.model_dump(
        exclude_unset=True
    )

    if "name" in update_data:
        name = update_data["name"].strip()

        duplicate_rule = (
            db.query(RiskRule)
            .filter(
                RiskRule.name == name,
                RiskRule.id != rule_id,
            )
            .first()
        )

        if duplicate_rule:
            raise HTTPException(
                status_code=409,
                detail=(
                    "A risk rule with this name "
                    "already exists."
                ),
            )

        update_data["name"] = name

    if "condition_type" in update_data:
        update_data["condition_type"] = (
            update_data[
                "condition_type"
            ].strip()
        )

    if "condition_value" in update_data:
        update_data["condition_value"] = (
            update_data[
                "condition_value"
            ].strip()
        )

    for field, value in update_data.items():
        setattr(risk_rule, field, value)

    db.commit()
    db.refresh(risk_rule)

    return risk_rule


@router.post(
    "/departments",
    response_model=DepartmentOutput,
    status_code=201,
)
def create_department(
    payload: DepartmentCreate,
    current_user: User = Depends(
        require_permissions("foundation.write")
    ),
    db: Session = Depends(get_db),
):
    ensure_requested_organization(
        payload.organization_id,
        current_user,
    )

    existing_department = (
        db.query(Department)
        .filter(
            Department.organization_id
            == current_user.organization_id,
            Department.name
            == payload.name,
        )
        .first()
    )

    if existing_department:
        raise HTTPException(
            status_code=409,
            detail=(
                "A business unit with this name "
                "already exists."
            ),
        )

    department = Department(
        organization_id=(
            current_user.organization_id
        ),
        name=payload.name,
        description=payload.description,
    )

    db.add(department)
    db.commit()
    db.refresh(department)

    return department


@router.post(
    "/systems",
    response_model=ITSystemOutput,
    status_code=201,
)
def create_system(
    payload: ITSystemCreate,
    current_user: User = Depends(
        require_permissions("foundation.write")
    ),
    db: Session = Depends(get_db),
):
    ensure_requested_organization(
        payload.organization_id,
        current_user,
    )

    organization_id = (
        current_user.organization_id
    )

    if payload.department_id is not None:
        department = (
            db.query(Department)
            .filter(
                Department.id
                == payload.department_id,
                Department.organization_id
                == organization_id,
            )
            .first()
        )

        if not department:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Business unit not found or "
                    "access is not permitted."
                ),
            )

    if payload.service_id is not None:
        service = (
            tenant_services(db, current_user.organization_id)
            .filter(
                ITService.id
                == payload.service_id,
                ITService.organization_id
                == organization_id,
            )
            .first()
        )

        if not service:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Service not found or access "
                    "is not permitted."
                ),
            )

    if payload.owner_id is not None:
        owner = (
            tenant_users(db, current_user.organization_id)
            .filter(
                User.id == payload.owner_id,
                User.organization_id
                == organization_id,
            )
            .first()
        )

        if not owner:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Configuration item owner not "
                    "found or access is not permitted."
                ),
            )

    existing_system = (
        tenant_systems(db, current_user.organization_id)
        .filter(
            ITSystem.organization_id
            == organization_id,
            ITSystem.name == payload.name,
        )
        .first()
    )

    if existing_system:
        raise HTTPException(
            status_code=409,
            detail=(
                "A configuration item with this "
                "name already exists."
            ),
        )

    system = ITSystem(
        organization_id=organization_id,
        department_id=(
            payload.department_id
        ),
        service_id=payload.service_id,
        owner_id=payload.owner_id,
        name=payload.name,
        description=payload.description,
        system_type=payload.system_type,
        environment=payload.environment,
        criticality=payload.criticality,
        status=payload.status,
    )

    db.add(system)
    db.commit()
    db.refresh(system)

    return system


@router.get(
    "/dependencies",
    response_model=list[
        SystemDependencyOutput
    ],
)
def get_all_system_dependencies(
    current_user: User = Depends(
        require_permissions("foundation.read")
    ),
    db: Session = Depends(get_db),
):
    return tenant_dependencies(db, current_user.organization_id).order_by(SystemDependency.id.desc()).all()


@router.post(
    "/dependencies",
    response_model=SystemDependencyOutput,
    status_code=201,
)
def create_system_dependency(
    payload: SystemDependencyCreate,
    current_user: User = Depends(
        require_permissions("foundation.write")
    ),
    db: Session = Depends(get_db),
):
    source_system = get_organization_system(
        db,
        payload.source_system_id,
        current_user.organization_id,
    )
    target_system = get_organization_system(
        db,
        payload.target_system_id,
        current_user.organization_id,
    )

    existing_dependency = (
        tenant_dependencies(db, current_user.organization_id)
        .filter(
            SystemDependency.source_system_id
            == payload.source_system_id,
            SystemDependency.target_system_id
            == payload.target_system_id,
        )
        .first()
    )

    if existing_dependency:
        raise HTTPException(
            status_code=409,
            detail=(
                "This dependency relationship "
                "already exists."
            ),
        )

    dependency = SystemDependency(
        source_system_id=(
            payload.source_system_id
        ),
        target_system_id=(
            payload.target_system_id
        ),
        dependency_type=(
            payload.dependency_type.strip()
        ),
        impact_level=payload.impact_level,
        description=(
            payload.description
            or (
                f"{source_system.name} depends "
                f"on {target_system.name}."
            )
        ),
    )

    db.add(dependency)
    db.commit()
    db.refresh(dependency)

    return dependency
