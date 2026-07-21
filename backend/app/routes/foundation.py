from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.services.auth_service import require_roles
from app.database import get_db
from app.models.foundation import (
    Organization,
    Role,
    Department,
    User,
    ITService,
    ITSystem,
    SystemDependency,
    Incident,
    RiskRule,
)

from app.schemas.foundation import (
    OrganizationOutput,
    RoleOutput,
    DepartmentOutput,
    UserOutput,
    ITServiceOutput,
    ITSystemOutput,
    SystemDependencyOutput,
    IncidentOutput,
    RiskRuleOutput,
    IncidentCreate,
    RiskRuleCreate,
    RiskRuleUpdate,
    SystemImpactProfileOutput,
    DepartmentCreate,
    ITSystemCreate,
    SystemDependencyCreate,
)


router = APIRouter(prefix="/foundation", tags=["Foundation Data"])


@router.get("/overview")
def get_foundation_overview(db: Session = Depends(get_db)):
    return {
        "organizations": db.query(Organization).count(),
        "departments": db.query(Department).count(),
        "users": db.query(User).count(),
        "roles": db.query(Role).count(),
        "services": db.query(ITService).count(),
        "systems": db.query(ITSystem).count(),
        "dependencies": db.query(SystemDependency).count(),
        "incidents": db.query(Incident).count(),
        "risk_rules": db.query(RiskRule).count(),
    }


@router.get("/organizations", response_model=list[OrganizationOutput])
def get_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).order_by(Organization.id.asc()).all()


@router.get("/roles", response_model=list[RoleOutput])
def get_roles(db: Session = Depends(get_db)):
    return db.query(Role).order_by(Role.id.asc()).all()


@router.get("/departments", response_model=list[DepartmentOutput])
def get_departments(db: Session = Depends(get_db)):
    return db.query(Department).order_by(Department.name.asc()).all()


@router.get("/users", response_model=list[UserOutput])
def get_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.full_name.asc()).all()


@router.get("/services", response_model=list[ITServiceOutput])
def get_services(db: Session = Depends(get_db)):
    return db.query(ITService).order_by(ITService.name.asc()).all()


@router.get("/systems", response_model=list[ITSystemOutput])
def get_systems(db: Session = Depends(get_db)):
    return db.query(ITSystem).order_by(ITSystem.name.asc()).all()


@router.get("/systems/{system_id}", response_model=ITSystemOutput)
def get_system_by_id(system_id: int, db: Session = Depends(get_db)):
    system = db.query(ITSystem).filter(ITSystem.id == system_id).first()

    if not system:
        raise HTTPException(status_code=404, detail="System not found")

    return system


@router.get("/systems/{system_id}/dependencies", response_model=list[SystemDependencyOutput])
def get_system_dependencies(system_id: int, db: Session = Depends(get_db)):
    system = db.query(ITSystem).filter(ITSystem.id == system_id).first()

    if not system:
        raise HTTPException(status_code=404, detail="System not found")

    dependencies = (
        db.query(SystemDependency)
        .filter(SystemDependency.source_system_id == system_id)
        .all()
    )

    return dependencies


@router.get("/systems/{system_id}/incidents", response_model=list[IncidentOutput])
def get_system_incidents(system_id: int, db: Session = Depends(get_db)):
    system = db.query(ITSystem).filter(ITSystem.id == system_id).first()

    if not system:
        raise HTTPException(status_code=404, detail="System not found")

    incidents = (
        db.query(Incident)
        .filter(Incident.system_id == system_id)
        .order_by(Incident.occurred_at.desc())
        .all()
    )

    return incidents


