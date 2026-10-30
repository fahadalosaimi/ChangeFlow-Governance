"""A3 HTTP/security tests use only fixture-owned, migrated PostgreSQL schemas."""
import json
import hashlib
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from a1_postgresql import a1_pg_engine, a1_postgres_url, migrate
from app.database import get_db
from app.main import app
from app.models.foundation import Department, Organization, Role, User
from app.models.invitation import OrganizationInvitation as Invitation
from app.models.tenant_access_event import TenantAccessEvent
from app.services.auth_service import create_access_token, hash_password
from app.services.invitation_mailer import get_invitation_mailer
from test_a2_authentication import Client, bearer


@pytest.fixture(scope="module")
def original_password_hash():
    return hash_password("A3-existing-password")


@pytest.fixture
def invitations(a1_pg_engine, original_password_hash):
    with a1_pg_engine.begin() as connection:
        migrate(connection)
    with Session(a1_pg_engine) as db:
        db.add_all([Organization(id=i, name=f"A3 Tenant {i}", slug=f"tenant-{i}") for i in (1, 2, 3)])
        db.flush()
        db.add_all([
            Role(id=1, name="System Administrator"),
            Role(id=2, organization_id=1, name="System Administrator"),
            Role(id=3, organization_id=1, name="Requester"),
            Role(id=4, organization_id=1, name="CMDB Manager"),
            Role(id=5, organization_id=1, name="Change Manager"),
            Role(id=6, organization_id=2, name="System Administrator"),
            Role(id=7, organization_id=2, name="Requester"),
            Role(id=8, organization_id=3, name="System Administrator"),
            Role(id=9, organization_id=3, name="Requester"),
            Role(id=10, organization_id=1, name="Unknown Legacy Role"),
            Department(id=1, organization_id=1, name="Department One"),
            Department(id=2, organization_id=2, name="Department Two"),
        ])
        db.flush()
        for uid, org, role, email, password, active in (
            (1, 1, 2, "admin@one.example", original_password_hash, "active"),
            (2, 1, 3, "requester@one.example", original_password_hash, "active"),
            (3, 2, 6, "admin@two.example", original_password_hash, "active"),
            (4, 1, 3, "Directory@one.example", None, "inactive"),
            (5, 2, 7, "directory@two.example", None, "inactive"),
            (6, 1, 2, "inactive@one.example", original_password_hash, "inactive"),
        ):
            db.add(User(id=uid, organization_id=org, role_id=role, full_name=f"Existing User {uid}",
                        email=email, password_hash=password, membership_source="legacy",
                        is_active=active, job_title="Preserve existing title"))
        db.flush()
        db.execute(sa.text("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT max(id) FROM users))"))
        db.commit()
        tokens = {uid: create_access_token(db.get(User, uid)) for uid in (1, 2, 3, 6)}

    def test_db():
        with Session(a1_pg_engine) as db:
            yield db
    app.dependency_overrides[get_db] = test_db
    try:
        yield SimpleNamespace(engine=a1_pg_engine, client=Client(), tokens=tokens)
    finally:
        app.dependency_overrides.pop(get_db, None)


def issue(workspace, actor=1, **changes):
    body = dict(email="new@one.example", role_id=3, department_id=1)
    body.update(changes)
    return workspace.client.request("POST", "/auth/invitations", headers=bearer(workspace.tokens[actor]), json=body)


@pytest.mark.parametrize("actor,expected", [(None, 401), (2, 403), (6, 401)])
def test_invitation_management_requires_active_tenant_administrator(invitations, actor, expected):
    headers = bearer(invitations.tokens[actor]) if actor else {}
    response = invitations.client.request("POST", "/auth/invitations", headers=headers,
                                           json={"email": "new@one.example", "role_id": 3})
    assert response.status_code == expected
    with Session(invitations.engine) as db:
        assert db.query(Invitation).count() == 0


def test_unconfigured_delivery_is_explicit_and_never_exposes_credentials(invitations):
    response = issue(invitations)
    assert response.status_code == 201
    data = response.json()
    assert (data["organization_id"], data["status"], data["delivery_status"]) == (1, "pending", "failed")
    assert not {"token", "token_hash", "password", "password_hash"} & data.keys()
    with Session(invitations.engine) as db:
        invitation = db.get(Invitation, data["id"])
        assert len(invitation.token_hash) == 64
        assert invitation.token_hash not in response.text
        assert invitation.delivery_attempts == 1
        assert db.query(User).count() == 6
        events = db.query(TenantAccessEvent).all()
        assert {event.action for event in events} == {"INVITATION_CREATED", "INVITATION_DELIVERY_FAILED"}
        assert invitation.token_hash not in json.dumps([event.event_metadata for event in events])


class RecordingMailer:
    def __init__(self, engine):
        self.engine = engine
        self.messages = []
        self.fail = False

    def send_invitation(self, message):
        # A separate connection must see the invitation before any delivery.
        with Session(self.engine) as db:
            assert db.get(Invitation, message.invitation_id) is not None
        self.messages.append(message)
        if self.fail:
            raise RuntimeError("Do not log provider exception " + message.token.get_secret_value())


