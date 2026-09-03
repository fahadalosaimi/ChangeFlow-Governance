from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import (
    Session,
    joinedload,
)

from app.database import get_db
from app.models.change_execution import (
    ChangeImplementation,
)
from app.models.change_management import (
    AuditLog,
    ChangeStatusHistory,
    ManagedChangeRequest,
)
from app.models.foundation import User
from app.schemas.change_execution import (
    ChangeImplementationComplete,
    ChangeImplementationFailure,
    ChangeImplementationOutput,
    ChangeImplementationRollback,
    ChangeImplementationStart,
    DeliveryQueueOverview,
    PostImplementationReviewCreate,
)
from app.services.auth_service import (
    get_current_user,
    require_roles,
)
from app.services.notification_service import (
    notify_requester,
)
from app.services.change_state_service import (
    ensure_change_transition,
)



def utc_now() -> datetime:
    return datetime.now(
        timezone.utc
    ).replace(tzinfo=None)


router = APIRouter(
    prefix="/change-management",
    tags=["Change Implementation"],
)


ALLOWED_CHANGE_READ_ROLES = {
    "Requester",
    "Change Manager",
    "CMDB Manager",
}


ALLOWED_PIR_RESULTS = {
    "Successful",
    "Successful with Issues",
    "Unsuccessful",
}


def get_user_role_name(
    current_user: User,
) -> Optional[str]:
    if not current_user.role:
        return None

    return current_user.role.name


def get_accessible_change_request(
    db: Session,
    change_request_id: int,
    current_user: User,
) -> ManagedChangeRequest:
    role_name = get_user_role_name(
        current_user
    )

    if role_name not in ALLOWED_CHANGE_READ_ROLES:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission to view "
                "change implementation records."
            ),
        )

    query = (
        db.query(ManagedChangeRequest)
        .filter(
            ManagedChangeRequest.id
            == change_request_id,
            ManagedChangeRequest.organization_id
            == current_user.organization_id,
        )
    )

    if role_name == "Requester":
        query = query.filter(
            ManagedChangeRequest.requester_id
            == current_user.id
        )

    change_request = query.first()

    if not change_request:
        raise HTTPException(
            status_code=404,
            detail=(
                "Change request not found or access "
                "is not permitted."
            ),
        )

    return change_request


def get_manager_change_request(
    db: Session,
    change_request_id: int,
    current_user: User,
) -> ManagedChangeRequest:
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

    return change_request


def get_implementation_record(
    db: Session,
    change_request_id: int,
) -> Optional[ChangeImplementation]:
    return (
        db.query(ChangeImplementation)
        .options(
            joinedload(
                ChangeImplementation.coordinator
            )
        )
        .filter(
            ChangeImplementation.change_request_id
            == change_request_id
        )
        .first()
    )


def build_implementation_response(
    implementation: ChangeImplementation,
) -> dict:
    coordinator_name = "Unassigned"

    if implementation.coordinator:
        coordinator_name = (
            implementation.coordinator.full_name
        )

    return {
        "id": implementation.id,
        "change_request_id":
            implementation.change_request_id,
        "coordinator_id":
            implementation.coordinator_id,
        "coordinator_name": coordinator_name,
        "implementation_status":
            implementation.implementation_status,
        "start_notes":
            implementation.start_notes,
        "actual_start":
            implementation.actual_start,
        "completion_summary":
            implementation.completion_summary,
        "validation_results":
            implementation.validation_results,
        "actual_end":
            implementation.actual_end,
        "failure_summary":
            implementation.failure_summary,
        "rollback_performed":
            implementation.rollback_performed,
        "rollback_reason":
            implementation.rollback_reason,
        "pir_result":
            implementation.pir_result,
        "pir_summary":
            implementation.pir_summary,
        "follow_up_actions":
            implementation.follow_up_actions,
        "pir_completed_at":
            implementation.pir_completed_at,
        "created_at":
            implementation.created_at,
        "updated_at":
            implementation.updated_at,
    }