@router.get("/systems/{system_id}/impact-profile", response_model=SystemImpactProfileOutput)
def get_system_impact_profile(system_id: int, db: Session = Depends(get_db)):
    system = db.query(ITSystem).filter(ITSystem.id == system_id).first()

    if not system:
        raise HTTPException(status_code=404, detail="System not found")

    outgoing_dependencies = (
        db.query(SystemDependency)
        .filter(SystemDependency.source_system_id == system_id)
        .all()
    )

    incoming_dependencies = (
        db.query(SystemDependency)
        .filter(SystemDependency.target_system_id == system_id)
        .all()
    )

    incidents = (
        db.query(Incident)
        .filter(Incident.system_id == system_id)
        .order_by(Incident.occurred_at.desc())
        .all()
    )

    outgoing_names = []
    for dependency in outgoing_dependencies:
        target_system = (
            db.query(ITSystem)
            .filter(ITSystem.id == dependency.target_system_id)
            .first()
        )

        if target_system:
            outgoing_names.append(
                f"{system.name} depends on {target_system.name} ({dependency.impact_level})"
            )

    incoming_names = []
    for dependency in incoming_dependencies:
        source_system = (
            db.query(ITSystem)
            .filter(ITSystem.id == dependency.source_system_id)
            .first()
        )

        if source_system:
            incoming_names.append(
                f"{source_system.name} depends on {system.name} ({dependency.impact_level})"
            )

    incident_titles = [
        f"{incident.title} ({incident.severity})"
        for incident in incidents
    ]

    department_name = system.department.name if system.department else None
    service_name = system.service.name if system.service else None
    owner_name = system.owner.full_name if system.owner else None

    impact_summary = (
        f"{system.name} is a {system.criticality} criticality system. "
        f"It belongs to {department_name or 'an unspecified department'} "
        f"and supports {service_name or 'an unspecified service'}. "
        f"It has {len(outgoing_dependencies)} outgoing dependencies, "
        f"{len(incoming_dependencies)} incoming dependencies, "
        f"and {len(incidents)} previous incident(s)."
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


@router.get("/incidents", response_model=list[IncidentOutput])
def get_incidents(db: Session = Depends(get_db)):
    return db.query(Incident).order_by(Incident.occurred_at.desc()).all()


@router.post("/incidents", response_model=IncidentOutput, status_code=201)
def create_incident(
    payload: IncidentCreate,
    _current_user: User = Depends(require_roles("CMDB Manager")),
    db: Session = Depends(get_db),
):
    system = (
        db.query(ITSystem)
        .filter(ITSystem.id == payload.system_id)
        .first()
    )

    if not system:
        raise HTTPException(
            status_code=404,
            detail="Configuration item not found.",
        )

    if (
        payload.occurred_at is not None
        and payload.resolved_at is not None
        and payload.resolved_at < payload.occurred_at
    ):
        raise HTTPException(
            status_code=400,
            detail="Resolved date cannot be earlier than incident date.",
        )

    incident_data = payload.model_dump(exclude_none=True)

    incident = Incident(**incident_data)

    db.add(incident)
    db.commit()
    db.refresh(incident)

    return incident


@router.get("/risk-rules", response_model=list[RiskRuleOutput])
def get_risk_rules(db: Session = Depends(get_db)):
    return db.query(RiskRule).order_by(RiskRule.id.asc()).all()


@router.post(
    "/risk-rules",
    response_model=RiskRuleOutput,
    status_code=201,
)
def create_risk_rule(
    payload: RiskRuleCreate,
    _current_user: User = Depends(require_roles("CMDB Manager")),
    db: Session = Depends(get_db),
):
    if not payload.name.strip():
        raise HTTPException(
            status_code=400,
            detail="Risk rule name is required.",
        )

    if not payload.condition_type.strip():
        raise HTTPException(
            status_code=400,
            detail="Condition type is required.",
        )

    if not payload.condition_value.strip():
        raise HTTPException(
            status_code=400,
            detail="Condition value is required.",
        )

    if payload.score < 0:
        raise HTTPException(
            status_code=400,
            detail="Risk score cannot be negative.",
        )

    if payload.is_active not in ["active", "inactive"]:
        raise HTTPException(
            status_code=400,
            detail="Rule status must be active or inactive.",
        )

    existing_rule = (
        db.query(RiskRule)
        .filter(RiskRule.name == payload.name.strip())
        .first()
    )

    if existing_rule:
        raise HTTPException(
            status_code=409,
            detail="A risk rule with this name already exists.",
        )

    risk_rule = RiskRule(
        name=payload.name.strip(),
        condition_type=payload.condition_type.strip(),
        condition_value=payload.condition_value.strip(),
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
    _current_user: User = Depends(require_roles("CMDB Manager")),
    db: Session = Depends(get_db),
):
    risk_rule = (
        db.query(RiskRule)
        .filter(RiskRule.id == rule_id)
        .first()
    )

    if not risk_rule:
        raise HTTPException(
            status_code=404,
            detail="Risk rule not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data:
        name = update_data["name"].strip()

        if not name:
            raise HTTPException(
                status_code=400,
                detail="Risk rule name cannot be empty.",
            )

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
                detail="A risk rule with this name already exists.",
            )

        update_data["name"] = name

    if "condition_type" in update_data:
        condition_type = update_data["condition_type"].strip()

        if not condition_type:
            raise HTTPException(
                status_code=400,
                detail="Condition type cannot be empty.",
            )

        update_data["condition_type"] = condition_type

    if "condition_value" in update_data:
        condition_value = update_data["condition_value"].strip()

        if not condition_value:
            raise HTTPException(
                status_code=400,
                detail="Condition value cannot be empty.",
            )

        update_data["condition_value"] = condition_value

    if "score" in update_data and update_data["score"] < 0:
        raise HTTPException(
            status_code=400,
            detail="Risk score cannot be negative.",
        )

    if (
        "is_active" in update_data
        and update_data["is_active"] not in ["active", "inactive"]
    ):
        raise HTTPException(
            status_code=400,
            detail="Rule status must be active or inactive.",
        )

    for field, value in update_data.items():
        setattr(risk_rule, field, value)

    db.commit()
    db.refresh(risk_rule)

    return risk_rule


@router.post("/departments", response_model=DepartmentOutput)
def create_department(
    payload: DepartmentCreate,
    _current_user: User = Depends(require_roles("CMDB Manager")),
    db: Session = Depends(get_db),
):
    department = Department(
        organization_id=payload.organization_id,
        name=payload.name,
        description=payload.description,
    )

    db.add(department)
    db.commit()
    db.refresh(department)

    return department


@router.post("/systems", response_model=ITSystemOutput)
def create_system(
    payload: ITSystemCreate,
    _current_user: User = Depends(require_roles("CMDB Manager")),
    db: Session = Depends(get_db),
):
    organization = (
        db.query(Organization)
        .filter(Organization.id == payload.organization_id)
        .first()
    )

    if not organization:
        raise HTTPException(
            status_code=404,
            detail="Organization not found.",
        )

    if payload.department_id is not None:
        department = (
            db.query(Department)
            .filter(Department.id == payload.department_id)
            .first()
        )

        if not department:
            raise HTTPException(
                status_code=404,
                detail="Business unit not found.",
            )

    if payload.service_id is not None:
        service = (
            db.query(ITService)
            .filter(ITService.id == payload.service_id)
            .first()
        )

        if not service:
            raise HTTPException(
                status_code=404,
                detail="Service not found.",
            )

    if payload.owner_id is not None:
        owner = (
            db.query(User)
            .filter(User.id == payload.owner_id)
            .first()
        )

        if not owner:
            raise HTTPException(
                status_code=404,
                detail="Configuration item owner not found.",
            )

    existing_system = (
        db.query(ITSystem)
        .filter(
            ITSystem.organization_id == payload.organization_id,
            ITSystem.name == payload.name,
        )
        .first()
    )

    if existing_system:
        raise HTTPException(
            status_code=409,
            detail="A configuration item with this name already exists.",
        )

    system = ITSystem(
        organization_id=payload.organization_id,
        department_id=payload.department_id,
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


@router.get("/dependencies", response_model=list[SystemDependencyOutput])
def get_all_system_dependencies(db: Session = Depends(get_db)):
    return (
        db.query(SystemDependency)
        .order_by(SystemDependency.id.desc())
        .all()
    )


@router.post("/dependencies", response_model=SystemDependencyOutput)
def create_system_dependency(
    payload: SystemDependencyCreate,
    _current_user: User = Depends(require_roles("CMDB Manager")),
    db: Session = Depends(get_db),
):
    if payload.source_system_id == payload.target_system_id:
        raise HTTPException(
            status_code=400,
            detail="A configuration item cannot depend on itself.",
        )

    source_system = (
        db.query(ITSystem)
        .filter(ITSystem.id == payload.source_system_id)
        .first()
    )

    target_system = (
        db.query(ITSystem)
        .filter(ITSystem.id == payload.target_system_id)
        .first()
    )

    if not source_system:
        raise HTTPException(
            status_code=404,
            detail="Dependent configuration item was not found.",
        )

    if not target_system:
        raise HTTPException(
            status_code=404,
            detail="Required configuration item was not found.",
        )

    existing_dependency = (
        db.query(SystemDependency)
        .filter(
            SystemDependency.source_system_id == payload.source_system_id,
            SystemDependency.target_system_id == payload.target_system_id,
        )
        .first()
    )

    if existing_dependency:
        raise HTTPException(
            status_code=409,
            detail="This dependency relationship already exists.",
        )

    dependency = SystemDependency(
        source_system_id=payload.source_system_id,
        target_system_id=payload.target_system_id,
        dependency_type=payload.dependency_type,
        impact_level=payload.impact_level,
        description=(
            payload.description
            or f"{source_system.name} depends on {target_system.name}."
        ),
    )

    db.add(dependency)
    db.commit()
    db.refresh(dependency)

    return dependency