@pytest.fixture
def mailbox(invitations):
    mailer = RecordingMailer(invitations.engine)
    app.dependency_overrides[get_invitation_mailer] = lambda: mailer
    try:
        yield mailer
    finally:
        app.dependency_overrides.pop(get_invitation_mailer, None)


def accept(workspace, invitation_token, **changes):
    body = dict(token=invitation_token, password="A3-new-safe-password", full_name="New Member")
    body.update(changes)
    return workspace.client.request("POST", "/auth/invitations/accept", json=body)


def raw_token(mailbox, index=-1):
    return mailbox.messages[index].token.get_secret_value()


def user_snapshot(engine):
    with engine.connect() as connection:
        return connection.execute(sa.select(User.__table__).order_by(User.id)).all()


def test_acceptance_creates_confirmed_member_and_requires_separate_workspace_login(invitations, mailbox):
    before = user_snapshot(invitations.engine)
    issued = issue(invitations)
    assert issued.status_code == 201
    token = raw_token(mailbox)
    result = accept(invitations, token)
    assert result.status_code == 200
    assert set(result.json()) == {"user_id", "organization_id", "status"}
    assert result.json()["status"] == "activated"
    assert "access_token" not in result.json()
    with Session(invitations.engine) as db:
        user = db.get(User, result.json()["user_id"])
        assert (user.organization_id, user.role_id, user.department_id) == (1, 3, 1)
        assert (user.membership_source, user.is_active) == ("invitation", "active")
        assert user.membership_confirmed_at is not None and user.email_verified_at is not None
        assert user.password_hash != "A3-new-safe-password"
        invitation = db.get(Invitation, issued.json()["id"])
        assert (invitation.status, invitation.accepted_user_id) == ("accepted", user.id)
        assert invitation.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert db.query(TenantAccessEvent).filter_by(action="MEMBERSHIP_ACTIVATED").count() == 1
    assert user_snapshot(invitations.engine)[:6] == before
    response = invitations.client.request("POST", "/auth/login", data={
        "tenant_slug": "tenant-1", "email": "new@one.example", "password": "A3-new-safe-password",
    })
    assert response.status_code == 200
    me = invitations.client.request("GET", "/auth/me", headers=bearer(response.json()["access_token"]))
    assert (me.status_code, me.json()["organization_id"]) == (200, 1)


@pytest.mark.parametrize("changes,expected", [
    ({"organization_id": 2}, 400), ({"role_id": 6}, 404), ({"role_id": 1}, 404),
    ({"department_id": 2}, 404), ({"role_id": 10}, 400),
    ({"purpose": "bootstrap"}, 400), ({"email": "  "}, 400),
    ({"email": "victim@one.example\r\nBcc:other@example.test"}, 400),
    ({"purpose": "directory_activation", "target_user_id": 5}, 409),
    ({"email": "requester@one.example"}, 409),
    ({"purpose": "directory_activation", "target_user_id": 2, "email": "requester@one.example"}, 409),
])
def test_invalid_or_foreign_assignment_never_issues_invitation(invitations, mailbox, changes, expected):
    before = user_snapshot(invitations.engine)
    assert issue(invitations, **changes).status_code == expected
    assert mailbox.messages == []
    assert user_snapshot(invitations.engine) == before
    with Session(invitations.engine) as db:
        assert db.query(Invitation).count() == 0


def test_same_email_can_be_invited_in_different_tenants(invitations, mailbox):
    first = issue(invitations, email=" Person@Example.test ")
    second = issue(invitations, actor=3, email="person@example.test", role_id=7, department_id=2)
    assert (first.status_code, second.status_code) == (201, 201)
    duplicate = issue(invitations, email="PERSON@example.test")
    assert duplicate.status_code == 409
    assert len(mailbox.messages) == 2


def test_listing_and_mutations_cannot_cross_tenants(invitations, mailbox):
    issued = issue(invitations)
    invitation_id = issued.json()["id"]
    headers = bearer(invitations.tokens[3])
    listed = invitations.client.request("GET", "/auth/invitations?organization_id=1", headers=headers)
    assert listed.status_code == 200 and listed.json() == []
    for operation in ("revoke", "resend"):
        assert invitations.client.request("POST", f"/auth/invitations/{invitation_id}/{operation}", headers=headers).status_code == 404
    listed = invitations.client.request("GET", "/auth/invitations", headers=bearer(invitations.tokens[1]))
    assert [row["id"] for row in listed.json()] == [invitation_id]
    assert raw_token(mailbox) not in listed.text
    assert "token_hash" not in listed.text


def test_resend_replaces_token_and_keeps_old_invitation_revoked(invitations, mailbox):
    first = issue(invitations)
    old_token = raw_token(mailbox)
    second = invitations.client.request("POST", f"/auth/invitations/{first.json()['id']}/resend", headers=bearer(invitations.tokens[1]))
    assert second.status_code == 201
    assert second.json()["id"] != first.json()["id"]
    assert raw_token(mailbox) != old_token
    assert accept(invitations, old_token).status_code == 400
    assert accept(invitations, raw_token(mailbox)).status_code == 200
    with Session(invitations.engine) as db:
        assert db.get(Invitation, first.json()["id"]).status == "revoked"