def add_status_transition(
    db: Session,
    *,
    change_request: ManagedChangeRequest,
    current_user: User,
    old_status: str,
    new_status: str,
    comment: str,
    action: str,
    details: str,
    implementation_id: int,
) -> None:
    db.add(
        ChangeStatusHistory(
            change_request_id=change_request.id,
            old_status=old_status,
            new_status=new_status,
            changed_by=current_user.id,
            comment=comment,
        )
    )

    db.add(
        AuditLog(
            change_request_id=change_request.id,
            actor_id=current_user.id,
            action=action,
            entity_type="ChangeImplementation",
            entity_id=implementation_id,
            details=details,
        )
    )


@router.get(
    "/dashboard/delivery-queues",
    response_model=DeliveryQueueOverview,
)
def get_delivery_queue_overview(
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    role_name = get_user_role_name(
        current_user
    )

    if role_name not in ALLOWED_CHANGE_READ_ROLES:
        raise HTTPException(
            status_code=403,
            detail=(
                "You do not have permission to view "
                "change delivery queues."
            ),
        )

    query = (
        db.query(ManagedChangeRequest)
        .filter(
            ManagedChangeRequest.organization_id
            == current_user.organization_id
        )
    )

    if role_name == "Requester":
        query = query.filter(
            ManagedChangeRequest.requester_id
            == current_user.id
        )

    approved_ready = query.filter(
        ManagedChangeRequest.status
        == "Approved"
    ).count()

    in_progress = query.filter(
        ManagedChangeRequest.status
        == "In Progress"
    ).count()

    pending_pir = query.filter(
        ManagedChangeRequest.status
        == "Implemented"
    ).count()

    failed = query.filter(
        ManagedChangeRequest.status
        == "Failed"
    ).count()

    return DeliveryQueueOverview(
        approved_ready=approved_ready,
        in_progress=in_progress,
        pending_pir=pending_pir,
        failed=failed,
    )


@router.get(
    "/requests/{change_request_id}/implementation",
    response_model=Optional[
        ChangeImplementationOutput
    ],
)
def get_change_implementation(
    change_request_id: int,
    current_user: User = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    get_accessible_change_request(
        db=db,
        change_request_id=change_request_id,
        current_user=current_user,
    )

    implementation = get_implementation_record(
        db,
        change_request_id,
    )

    if not implementation:
        return None

    return build_implementation_response(
        implementation
    )


@router.post(
    "/requests/{change_request_id}/implementation/start",
    response_model=ChangeImplementationOutput,
)
def start_change_implementation(
    change_request_id: int,
    payload: ChangeImplementationStart,
    current_user: User = Depends(
        require_roles("Change Manager")
    ),
    db: Session = Depends(get_db),
):
    change_request = get_manager_change_request(
        db,
        change_request_id,
        current_user,
    )

    if change_request.status != "Approved":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only approved changes can enter "
                "implementation."
            ),
        )

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    if implementation:
        raise HTTPException(
            status_code=409,
            detail=(
                "An implementation record already "
                "exists for this change."
            ),
        )

    now = utc_now()

    implementation = ChangeImplementation(
        change_request_id=change_request.id,
        coordinator_id=current_user.id,
        implementation_status="In Progress",
        start_notes=(
            payload.start_notes.strip()
            if payload.start_notes
            and payload.start_notes.strip()
            else None
        ),
        actual_start=now,
        rollback_performed=False,
    )

    db.add(implementation)
    db.flush()

    old_status = change_request.status

    ensure_change_transition(
        old_status,
        "In Progress",
    )

    change_request.status = "In Progress"

    add_status_transition(
        db,
        change_request=change_request,
        current_user=current_user,
        old_status=old_status,
        new_status="In Progress",
        comment=(
            "Authorized change implementation started."
        ),
        action="START_CHANGE_IMPLEMENTATION",
        details=(
            "The Change Manager started controlled "
            "implementation execution."
        ),
        implementation_id=implementation.id,
    )

    notify_requester(
        db,
        organization_id=change_request.organization_id,
        requester_id=change_request.requester_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type=(
            "CHANGE_IMPLEMENTATION_STARTED"
        ),
        title="Change implementation started",
        message=(
            f"Implementation started for change "
            f"#{change_request.id} "
            f"'{change_request.title}'."
        ),
    )

    db.commit()

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    return build_implementation_response(
        implementation
    )


