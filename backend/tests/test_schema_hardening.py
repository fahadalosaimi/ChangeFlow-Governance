from datetime import datetime

import pytest
from pydantic import ValidationError

from app.schemas.change_execution import (
    PostImplementationReviewCreate,
)
from app.schemas.change_management import (
    ApprovalDecisionCreate,
    ManagedChangeCreate,
)
from app.schemas.foundation import (
    IncidentCreate,
    SystemDependencyCreate,
)


def valid_change_payload() -> dict:
    return {
        "title": "Database maintenance",
        "description": (
            "Apply a controlled database "
            "maintenance change."
        ),
        "change_type": "database",
        "change_mode": "Normal",
        "priority": "Medium",
        "affected_system_ids": [1, 2],
        "expected_downtime_minutes": 30,
        "rollback_complexity": "Medium",
        "security_sensitivity": "Medium",
    }


def test_change_requires_unique_system_ids():
    payload = valid_change_payload()
    payload["affected_system_ids"] = [1, 1]

    with pytest.raises(ValidationError):
        ManagedChangeCreate(**payload)


def test_change_rejects_negative_downtime():
    payload = valid_change_payload()
    payload["expected_downtime_minutes"] = -1

    with pytest.raises(ValidationError):
        ManagedChangeCreate(**payload)


def test_change_rejects_invalid_planned_window():
    payload = valid_change_payload()
    payload["planned_start"] = (
        "2026-08-02T12:00:00"
    )
    payload["planned_end"] = (
        "2026-08-02T11:00:00"
    )

    with pytest.raises(ValidationError):
        ManagedChangeCreate(**payload)


def test_change_accepts_datetime_fields():
    payload = valid_change_payload()
    payload["planned_start"] = (
        "2026-08-02T11:00:00"
    )
    payload["planned_end"] = (
        "2026-08-02T12:00:00"
    )

    change = ManagedChangeCreate(**payload)

    assert isinstance(
        change.planned_start,
        datetime,
    )


def test_dependency_cannot_reference_itself():
    with pytest.raises(ValidationError):
        SystemDependencyCreate(
            source_system_id=1,
            target_system_id=1,
            dependency_type=(
                "Application Dependency"
            ),
        )


def test_incident_resolution_cannot_precede_start():
    with pytest.raises(ValidationError):
        IncidentCreate(
            system_id=1,
            title="Service interruption",
            occurred_at=(
                "2026-08-02T12:00:00"
            ),
            resolved_at=(
                "2026-08-02T11:00:00"
            ),
        )


@pytest.mark.parametrize(
    "pir_result",
    [
        "Successful",
        "Successful with Issues",
        "Unsuccessful",
    ],
)
def test_pir_results_match_frontend(
    pir_result: str,
):
    payload = PostImplementationReviewCreate(
        pir_result=pir_result,
        pir_summary="Review completed.",
    )

    assert payload.pir_result == pir_result


def test_rejection_requires_comments():
    with pytest.raises(ValidationError):
        ApprovalDecisionCreate(
            decision="Rejected",
            comments="",
        )
