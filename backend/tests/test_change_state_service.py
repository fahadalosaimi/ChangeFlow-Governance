import pytest
from fastapi import HTTPException

from app.services.change_state_service import ensure_change_transition


@pytest.mark.parametrize(
    ("old_status", "new_status"),
    [
        (None, "Pending Approval"),
        ("Pending Approval", "Approved"),
        ("Pending Approval", "Rejected"),
        ("Pending Approval", "Needs More Information"),
        ("Needs More Information", "Pending Approval"),
        ("Approved", "In Progress"),
        ("In Progress", "Implemented"),
        ("In Progress", "Failed"),
        ("Implemented", "Closed"),
        ("Failed", "Rolled Back"),
    ],
)
def test_allowed_change_transitions(old_status, new_status):
    ensure_change_transition(old_status, new_status)


@pytest.mark.parametrize(
    ("old_status", "new_status"),
    [
        (None, "Approved"),
        ("Pending Approval", "In Progress"),
        ("Approved", "Closed"),
        ("In Progress", "Approved"),
        ("Implemented", "Rolled Back"),
        ("Failed", "Closed"),
        ("Rejected", "Approved"),
        ("Rolled Back", "In Progress"),
        ("Closed", "Pending Approval"),
    ],
)
def test_invalid_change_transitions(old_status, new_status):
    with pytest.raises(HTTPException) as error:
        ensure_change_transition(old_status, new_status)

    assert error.value.status_code == 409


def test_duplicate_status_is_blocked():
    with pytest.raises(HTTPException) as error:
        ensure_change_transition("Approved", "Approved")

    assert error.value.status_code == 409


def test_unknown_status_is_blocked():
    with pytest.raises(HTTPException) as error:
        ensure_change_transition("Pending Approval", "Unknown")

    assert error.value.status_code == 400
