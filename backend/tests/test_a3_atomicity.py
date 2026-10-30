"""Real PostgreSQL races and injected transaction failures for A3."""
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event

import pytest
import sqlalchemy as sa
from sqlalchemy import event
from sqlalchemy.orm import Session

from a1_postgresql import a1_pg_engine, a1_postgres_url
from app.models.foundation import User
from app.models.invitation import OrganizationInvitation as Invitation
from app.models.tenant_access_event import TenantAccessEvent
from test_a2_authentication import bearer
from test_a3_invitations import (
    accept, invitations, issue, mailbox, original_password_hash, raw_token, user_snapshot,
)


def race(first, second):
    barrier = Barrier(2)

    def run(operation):
        barrier.wait(timeout=10)
        return operation()

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(run, operation) for operation in (first, second)]
        return [future.result(timeout=30) for future in futures]


def mutation(workspace, invitation_id, operation, actor=1):
    return workspace.client.request("POST", f"/auth/invitations/{invitation_id}/{operation}",
                                    headers=bearer(workspace.tokens[actor]))


def test_concurrent_acceptance_has_one_user_and_one_consumption(invitations, mailbox):
    invitation_id = issue(invitations).json()["id"]
    token = raw_token(mailbox)
    results = race(lambda: accept(invitations, token), lambda: accept(invitations, token))
    assert sorted(response.status_code for response in results) == [200, 400]
    with Session(invitations.engine) as db:
        assert db.query(User).count() == 7
        assert db.get(Invitation, invitation_id).status == "accepted"
        assert db.query(TenantAccessEvent).filter_by(action="MEMBERSHIP_ACTIVATED").count() == 1


@pytest.mark.parametrize("operations", [("resend", "revoke"), ("resend", "resend"), ("revoke", "revoke")])
def test_concurrent_resend_and_revoke_have_one_winner(invitations, mailbox, operations):
    invitation_id = issue(invitations).json()["id"]
    old_token = raw_token(mailbox)
    responses = race(*(lambda name=name: mutation(invitations, invitation_id, name) for name in operations))
    codes = [response.status_code for response in responses]
    assert sum(code in (200, 201) for code in codes) == 1 and codes.count(409) == 1
    assert accept(invitations, old_token).status_code == 400
    with Session(invitations.engine) as db:
        assert db.get(Invitation, invitation_id).status == "revoked"
        assert db.query(Invitation).filter_by(status="pending").count() == (1 if 201 in codes else 0)
        assert db.query(User).count() == 6


@pytest.mark.parametrize("operation", ["resend", "revoke"])
def test_acceptance_cannot_win_after_token_invalidation(invitations, mailbox, operation):
    invitation_id = issue(invitations).json()["id"]
    token = raw_token(mailbox)
    accepted, managed = race(lambda: accept(invitations, token), lambda: mutation(invitations, invitation_id, operation))
    allowed = {(200, 409), (400, 201 if operation == "resend" else 200)}
    assert (accepted.status_code, managed.status_code) in allowed
    with Session(invitations.engine) as db:
        assert db.query(User).count() == (7 if accepted.status_code == 200 else 6)


def test_concurrent_creation_enforces_case_insensitive_pending_uniqueness(invitations, mailbox):
    first, second = race(lambda: issue(invitations, email="Race@one.example"),
                         lambda: issue(invitations, email=" race@one.example "))
    assert sorted([first.status_code, second.status_code]) == [201, 409]
    assert len(mailbox.messages) == 1
    with Session(invitations.engine) as db:
        assert db.query(Invitation).count() == 1


