from datetime import date, datetime, time

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, aliased
import json

from app.database import get_db
from app.schemas.change_management import (
    ManagedChangeCreate,
    ManagedChangeRevision,
    ApprovalDecisionCreate,
    ManagedChangePageOutput,
    ChangeWorkQueueOverview,
)
from app.schemas.foundation_analysis import FoundationImpactAnalysisInput
from app.services.foundation_risk_engine import analyze_foundation_change
from app.models.change_management import (
    ManagedChangeRequest,
    ManagedChangeAffectedSystem,
    ManagedImpactAssessment,
    ChangeStatusHistory,
    AuditLog,
    ChangeApproval
)

from app.models.foundation import User
from app.services.auth_service import (
    get_current_user,
    require_roles,
)

from app.services.notification_service import (
    notify_change_managers,
    notify_requester,
)

from app.services.change_state_service import (
    ensure_change_transition,
)

router = APIRouter(
    prefix="/change-management",
    tags=["Change Management"],
)


def to_json(value):
    return json.dumps(value, ensure_ascii=False)


def from_json(value):
    if not value:
        return []
    return json.loads(value)

def get_user_display_name(
    db: Session,
    user_id: int | None,
) -> str:
    if user_id is None:
        return "System"

    user = (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )

    if not user:
        return f"User #{user_id}"

    return user.full_name

ALLOWED_CHANGE_READ_ROLES = {
    "Requester",
    "Change Manager",
    "CMDB Manager",
}


def get_user_role_name(current_user: User) -> str | None:
    if not current_user.role:
        return None

    return current_user.role.name



def restrict_change_query(query, current_user: User):
    role_name = get_user_role_name(current_user)

    if role_name not in ALLOWED_CHANGE_READ_ROLES:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view change records.",
        )

    # Every supported role is restricted to its own organization.
    query = query.filter(
        ManagedChangeRequest.organization_id
        == current_user.organization_id
    )

    if role_name == "Requester":
        query = query.filter(
            ManagedChangeRequest.requester_id
            == current_user.id
        )

    return query

def get_accessible_change_request(
    db: Session,
    change_request_id: int,
    current_user: User,
) -> ManagedChangeRequest:
    query = db.query(ManagedChangeRequest).filter(
        ManagedChangeRequest.id == change_request_id
    )

    query = restrict_change_query(query, current_user)

    change_request = query.first()

    if not change_request:
        raise HTTPException(
            status_code=404,
            detail="Change request not found or access is not permitted.",
        )

    return change_request


def build_change_response(
    change_request: ManagedChangeRequest,
):
    latest_assessment = None

    if change_request.assessments:
        latest_assessment = max(
            change_request.assessments,
            key=lambda assessment: assessment.id,
        )

    requester = change_request.requester

    return {
        "id": change_request.id,

        "requester_id": change_request.requester_id,
        "requester_name": (
            requester.full_name
            if requester
            else None
        ),
        "requester_email": (
            requester.email
            if requester
            else None
        ),

        "title": change_request.title,
        "description": change_request.description,
        "change_type": change_request.change_type,
        "change_mode": change_request.change_mode,
        "priority": change_request.priority,
        "status": change_request.status,

        "expected_downtime_minutes":
            change_request.expected_downtime_minutes,

        "rollback_complexity":
            change_request.rollback_complexity,

        "security_sensitivity":
            change_request.security_sensitivity,

        "business_justification":
            change_request.business_justification,

        "planned_start": change_request.planned_start,
        "planned_end": change_request.planned_end,

        "created_at": change_request.created_at.isoformat(),
        "updated_at": change_request.updated_at.isoformat(),

        "affected_system_ids": [
            item.system_id
            for item in change_request.affected_systems
        ],

        "latest_assessment": (
            None
            if not latest_assessment
            else {
                "risk_level":
                    latest_assessment.risk_level,

                "impact_score":
                    latest_assessment.impact_score,

                "decision_recommendation":
                    latest_assessment.decision_recommendation,

                "directly_affected_systems": from_json(
                    latest_assessment.directly_affected_systems
                ),

                "indirectly_affected_systems": from_json(
                    latest_assessment.indirectly_affected_systems
                ),

                "affected_departments": from_json(
                    latest_assessment.affected_departments
                ),

                "system_owners": from_json(
                    latest_assessment.system_owners
                ),

                "previous_incidents": from_json(
                    latest_assessment.previous_incidents
                ),

                "risk_factors": from_json(
                    latest_assessment.risk_factors
                ),

                "recommendations": from_json(
                    latest_assessment.recommendations
                ),

                "rollback_plan": from_json(
                    latest_assessment.rollback_plan
                ),

                "testing_checklist": from_json(
                    latest_assessment.testing_checklist
                ),

                "ai_explanation":
                    latest_assessment.ai_explanation,
            }
        ),
    }