@pytest.mark.parametrize("state", ["expired", "revoked", "accepted"])
def test_expired_revoked_and_used_tokens_cannot_be_replayed(invitations, mailbox, state):
    issued = issue(invitations)
    token = raw_token(mailbox)
    if state == "expired":
        with Session(invitations.engine) as db:
            invitation = db.get(Invitation, issued.json()["id"])
            invitation.created_at = datetime.now(timezone.utc) - timedelta(days=2)
            invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            db.commit()
    elif state == "revoked":
        response = invitations.client.request("POST", f"/auth/invitations/{issued.json()['id']}/revoke", headers=bearer(invitations.tokens[1]))
        assert response.status_code == 200
    else:
        assert accept(invitations, token).status_code == 200
    before = user_snapshot(invitations.engine)
    rejected = accept(invitations, token)
    assert rejected.status_code == 400
    assert rejected.json() == {"detail": "Invitation is invalid or unavailable."}
    assert user_snapshot(invitations.engine) == before


def test_expired_pending_invitation_can_be_reissued_without_index_conflict(invitations, mailbox):
    first = issue(invitations)
    with Session(invitations.engine) as db:
        invitation = db.get(Invitation, first.json()["id"])
        invitation.created_at = datetime.now(timezone.utc) - timedelta(days=2)
        invitation.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
    listed = invitations.client.request("GET", "/auth/invitations", headers=bearer(invitations.tokens[1]))
    assert listed.json()[0]["status"] == "expired"
    assert issue(invitations).status_code == 201
    with Session(invitations.engine) as db:
        assert db.get(Invitation, first.json()["id"]).status == "expired"
        assert db.query(Invitation).filter_by(status="pending").count() == 1


def test_directory_activation_preserves_identity_and_profile(invitations, mailbox):
    before = user_snapshot(invitations.engine)
    issued = issue(invitations, purpose="directory_activation", target_user_id=4, email="directory@one.example", role_id=4)
    assert issued.status_code == 201
    response = accept(invitations, raw_token(mailbox), full_name="Cannot rewrite historical profile")
    assert response.status_code == 200 and response.json()["user_id"] == 4
    with Session(invitations.engine) as db:
        user = db.get(User, 4)
        assert (user.email, user.full_name, user.job_title) == ("Directory@one.example", "Existing User 4", "Preserve existing title")
        assert (user.role_id, user.department_id, user.membership_source, user.is_active) == (4, 1, "invitation", "active")
    after = user_snapshot(invitations.engine)
    assert after[:3] == before[:3] and after[4:] == before[4:]


@pytest.mark.parametrize("override", [{"organization_id": 2}, {"role_id": 6}, {"email": "attacker@example.test"}])
def test_acceptance_does_not_allow_assignment_overrides_or_echo_secrets(invitations, mailbox, override):
    assert issue(invitations).status_code == 201
    token = raw_token(mailbox)
    before = user_snapshot(invitations.engine)
    response = accept(invitations, token, **override)
    assert response.status_code == 400
    assert token not in response.text and "A3-new-safe-password" not in response.text
    assert user_snapshot(invitations.engine) == before


@pytest.mark.parametrize("change", ["role", "inactive"])
def test_acceptance_rechecks_inviter_authority(invitations, mailbox, change):
    assert issue(invitations).status_code == 201
    with Session(invitations.engine) as db:
        user = db.get(User, 1)
        if change == "role":
            user.role_id = 3
        else:
            user.is_active = "inactive"
        db.commit()
    assert accept(invitations, raw_token(mailbox)).status_code == 400
    with Session(invitations.engine) as db:
        assert db.query(User).count() == 6


def test_failed_delivery_can_be_retried_only_with_fresh_token_without_leaking_logs(invitations, mailbox, caplog):
    caplog.set_level("DEBUG")
    mailbox.fail = True
    first = issue(invitations)
    token = raw_token(mailbox)
    assert first.json()["delivery_status"] == "failed"
    mailbox.fail = False
    second = invitations.client.request("POST", f"/auth/invitations/{first.json()['id']}/resend", headers=bearer(invitations.tokens[1]))
    assert second.status_code == 201 and second.json()["delivery_status"] == "sent"
    assert accept(invitations, token).status_code == 400
    assert accept(invitations, raw_token(mailbox)).status_code == 200
    for message in mailbox.messages:
        assert message.token.get_secret_value() not in caplog.text
        assert message.token.get_secret_value() not in repr(message)
    assert "A3-new-safe-password" not in caplog.text


def test_invitation_ttl_is_shorter_for_administrator(invitations, mailbox):
    ordinary = issue(invitations)
    administrative = issue(invitations, email="new-admin@one.example", role_id=2)
    with Session(invitations.engine) as db:
        for response, hours in ((ordinary, 24), (administrative, 1)):
            invitation = db.get(Invitation, response.json()["id"])
            assert abs((invitation.expires_at - invitation.created_at).total_seconds() - hours * 3600) < 2