@pytest.mark.parametrize("action", ["INVITATION_CREATED", "MEMBERSHIP_ACTIVATED", "INVITATION_RESENT"])
def test_audit_failure_rolls_back_the_entire_lifecycle_transition(invitations, mailbox, action):
    invitation_id = None
    token = None
    if action != "INVITATION_CREATED":
        invitation_id = issue(invitations).json()["id"]
        token = raw_token(mailbox)
    before = user_snapshot(invitations.engine)
    deliveries = len(mailbox.messages)

    def fail_audit(mapper, connection, target):
        if target.action == action:
            raise RuntimeError("injected audit failure")

    event.listen(TenantAccessEvent, "before_insert", fail_audit)
    try:
        with pytest.raises(RuntimeError, match="injected audit failure"):
            if action == "INVITATION_CREATED":
                issue(invitations)
            elif action == "MEMBERSHIP_ACTIVATED":
                accept(invitations, token)
            else:
                mutation(invitations, invitation_id, "resend")
    finally:
        event.remove(TenantAccessEvent, "before_insert", fail_audit)
    assert len(mailbox.messages) == deliveries
    assert user_snapshot(invitations.engine) == before
    with Session(invitations.engine) as db:
        assert db.query(Invitation).count() == (0 if invitation_id is None else 1)
        if invitation_id is not None:
            invitation = db.get(Invitation, invitation_id)
            assert (invitation.status, invitation.consumed_at, invitation.accepted_user_id) == ("pending", None, None)
    if token is not None:
        assert accept(invitations, token).status_code == 200  # rollback did not consume it


def test_delivery_completion_does_not_restore_a_revoked_invitation(invitations, mailbox, monkeypatch):
    entered, release = Event(), Event()
    original = mailbox.send_invitation

    def delayed(message):
        original(message)
        entered.set()
        assert release.wait(timeout=10)

    monkeypatch.setattr(mailbox, "send_invitation", delayed)
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(issue, invitations)
        try:
            assert entered.wait(timeout=10)
            invitation_id = mailbox.messages[0].invitation_id
            assert mutation(invitations, invitation_id, "revoke").status_code == 200
        finally:
            release.set()
        created = pending.result(timeout=20)
    assert (created.status_code, created.json()["status"], created.json()["delivery_status"]) == (201, "revoked", "sent")
    assert accept(invitations, raw_token(mailbox)).status_code == 400


def test_directory_account_cannot_be_reset_if_password_appears_before_acceptance(invitations, mailbox, original_password_hash):
    assert issue(invitations, purpose="directory_activation", target_user_id=4,
                 email="directory@one.example").status_code == 201
    with Session(invitations.engine) as db:
        db.get(User, 4).password_hash = original_password_hash
        db.commit()
    before = user_snapshot(invitations.engine)
    assert accept(invitations, raw_token(mailbox)).status_code == 400
    assert user_snapshot(invitations.engine) == before


def test_account_created_after_issue_cannot_have_credentials_overwritten(invitations, mailbox, original_password_hash):
    assert issue(invitations).status_code == 201
    with Session(invitations.engine) as db:
        db.add(User(organization_id=1, role_id=3, email="new@one.example", full_name="Intervening Account",
                    password_hash=original_password_hash, membership_source="legacy", is_active="active"))
        db.commit()
    before = user_snapshot(invitations.engine)
    assert accept(invitations, raw_token(mailbox)).status_code == 400
    assert user_snapshot(invitations.engine) == before


def test_expiration_is_checked_again_after_password_hashing(invitations, mailbox, monkeypatch):
    from fastapi import HTTPException
    from app.schemas.invitation import InvitationAcceptance
    from app.services import invitation_service
    invitation_id = issue(invitations).json()["id"]
    before = user_snapshot(invitations.engine)
    original = invitation_service.hash_password
    with Session(invitations.engine) as db:
        def expires_while_hashing(password):
            value = original(password)
            # Only this fixture-owned transaction changes time evidence; the
            # transition must fail and roll this injected update back as well.
            db.execute(sa.text("UPDATE organization_invitations SET created_at=clock_timestamp()-interval '2 days', "
                               "expires_at=clock_timestamp()-interval '1 day' WHERE id=:id"), {"id": invitation_id})
            db.expire_all()
            return value
        monkeypatch.setattr(invitation_service, "hash_password", expires_while_hashing)
        payload = InvitationAcceptance(token=raw_token(mailbox), password="A3-new-safe-password", full_name="New Member")
        with pytest.raises(HTTPException) as error:
            invitation_service.accept_invitation(db, payload)
        assert error.value.status_code == 400
    assert user_snapshot(invitations.engine) == before
    with Session(invitations.engine) as db:
        assert db.get(Invitation, invitation_id).status == "pending"