@router.post("/requests")
def create_managed_change_request(
    payload: ManagedChangeCreate,
    current_user: User = Depends(require_roles("Requester")),
    db: Session = Depends(get_db),
):
    analysis_input = FoundationImpactAnalysisInput(
        title=payload.title,
        description=payload.description,
        change_type=payload.change_type,
        change_mode=payload.change_mode,
        affected_system_ids=payload.affected_system_ids,
        expected_downtime_minutes=payload.expected_downtime_minutes,
        rollback_complexity=payload.rollback_complexity,
        security_sensitivity=payload.security_sensitivity,
    )
    
    try:
        analysis = analyze_foundation_change(db, analysis_input)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))

    change_request = ManagedChangeRequest(
        organization_id=current_user.organization_id,
        requester_id=current_user.id,
        title=payload.title,
        description=payload.description,
        change_type=payload.change_type,
        change_mode=payload.change_mode,
        priority=payload.priority,
        status="Pending Approval",
        expected_downtime_minutes=payload.expected_downtime_minutes,
        rollback_complexity=payload.rollback_complexity,
        security_sensitivity=payload.security_sensitivity,
        business_justification=payload.business_justification,
        planned_start=payload.planned_start,
        planned_end=payload.planned_end,
    )

    db.add(change_request)
    db.commit()
    db.refresh(change_request)

    for system_id in payload.affected_system_ids:
        db.add(
            ManagedChangeAffectedSystem(
                change_request_id=change_request.id,
                system_id=system_id,
                impact_role="Direct",
            )
        )

    assessment = ManagedImpactAssessment(
        change_request_id=change_request.id,
        risk_level=analysis.risk_level,
        impact_score=analysis.impact_score,
        decision_recommendation=analysis.decision_recommendation,
        directly_affected_systems=to_json(analysis.directly_affected_systems),
        indirectly_affected_systems=to_json(analysis.indirectly_affected_systems),
        affected_departments=to_json(analysis.affected_departments),
        system_owners=to_json(analysis.system_owners),
        previous_incidents=to_json(analysis.previous_incidents),
        risk_factors=to_json(analysis.risk_factors),
        recommendations=to_json(analysis.recommendations),
        rollback_plan=to_json(analysis.rollback_plan),
        testing_checklist=to_json(analysis.testing_checklist),
        ai_explanation=analysis.ai_explanation,
    )

    db.add(assessment)

    db.add(
        ChangeStatusHistory(
            change_request_id=change_request.id,
            old_status=None,
            new_status="Pending Approval",
            changed_by=current_user.id,
            comment="Change request created and automatically assessed.",
        )
    )

    db.add(
        AuditLog(
            change_request_id=change_request.id,
            actor_id=current_user.id,
            action="CREATE_AND_ASSESS_CHANGE",
            entity_type="ManagedChangeRequest",
            entity_id=change_request.id,
            details=(
                "Change request created and analyzed using foundation data, "
                "system dependencies, previous incidents, and risk rules."
            ),
        )
    )

    notify_change_managers(
        db,
        organization_id=change_request.organization_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type="CHANGE_SUBMITTED",
        title="New change request submitted",
        message=(
            f"{current_user.full_name} submitted change "
            f"#{change_request.id}: {change_request.title}."
        ),
    )
    
    db.commit()
    db.refresh(change_request)

    return build_change_response(change_request)

