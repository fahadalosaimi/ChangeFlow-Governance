from typing import Optional

from fastapi import HTTPException


VALID_CHANGE_STATUSES = {
    "Pending Approval",
    "Needs More Information",
    "Approved",
    "Rejected",
    "In Progress",
    "Implemented",
    "Failed",
    "Rolled Back",
    "Closed",
}


ALLOWED_CHANGE_TRANSITIONS = {
    "Pending Approval": {
        "Approved",
        "Rejected",
        "Needs More Information",
    },
    "Needs More Information": {
        "Pending Approval",
    },
    "Approved": {
        "In Progress",
    },
    "In Progress": {
        "Implemented",
        "Failed",
    },
    "Implemented": {
        "Closed",
    },
    "Failed": {
        "Rolled Back",
    },
    "Rejected": set(),
    "Rolled Back": set(),
    "Closed": set(),
}


TERMINAL_CHANGE_STATUSES = {
    "Rejected",
    "Rolled Back",
    "Closed",
}


def ensure_change_transition(
    old_status: Optional[str],
    new_status: str,
) -> None:
    if new_status not in VALID_CHANGE_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported change status: "
                f"{new_status}."
            ),
        )

    if old_status is None:
        if new_status != "Pending Approval":
            raise HTTPException(
                status_code=409,
                detail=(
                    "A new change request must start "
                    "in Pending Approval status."
                ),
            )
        return

    if old_status not in VALID_CHANGE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=(
                f"The current change status "
                f"'{old_status}' is not supported."
            ),
        )

    if old_status == new_status:
        raise HTTPException(
            status_code=409,
            detail=(
                f"The change is already in "
                f"{new_status} status."
            ),
        )

    allowed_targets = ALLOWED_CHANGE_TRANSITIONS.get(
        old_status,
        set(),
    )

    if new_status not in allowed_targets:
        if old_status in TERMINAL_CHANGE_STATUSES:
            detail = (
                "No further workflow transitions "
                f"are allowed after {old_status}."
            )
        else:
            detail = (
                "Invalid change transition: "
                f"{old_status} -> {new_status}."
            )

        raise HTTPException(
            status_code=409,
            detail=detail,
        )