@router.post(
    "/requests/{change_request_id}/implementation/complete",
    response_model=ChangeImplementationOutput,
)
def complete_change_implementation(
    change_request_id: int,
    payload: ChangeImplementationComplete,
    current_user: User = Depends(
        require_roles("Change Manager")
    ),
    db: Session = Depends(get_db),
):
    change_request = get_manager_change_request(
        db,
        change_request_id,
        current_user,
    )

    if change_request.status != "In Progress":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only changes currently In Progress "
                "can be completed."
            ),
        )

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    if not implementation:
        raise HTTPException(
            status_code=404,
            detail=(
                "Implementation record not found."
            ),
        )

    now = utc_now()

    implementation.implementation_status = (
        "Implemented"
    )
    implementation.completion_summary = (
        payload.completion_summary.strip()
    )
    implementation.validation_results = (
        payload.validation_results.strip()
    )
    implementation.actual_end = now

    old_status = change_request.status

    ensure_change_transition(
        old_status,
        "Implemented",
    )

    change_request.status = "Implemented"

    add_status_transition(
        db,
        change_request=change_request,
        current_user=current_user,
        old_status=old_status,
        new_status="Implemented",
        comment=(
            "Implementation completed and validation "
            "evidence recorded."
        ),
        action="COMPLETE_CHANGE_IMPLEMENTATION",
        details=(
            "The Change Manager recorded successful "
            "implementation and validation results."
        ),
        implementation_id=implementation.id,
    )

    notify_requester(
        db,
        organization_id=change_request.organization_id,
        requester_id=change_request.requester_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type="CHANGE_IMPLEMENTED",
        title="Change implementation completed",
        message=(
            f"Change #{change_request.id} "
            f"'{change_request.title}' was implemented "
            "and is awaiting post-implementation review."
        ),
    )

    db.commit()

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    return build_implementation_response(
        implementation
    )


@router.post(
    "/requests/{change_request_id}/implementation/fail",
    response_model=ChangeImplementationOutput,
)
def fail_change_implementation(
    change_request_id: int,
    payload: ChangeImplementationFailure,
    current_user: User = Depends(
        require_roles("Change Manager")
    ),
    db: Session = Depends(get_db),
):
    change_request = get_manager_change_request(
        db,
        change_request_id,
        current_user,
    )

    if change_request.status != "In Progress":
        raise HTTPException(
            status_code=400,
            detail=(
                "Only changes currently In Progress "
                "can be recorded as failed."
            ),
        )

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    if not implementation:
        raise HTTPException(
            status_code=404,
            detail=(
                "Implementation record not found."
            ),
        )

    implementation.implementation_status = "Failed"
    implementation.failure_summary = (
        payload.failure_summary.strip()
    )
    implementation.actual_end = utc_now()

    old_status = change_request.status

    ensure_change_transition(
        old_status,
        "Failed",
    )

    change_request.status = "Failed"

    add_status_transition(
        db,
        change_request=change_request,
        current_user=current_user,
        old_status=old_status,
        new_status="Failed",
        comment=(
            "Implementation failure recorded. "
            "Rollback assessment is required."
        ),
        action="FAIL_CHANGE_IMPLEMENTATION",
        details=(
            "The Change Manager recorded an "
            "implementation failure."
        ),
        implementation_id=implementation.id,
    )

    notify_requester(
        db,
        organization_id=change_request.organization_id,
        requester_id=change_request.requester_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type=(
            "CHANGE_IMPLEMENTATION_FAILED"
        ),
        title="Change implementation failed",
        message=(
            f"Implementation failed for change "
            f"#{change_request.id} "
            f"'{change_request.title}'."
        ),
    )

    db.commit()

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    return build_implementation_response(
        implementation
    )