@router.put("/requests/{change_request_id}/revise")
def revise_and_resubmit_change_request(
    change_request_id: int,
    payload: ManagedChangeRevision,
    current_user: User = Depends(require_roles("Requester")),
    db: Session = Depends(get_db),
):
    change_request = (
        db.query(ManagedChangeRequest)
        .filter(
            ManagedChangeRequest.id == change_request_id,
            ManagedChangeRequest.requester_id == current_user.id,
            ManagedChangeRequest.organization_id == current_user.organization_id,
        )
    .first()
    )


    if not change_request:
        raise HTTPException(
            status_code=404,
            detail="Change request not found or access is not permitted.",
        )

    if change_request.status != "Needs More Information":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only change requests with Needs More Information status "
                "can be revised and resubmitted."
            ),
        )

    if not payload.revision_comment.strip():
        raise HTTPException(
            status_code=400,
            detail="Revision comment is required.",
        )

    analysis_input = FoundationImpactAnalysisInput(
        title=payload.title,
        description=payload.description,
        change_type=payload.change_type,
        change_mode=payload.change_mode,
        affected_system_ids=payload.affected_system_ids,
        expected_downtime_minutes=payload.expected_downtime_minutes,
        rollback_complexity=payload.rollback_complexity,
        security_sensitivity=payload.security_sensitivity,
    )

    try:
        analysis = analyze_foundation_change(
            db,
            analysis_input,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )

    old_status = change_request.status

    ensure_change_transition(
        old_status,
        "Pending Approval",
    )

    change_request.title = payload.title
    change_request.description = payload.description
    change_request.change_type = payload.change_type
    change_request.change_mode = payload.change_mode
    change_request.priority = payload.priority
    change_request.expected_downtime_minutes = (
        payload.expected_downtime_minutes
    )
    change_request.rollback_complexity = (
        payload.rollback_complexity
    )
    change_request.security_sensitivity = (
        payload.security_sensitivity
    )
    change_request.business_justification = (
        payload.business_justification
    )
    change_request.planned_start = payload.planned_start
    change_request.planned_end = payload.planned_end
    change_request.status = "Pending Approval"

    db.query(ManagedChangeAffectedSystem).filter(
        ManagedChangeAffectedSystem.change_request_id
        == change_request.id
    ).delete()

    for system_id in payload.affected_system_ids:
        db.add(
            ManagedChangeAffectedSystem(
                change_request_id=change_request.id,
                system_id=system_id,
                impact_role="Direct",
            )
        )

    assessment = ManagedImpactAssessment(
        change_request_id=change_request.id,
        risk_level=analysis.risk_level,
        impact_score=analysis.impact_score,
        decision_recommendation=analysis.decision_recommendation,
        directly_affected_systems=to_json(
            analysis.directly_affected_systems
        ),
        indirectly_affected_systems=to_json(
            analysis.indirectly_affected_systems
        ),
        affected_departments=to_json(
            analysis.affected_departments
        ),
        system_owners=to_json(
            analysis.system_owners
        ),
        previous_incidents=to_json(
            analysis.previous_incidents
        ),
        risk_factors=to_json(
            analysis.risk_factors
        ),
        recommendations=to_json(
            analysis.recommendations
        ),
        rollback_plan=to_json(
            analysis.rollback_plan
        ),
        testing_checklist=to_json(
            analysis.testing_checklist
        ),
        ai_explanation=analysis.ai_explanation,
    )

    db.add(assessment)

    db.add(
        ChangeStatusHistory(
            change_request_id=change_request.id,
            old_status=old_status,
            new_status="Pending Approval",
            changed_by=current_user.id,
            comment=(
                "Change request revised and resubmitted. "
                f"Revision comment: {payload.revision_comment.strip()}"
            ),
        )
    )

    db.add(
        AuditLog(
            change_request_id=change_request.id,
            actor_id=current_user.id,
            action="REVISE_AND_RESUBMIT_CHANGE",
            entity_type="ManagedChangeRequest",
            entity_id=change_request.id,
            details=(
                "Requester revised the change record and triggered "
                "a new database-driven impact assessment. "
                f"Revision comment: {payload.revision_comment.strip()}"
            ),
        )
    )

    notify_change_managers(
        db,
        organization_id=change_request.organization_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type="CHANGE_RESUBMITTED",
        title="Change request resubmitted",
        message=(
            f"{current_user.full_name} revised and resubmitted "
            f"change #{change_request.id}: {change_request.title}."
        ),
    )
    db.commit()
    db.refresh(change_request)

    return build_change_response(change_request)

@router.get("/requests")
def get_managed_change_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ManagedChangeRequest)

    query = restrict_change_query(query, current_user)

    change_requests = (
        query
        .order_by(ManagedChangeRequest.id.desc())
        .all()
    )

    return [
        build_change_response(change)
        for change in change_requests
    ]


