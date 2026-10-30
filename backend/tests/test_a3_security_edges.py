"""Credential redaction, authority evidence, entropy and failure boundaries."""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import secrets

import pytest
from sqlalchemy import event
from sqlalchemy.orm import Session

from a1_postgresql import a1_pg_engine, a1_postgres_url
from app.models.foundation import Role, User
from app.models.invitation import OrganizationInvitation as Invitation
from app.models.tenant_access_event import TenantAccessEvent
from test_a2_authentication import bearer
from test_a3_invitations import (
    accept, invitations, issue, mailbox, original_password_hash, raw_token, user_snapshot,
)
from test_a3_bootstrap import approval


def test_invitation_secret_is_csprng_32_bytes_and_only_its_hash_is_persisted(invitations, mailbox, monkeypatch):
    original = secrets.token_urlsafe
    sizes = []

    def observe(size):
        sizes.append(size)
        return original(size)

    monkeypatch.setattr(secrets, "token_urlsafe", observe)
    response = issue(invitations)
    assert response.status_code == 201
    token = raw_token(mailbox)
    assert sizes == [32] and len(token) == 43
    with Session(invitations.engine) as db:
        invitation = db.get(Invitation, response.json()["id"])
        assert invitation.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert token not in repr(invitation.__dict__)
        assert token not in json.dumps([row.event_metadata for row in db.query(TenantAccessEvent)])
    assert token not in response.text


@pytest.mark.parametrize("changes", [
    {"token": "malformed-SECRET-MARKER"}, {"token": ["SECRET-MARKER"]},
    {"token": "A" * 43}, {"password": "short"}, {"password": "x" * 73},
    {"password": "أ" * 37}, {"password": ["PASSWORD-MARKER"]},
    {"full_name": " "}, {"token_hash": "SECRET-MARKER"},
])
def test_bad_acceptance_payloads_do_not_echo_credentials(invitations, mailbox, caplog, changes):
    caplog.set_level("DEBUG")
    assert issue(invitations).status_code == 201
    token = raw_token(mailbox)
    before = user_snapshot(invitations.engine)
    response = accept(invitations, token, **changes)
    assert response.status_code == 400
    for value in (token, "SECRET-MARKER", "PASSWORD-MARKER", "A3-new-safe-password"):
        assert value not in response.text and value not in caplog.text
    assert user_snapshot(invitations.engine) == before


@pytest.mark.parametrize("operation", ["revoke", "resend"])
@pytest.mark.parametrize("actor,expected", [(2, 403), (6, 401)])
def test_only_active_administrator_can_mutate_existing_invitation(invitations, mailbox, operation, actor, expected):
    invitation_id = issue(invitations).json()["id"]
    response = invitations.client.request("POST", f"/auth/invitations/{invitation_id}/{operation}",
                                           headers=bearer(invitations.tokens[actor]))
    assert response.status_code == expected
    assert len(mailbox.messages) == 1
    with Session(invitations.engine) as db:
        assert db.get(Invitation, invitation_id).status == "pending"


def test_invitation_cannot_activate_with_no_longer_supported_role(invitations, mailbox):
    assert issue(invitations).status_code == 201
    with Session(invitations.engine) as db:
        db.get(Role, 3).name = "Unapproved role"
        db.commit()
    before = user_snapshot(invitations.engine)
    assert accept(invitations, raw_token(mailbox)).status_code == 400
    assert user_snapshot(invitations.engine) == before


def test_bootstrap_reference_without_verified_issuance_audit_is_not_authority(invitations, mailbox):
    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    with Session(invitations.engine) as db:
        db.add(Invitation(organization_id=3, email="first@new.example", role_id=8,
                          purpose="bootstrap", invited_by=None, bootstrap_authorization_id="mere-reference",
                          token_hash=hashlib.sha256(token.encode()).hexdigest(), status="pending",
                          created_at=now, expires_at=now + timedelta(minutes=30)))
        db.commit()
    before = user_snapshot(invitations.engine)
    assert accept(invitations, token).status_code == 400
    assert user_snapshot(invitations.engine) == before


def test_bootstrap_rechecks_first_administrator_condition_at_acceptance(invitations, mailbox, approval, original_password_hash):
    from app.services.bootstrap_authorization import verify_approval
    from app.services.invitation_service import create_bootstrap_invitation
    policy, signed = approval
    with Session(invitations.engine) as db:
        create_bootstrap_invitation(db, verify_approval(signed(), policy, "test-operator", 3, "first@new.example"), mailbox)
        db.add(User(organization_id=3, role_id=8, full_name="Intervening administrator",
                    email="different@new.example", password_hash=original_password_hash,
                    membership_source="legacy", is_active="active"))
        db.commit()
    before = user_snapshot(invitations.engine)
    assert accept(invitations, raw_token(mailbox)).status_code == 400
    assert user_snapshot(invitations.engine) == before


def test_delivery_result_audit_failure_does_not_undo_committed_issuance(invitations, mailbox):
    def fail_delivery_audit(mapper, connection, target):
        if target.action == "INVITATION_DELIVERY_SENT":
            raise RuntimeError("injected delivery audit failure")

    event.listen(TenantAccessEvent, "before_insert", fail_delivery_audit)
    try:
        with pytest.raises(RuntimeError, match="injected delivery audit failure"):
            issue(invitations)
    finally:
        event.remove(TenantAccessEvent, "before_insert", fail_delivery_audit)
    with Session(invitations.engine) as db:
        assert db.query(Invitation).count() == 1
        assert db.query(Invitation).one().delivery_status == "pending"
        assert db.query(TenantAccessEvent).filter_by(action="INVITATION_CREATED").count() == 1
        assert db.query(TenantAccessEvent).filter_by(action="INVITATION_DELIVERY_SENT").count() == 0
        assert db.query(User).count() == 6
    assert len(mailbox.messages) == 1  # transport may have sent; status is unknown


def test_bootstrap_has_no_public_issuance_endpoint(invitations):
    for path in ("/auth/bootstrap", "/auth/invitations/bootstrap"):
        assert invitations.client.request("POST", path, json={"organization_id": 3}).status_code == 404