@router.post(
    "/requests/{change_request_id}/implementation/rollback",
    response_model=ChangeImplementationOutput,
)
def record_change_rollback(
    change_request_id: int,
    payload: ChangeImplementationRollback,
    current_user: User = Depends(
        require_roles("Change Manager")
    ),
    db: Session = Depends(get_db),
):
    change_request = get_manager_change_request(
        db,
        change_request_id,
        current_user,
    )

    if change_request.status != "Failed":
        raise HTTPException(
            status_code=400,
            detail=(
                "Rollback can only be recorded after "
                "a failed implementation."
            ),
        )

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    if not implementation:
        raise HTTPException(
            status_code=404,
            detail=(
                "Implementation record not found."
            ),
        )

    implementation.implementation_status = (
        "Rolled Back"
    )
    implementation.rollback_performed = True
    implementation.rollback_reason = (
        payload.rollback_reason.strip()
    )

    if implementation.actual_end is None:
        implementation.actual_end = utc_now()

    old_status = change_request.status

    ensure_change_transition(
        old_status,
        "Rolled Back",
    )

    change_request.status = "Rolled Back"

    add_status_transition(
        db,
        change_request=change_request,
        current_user=current_user,
        old_status=old_status,
        new_status="Rolled Back",
        comment=(
            "Rollback completed and service recovery "
            "details recorded."
        ),
        action="RECORD_CHANGE_ROLLBACK",
        details=(
            "The Change Manager recorded rollback "
            "completion after failed execution."
        ),
        implementation_id=implementation.id,
    )

    notify_requester(
        db,
        organization_id=change_request.organization_id,
        requester_id=change_request.requester_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type="CHANGE_ROLLED_BACK",
        title="Change rollback completed",
        message=(
            f"Change #{change_request.id} "
            f"'{change_request.title}' was rolled back."
        ),
    )

    db.commit()

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    return build_implementation_response(
        implementation
    )


@router.post(
    (
        "/requests/{change_request_id}/implementation/"
        "post-implementation-review"
    ),
    response_model=ChangeImplementationOutput,
)
def complete_post_implementation_review(
    change_request_id: int,
    payload: PostImplementationReviewCreate,
    current_user: User = Depends(
        require_roles("Change Manager")
    ),
    db: Session = Depends(get_db),
):
    change_request = get_manager_change_request(
        db,
        change_request_id,
        current_user,
    )

    if change_request.status != "Implemented":
        raise HTTPException(
            status_code=400,
            detail=(
                "Post-implementation review is "
                "available only for implemented changes."
            ),
        )

    if payload.pir_result not in ALLOWED_PIR_RESULTS:
        raise HTTPException(
            status_code=400,
            detail=(
                "PIR result must be Successful, "
                "Successful with Issues, or Unsuccessful."
            ),
        )

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    if not implementation:
        raise HTTPException(
            status_code=404,
            detail=(
                "Implementation record not found."
            ),
        )

    implementation.implementation_status = "Closed"
    implementation.pir_result = payload.pir_result
    implementation.pir_summary = (
        payload.pir_summary.strip()
    )
    implementation.follow_up_actions = (
        payload.follow_up_actions.strip()
        if payload.follow_up_actions
        and payload.follow_up_actions.strip()
        else None
    )
    implementation.pir_completed_at = utc_now()

    old_status = change_request.status

    ensure_change_transition(
        old_status,
        "Closed",
    )

    change_request.status = "Closed"

    add_status_transition(
        db,
        change_request=change_request,
        current_user=current_user,
        old_status=old_status,
        new_status="Closed",
        comment=(
            "Post-implementation review completed "
            f"with result: {payload.pir_result}."
        ),
        action=(
            "COMPLETE_POST_IMPLEMENTATION_REVIEW"
        ),
        details=(
            "The Change Manager completed the "
            "post-implementation review and formally "
            "closed the change."
        ),
        implementation_id=implementation.id,
    )

    notify_requester(
        db,
        organization_id=change_request.organization_id,
        requester_id=change_request.requester_id,
        actor_id=current_user.id,
        change_request_id=change_request.id,
        notification_type="CHANGE_CLOSED",
        title="Change formally closed",
        message=(
            f"Change #{change_request.id} "
            f"'{change_request.title}' completed "
            "post-implementation review and was closed."
        ),
    )

    db.commit()

    implementation = get_implementation_record(
        db,
        change_request.id,
    )

    return build_implementation_response(
        implementation
    )