@router.get(
    "/requests/paged",
    response_model=ManagedChangePageOutput,
)
def get_managed_change_requests_paged(
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=5,
        ge=1,
        le=100,
    ),
    search: str | None = Query(
        default=None,
    ),
    status_filter: str | None = Query(
        default=None,
        alias="status",
    ),
    risk_level: str | None = Query(
        default=None,
    ),
    change_type: str | None = Query(
        default=None,
    ),
    requester_id: int | None = Query(
        default=None,
        ge=1,
    ),
    created_from: date | None = Query(
        default=None,
    ),
    created_to: date | None = Query(
        default=None,
    ),
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    latest_assessment = aliased(
        ManagedImpactAssessment
    )

    latest_assessment_id = (
        db.query(
            func.max(
                ManagedImpactAssessment.id
            )
        )
        .filter(
            ManagedImpactAssessment.change_request_id
            == ManagedChangeRequest.id
        )
        .correlate(
            ManagedChangeRequest
        )
        .scalar_subquery()
    )

    query = (
        db.query(
            ManagedChangeRequest
        )
        .outerjoin(
            latest_assessment,
            latest_assessment.id
            == latest_assessment_id,
        )
    )

    query = restrict_change_query(
        query,
        current_user,
    )

    if search and search.strip():
        search_value = (
            f"%{search.strip().lower()}%"
        )

        query = query.filter(
            or_(
                func.lower(
                    ManagedChangeRequest.title
                ).like(search_value),

                func.lower(
                    ManagedChangeRequest.description
                ).like(search_value),

                func.lower(
                    ManagedChangeRequest.business_justification
                ).like(search_value),

                ManagedChangeRequest.requester.has(
                    func.lower(
                        User.full_name
                    ).like(search_value)
                ),

                ManagedChangeRequest.requester.has(
                    func.lower(
                        User.email
                    ).like(search_value)
                ),
            )
        )

    if (
        status_filter
        and status_filter.strip()
    ):
        query = query.filter(
            ManagedChangeRequest.status
            == status_filter.strip()
        )

    if risk_level and risk_level.strip():
        query = query.filter(
            latest_assessment.risk_level
            == risk_level.strip()
        )

    if (
        change_type
        and change_type.strip()
    ):
        query = query.filter(
            ManagedChangeRequest.change_type
            == change_type.strip()
        )

    if requester_id is not None:
        role_name = get_user_role_name(
            current_user
        )

        if role_name == "Requester":
            if requester_id != current_user.id:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        "Requesters can only view "
                        "their own change records."
                    ),
                )

        query = query.filter(
            ManagedChangeRequest.requester_id
            == requester_id
        )

    if created_from is not None:
        query = query.filter(
            ManagedChangeRequest.created_at
            >= datetime.combine(
                created_from,
                time.min,
            )
        )

    if created_to is not None:
        query = query.filter(
            ManagedChangeRequest.created_at
            <= datetime.combine(
                created_to,
                time.max,
            )
        )

    if (
        created_from is not None
        and created_to is not None
        and created_to < created_from
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Created-to date cannot be "
                "earlier than created-from date."
            ),
        )

    total = query.count()

    change_requests = (
        query
        .order_by(
            ManagedChangeRequest.created_at.desc(),
            ManagedChangeRequest.id.desc(),
        )
        .offset(
            (page - 1) * page_size
        )
        .limit(page_size)
        .all()
    )

    total_pages = max(
        1,
        (
            total
            + page_size
            - 1
        ) // page_size,
    )

    return ManagedChangePageOutput(
        items=[
            build_change_response(change)
            for change in change_requests
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )
@router.get("/requests/{change_request_id}")
def get_managed_change_request(
    change_request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    change_request = get_accessible_change_request(
        db=db,
        change_request_id=change_request_id,
        current_user=current_user,
    )

    return build_change_response(change_request)


@router.get("/requests/{change_request_id}/history")
def get_change_request_history(
    change_request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    change_request = get_accessible_change_request(
        db=db,
        change_request_id=change_request_id,
        current_user=current_user,
    )

    return [
    {
        "old_status": item.old_status,
        "new_status": item.new_status,
        "changed_by": item.changed_by,
        "changed_by_name": get_user_display_name(
            db,
            item.changed_by,
        ),
        "comment": item.comment,
        "changed_at": item.changed_at,
    }
    for item in change_request.status_history
]

@router.get("/requests/{change_request_id}/audit-logs")
def get_change_request_audit_logs(
    change_request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    change_request = get_accessible_change_request(
        db=db,
        change_request_id=change_request_id,
        current_user=current_user,
    )

    return [
    {
        "action": item.action,
        "entity_type": item.entity_type,
        "entity_id": item.entity_id,
        "actor_id": item.actor_id,
        "actor_name": get_user_display_name(
            db,
            item.actor_id,
        ),
        "details": item.details,
        "created_at": item.created_at,
    }
    for item in change_request.audit_logs
]


@router.post("/requests/{change_request_id}/approvals")
def create_change_approval(
    change_request_id: int,
    payload: ApprovalDecisionCreate,
    current_user: User = Depends(
        require_roles("Change Manager")
    ),
    db: Session = Depends(get_db),
):
    allowed_decisions = {
        "Approved",
        "Rejected",
        "Needs More Information",
    }

    if payload.decision not in allowed_decisions:
        raise HTTPException(
            status_code=400,
            detail=(
                "Decision must be Approved, Rejected, "
                "or Needs More Information."
            ),
        )

    normalized_comments = (
        payload.comments.strip()
        if payload.comments
        and payload.comments.strip()
        else None
    )

    if (
        payload.decision
        in {
            "Rejected",
            "Needs More Information",
        }
        and not normalized_comments
    ):
        raise HTTPException(
            status_code=422,
            detail=(
                "Comments are required when rejecting "
                "a change or requesting more information."
            ),
        )

    change_request = (
        db.query(ManagedChangeRequest)
        .filter(
            ManagedChangeRequest.id
            == change_request_id,
            ManagedChangeRequest.organization_id
            == current_user.organization_id,
        )
        .first()
    )

    if not change_request:
        raise HTTPException(
            status_code=404,
            detail=(
                "Change request not found or access "
                "is not permitted."
            ),
        )

    if change_request.status != "Pending Approval":
        raise HTTPException(
            status_code=409,
            detail=(
                "An approval decision can be recorded "
                "only while the change is Pending Approval."
            ),
        )

    old_status = change_request.status
    new_status = payload.decision

    ensure_change_transition(
        old_status,
        new_status,
    )

    approval = ChangeApproval(
        change_request_id=change_request.id,
        approver_id=current_user.id,
        approval_level=payload.approval_level,
        decision=payload.decision,
        comments=normalized_comments,
    )

    db.add(approval)
    db.flush()

    change_request.status = new_status

    db.add(
        ChangeStatusHistory(
            change_request_id=change_request.id,
            old_status=old_status,
            new_status=new_status,
            changed_by=current_user.id,
            comment=(
                f"Approval decision: {payload.decision}. "
                f"{normalized_comments or ''}"
            ).strip(),
        )
    )

    db.add(
        AuditLog(
            change_request_id=change_request.id,
            actor_id=current_user.id,
            action="CREATE_APPROVAL_DECISION",
            entity_type="ChangeApproval",
            entity_id=approval.id,
            details=(
                f"Approval level: "
                f"{payload.approval_level}, "
                f"Decision: {payload.decision}, "
                f"Comments: "
                f"{normalized_comments or 'No comments'}"
            ),
        )
    )

    notification_titles = {
        "Approved": "Change request approved",
        "Rejected": "Change request rejected",
        "Needs More Information": (
            "More information required"
        ),
    }

    notification_types = {
        "Approved": "CHANGE_APPROVED",
        "Rejected": "CHANGE_REJECTED",
        "Needs More Information": (
            "CHANGE_INFORMATION_REQUESTED"
        ),
    }

    notify_requester(
        db,
        organization_id=change_request.organization_id,
        requester_id=change_request.requester_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type=notification_types[
            payload.decision
        ],
        title=notification_titles[
            payload.decision
        ],
        message=(
            f"Decision for change "
            f"#{change_request.id} "
            f"'{change_request.title}': "
            f"{payload.decision}. "
            f"{normalized_comments or 'No additional comments.'}"
        ),
    )

    db.commit()
    db.refresh(approval)
    db.refresh(change_request)

    return {
        "approval_id": approval.id,
        "change_request_id": change_request.id,
        "approval_level": approval.approval_level,
        "decision": approval.decision,
        "comments": approval.comments,
        "new_change_status": change_request.status,
        "decided_at": approval.decided_at,
    }


@router.get("/requests/{change_request_id}/approvals")
def get_change_approvals(
    change_request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_accessible_change_request(
        db=db,
        change_request_id=change_request_id,
        current_user=current_user,
    )

    approvals = (
        db.query(ChangeApproval)
        .filter(
            ChangeApproval.change_request_id == change_request_id
        )
        .order_by(ChangeApproval.decided_at.desc())
        .all()
    )

    return [
    {
        "approval_id": approval.id,
        "change_request_id": approval.change_request_id,
        "approver_id": approval.approver_id,
        "approver_name": get_user_display_name(
            db,
            approval.approver_id,
        ),
        "approval_level": approval.approval_level,
        "decision": approval.decision,
        "comments": approval.comments,
        "decided_at": approval.decided_at,
    }
    for approval in approvals
]


@router.get(
    "/dashboard/work-queues",
    response_model=ChangeWorkQueueOverview,
)
def get_change_manager_work_queues(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    latest_assessment = aliased(
        ManagedImpactAssessment
    )

    latest_assessment_id = (
        db.query(
            func.max(
                ManagedImpactAssessment.id
            )
        )
        .filter(
            ManagedImpactAssessment.change_request_id
            == ManagedChangeRequest.id
        )
        .correlate(
            ManagedChangeRequest
        )
        .scalar_subquery()
    )

    base_query = (
        db.query(
            ManagedChangeRequest
        )
        .outerjoin(
            latest_assessment,
            latest_assessment.id
            == latest_assessment_id,
        )
    )

    base_query = restrict_change_query(
        base_query,
        current_user,
    )

    pending_review = base_query.filter(
        ManagedChangeRequest.status
        == "Pending Approval"
    ).count()

    critical_pending = base_query.filter(
        ManagedChangeRequest.status
        == "Pending Approval",
        latest_assessment.risk_level
        == "Critical",
    ).count()

    high_pending = base_query.filter(
        ManagedChangeRequest.status
        == "Pending Approval",
        latest_assessment.risk_level
        == "High",
    ).count()

    awaiting_requester = base_query.filter(
        ManagedChangeRequest.status
        == "Needs More Information"
    ).count()

    return ChangeWorkQueueOverview(
        pending_review=pending_review,
        critical_pending=critical_pending,
        high_pending=high_pending,
        awaiting_requester=awaiting_requester,
    )


@router.get("/dashboard/overview")
def get_change_management_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    change_query = db.query(ManagedChangeRequest)

    change_query = restrict_change_query(
        change_query,
        current_user,
    )

    total_changes = change_query.count()

    pending_approval = change_query.filter(
        ManagedChangeRequest.status == "Pending Approval"
    ).count()

    approved = change_query.filter(
        ManagedChangeRequest.status == "Approved"
    ).count()

    rejected = change_query.filter(
        ManagedChangeRequest.status == "Rejected"
    ).count()

    needs_more_information = change_query.filter(
        ManagedChangeRequest.status == "Needs More Information"
    ).count()

    assessment_query = (
        db.query(ManagedImpactAssessment)
        .join(
            ManagedChangeRequest,
            ManagedImpactAssessment.change_request_id
            == ManagedChangeRequest.id,
        )
        .filter(
            ManagedChangeRequest.organization_id
            == current_user.organization_id
        )
    )

    role_name = get_user_role_name(current_user)

    if role_name == "Requester":
        assessment_query = assessment_query.filter(
            ManagedChangeRequest.requester_id
            == current_user.id
        )

    critical_assessments = assessment_query.filter(
        ManagedImpactAssessment.risk_level == "Critical"
    ).count()

    high_assessments = assessment_query.filter(
        ManagedImpactAssessment.risk_level == "High"
    ).count()

    medium_assessments = assessment_query.filter(
        ManagedImpactAssessment.risk_level == "Medium"
    ).count()

    low_assessments = assessment_query.filter(
        ManagedImpactAssessment.risk_level == "Low"
    ).count()

    all_assessments = assessment_query.all()

    if all_assessments:
        average_impact_score = round(
            sum(
                item.impact_score
                for item in all_assessments
            )
            / len(all_assessments),
            2,
        )
    else:
        average_impact_score = 0

    return {
        "total_changes": total_changes,
        "pending_approval": pending_approval,
        "approved": approved,
        "rejected": rejected,
        "needs_more_information": needs_more_information,
        "critical_risk": critical_assessments,
        "high_risk": high_assessments,
        "medium_risk": medium_assessments,
        "low_risk": low_assessments,
        "average_impact_score": average_impact_score,
    }