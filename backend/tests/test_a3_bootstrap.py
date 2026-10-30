"""Bootstrap approval is cryptographic and bound to an OS operator and target."""
import base64
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import subprocess
import sys

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import pytest
from sqlalchemy.orm import Session

from a1_postgresql import a1_pg_engine, a1_postgres_url
from app.models.foundation import User
from app.models.invitation import OrganizationInvitation as Invitation
from app.models.tenant_access_event import TenantAccessEvent
from test_a3_invitations import (
    accept, invitations, mailbox, original_password_hash, raw_token, user_snapshot,
)


def test_bootstrap_cli_fails_closed_before_touching_database_without_approval(tmp_path):
    script = Path(__file__).resolve().parents[1] / "bootstrap_tenant.py"
    result = subprocess.run([
        sys.executable, "-B", str(script), "--organization-id", "3", "--email", "first@new.example",
        "--manifest", str(tmp_path / "missing-approval.json"),
    ], capture_output=True, text=True, timeout=30)
    assert result.returncode == 2
    assert "Bootstrap authorization failed." in result.stderr
    assert result.stdout == ""


def test_bootstrap_cli_does_not_echo_accidentally_supplied_credentials(tmp_path):
    script = Path(__file__).resolve().parents[1] / "bootstrap_tenant.py"
    result = subprocess.run([
        sys.executable, "-B", str(script), "--organization-id", "3", "--email", "first@new.example",
        "--manifest", str(tmp_path / "missing.json"), "--password", "DO-NOT-ECHO-THIS-TEST-SECRET",
    ], capture_output=True, text=True, timeout=30)
    assert result.returncode == 2
    assert "DO-NOT-ECHO-THIS-TEST-SECRET" not in result.stderr + result.stdout


@pytest.fixture
def approval():
    from app.services.bootstrap_authorization import BootstrapPolicy
    private = Ed25519PrivateKey.generate()
    public = private.public_key().public_bytes(Encoding.Raw, PublicFormat.Raw)
    policy = BootstrapPolicy(key_id="a3-test-key", public_key=public, operators=frozenset({"test-operator"}),
                             deployment_id="a3-isolated-test")
    now = datetime.now(timezone.utc)
    payload = dict(
        action="tenant_bootstrap", deployment_id="a3-isolated-test", key_id="a3-test-key", authorization_id="test-approval-001",
        operator_id="test-operator", organization_id=3, email="first@new.example", role_id=8,
        department_id=None, issued_at=(now - timedelta(seconds=5)).isoformat(),
        expires_at=(now + timedelta(minutes=30)).isoformat(),
    )

    def signed(**changes):
        body = {**payload, **changes}
        canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        return {"payload": body, "signature": base64.b64encode(private.sign(canonical)).decode()}
    return policy, signed


@pytest.mark.parametrize("case", ["tampered", "wrong-operator", "unlisted-operator", "wrong-tenant",
                                      "wrong-email", "expired", "future-issued", "overlong", "wrong-action", "wrong-key"])
def test_bootstrap_approval_cannot_be_forged_or_retargeted(approval, case):
    from app.services.bootstrap_authorization import BootstrapAuthorizationError, BootstrapPolicy, verify_approval
    policy, signed = approval
    document, operator, organization_id, email = signed(), "test-operator", 3, "first@new.example"
    if case == "tampered":
        document["payload"]["role_id"] = 2
    elif case == "wrong-operator":
        operator = "different-operator"
    elif case == "unlisted-operator":
        policy = BootstrapPolicy(policy.key_id, policy.public_key, frozenset({"other"}), policy.deployment_id)
    elif case == "wrong-tenant":
        organization_id = 1
    elif case == "wrong-email":
        email = "other@new.example"
    elif case == "expired":
        document = signed(expires_at=(datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat())
    elif case == "future-issued":
        document = signed(issued_at=(datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat())
    elif case == "overlong":
        document = signed(expires_at=(datetime.now(timezone.utc) + timedelta(hours=2)).isoformat())
    elif case == "wrong-action":
        document = signed(action="recovery")
    else:
        document = signed(key_id="untrusted-key")
    with pytest.raises(BootstrapAuthorizationError):
        verify_approval(document, policy, operator, organization_id, email)


def test_authorized_bootstrap_issues_email_proof_and_creates_only_first_admin(invitations, mailbox, approval):
    from app.services.bootstrap_authorization import verify_approval
    from app.services.invitation_service import create_bootstrap_invitation
    policy, signed = approval
    grant = verify_approval(signed(), policy, "test-operator", 3, "first@new.example")
    before = user_snapshot(invitations.engine)
    with Session(invitations.engine) as db:
        result = create_bootstrap_invitation(db, grant, mailbox)
        assert (result.purpose, result.organization_id, result.delivery_status) == ("bootstrap", 3, "sent")
    assert user_snapshot(invitations.engine) == before  # issue does not activate anyone
    accepted = accept(invitations, raw_token(mailbox))
    assert accepted.status_code == 200
    assert "access_token" not in accepted.json()
    with Session(invitations.engine) as db:
        user = db.get(User, accepted.json()["user_id"])
        assert (user.organization_id, user.role_id, user.membership_source) == (3, 8, "bootstrap")
        assert user.email_verified_at is not None and user.membership_confirmed_at is not None
        bootstrap_events = db.query(TenantAccessEvent).filter_by(source="bootstrap").all()
        assert {event.bootstrap_authorization_id for event in bootstrap_events} == {"test-approval-001"}
        assert {event.action for event in bootstrap_events} == {"BOOTSTRAP_INVITATION_CREATED", "MEMBERSHIP_ACTIVATED"}
        issuance = next(event for event in bootstrap_events if event.action == "BOOTSTRAP_INVITATION_CREATED")
        assert issuance.event_metadata["deployment_id"] == "a3-isolated-test"


@pytest.mark.parametrize("case", ["active-admin", "inactive-admin", "existing-account", "foreign-role", "non-admin-role", "foreign-department"])
def test_bootstrap_cannot_reset_accounts_recover_or_assign_foreign_roles(invitations, mailbox, approval, case):
    from fastapi import HTTPException
    from app.services.bootstrap_authorization import verify_approval
    from app.services.invitation_service import create_bootstrap_invitation
    policy, signed = approval
    changes = {}
    if case in {"active-admin", "inactive-admin"}:
        changes = dict(organization_id=1, role_id=2)
        if case == "inactive-admin":
            with Session(invitations.engine) as db:
                db.get(User, 1).is_active = "inactive"
                db.commit()
    elif case == "existing-account":
        with Session(invitations.engine) as db:
            db.add(User(organization_id=3, role_id=9, full_name="Existing New Tenant User",
                        email="first@new.example", password_hash=None, membership_source="legacy", is_active="inactive"))
            db.commit()
    elif case == "foreign-role":
        changes = dict(role_id=2)
    elif case == "non-admin-role":
        changes = dict(role_id=9)
    else:
        changes = dict(department_id=2)
    document = signed(**changes)
    grant = verify_approval(document, policy, "test-operator", document["payload"]["organization_id"], "first@new.example")
    before = user_snapshot(invitations.engine)
    with Session(invitations.engine) as db, pytest.raises(HTTPException):
        create_bootstrap_invitation(db, grant, mailbox)
    assert user_snapshot(invitations.engine) == before
    assert mailbox.messages == []


def test_bootstrap_authorization_reference_is_not_reusable(invitations, mailbox, approval):
    from fastapi import HTTPException
    from app.services.bootstrap_authorization import verify_approval
    from app.services.invitation_service import create_bootstrap_invitation
    policy, signed = approval
    grant = verify_approval(signed(), policy, "test-operator", 3, "first@new.example")
    with Session(invitations.engine) as db:
        create_bootstrap_invitation(db, grant, mailbox)
    with Session(invitations.engine) as db, pytest.raises(HTTPException):
        create_bootstrap_invitation(db, grant, mailbox)
    assert len(mailbox.messages) == 1


def test_new_bootstrap_approval_can_replace_failed_delivery_without_recovery(invitations, mailbox, approval):
    from app.services.bootstrap_authorization import verify_approval
    from app.services.invitation_service import create_bootstrap_invitation
    policy, signed = approval
    mailbox.fail = True
    with Session(invitations.engine) as db:
        first = create_bootstrap_invitation(db, verify_approval(signed(), policy, "test-operator", 3, "first@new.example"), mailbox)
    old_token = raw_token(mailbox)
    mailbox.fail = False
    with Session(invitations.engine) as db:
        second = create_bootstrap_invitation(db, verify_approval(signed(authorization_id="test-approval-002"), policy, "test-operator", 3, "first@new.example"), mailbox)
        assert first.id != second.id
        assert db.get(Invitation, first.id).status == "revoked"
    assert accept(invitations, old_token).status_code == 400
    assert accept(invitations, raw_token(mailbox)).status_code == 200


def test_cli_uses_verified_operator_approval_and_never_prints_invitation_token(
    invitations, mailbox, approval, monkeypatch, tmp_path, capsys,
):
    import bootstrap_tenant
    from app import database
    from app.services import bootstrap_authorization, invitation_mailer
    policy, signed = approval
    manifest = tmp_path / "signed-non-secret-approval.json"
    manifest.write_text(json.dumps(signed()), encoding="utf-8")
    monkeypatch.setattr(bootstrap_authorization, "load_bootstrap_policy", lambda: policy)
    monkeypatch.setattr(bootstrap_authorization, "current_operator_id", lambda: "test-operator")
    monkeypatch.setattr(database, "SessionLocal", lambda: Session(invitations.engine))
    monkeypatch.setattr(invitation_mailer, "get_invitation_mailer", lambda: mailbox)
    result = bootstrap_tenant.main(["--organization-id", "3", "--email", "first@new.example", "--manifest", str(manifest)])
    assert result == 0
    captured = capsys.readouterr()
    output = json.loads(captured.out)
    assert set(output) == {"invitation_id", "organization_id", "status", "delivery_status"}
    assert output["organization_id"] == 3 and output["delivery_status"] == "sent"
    assert raw_token(mailbox) not in captured.out + captured.err
    assert user_snapshot(invitations.engine)[-1].id == 6


def test_unapproved_cli_never_opens_database(invitations, monkeypatch, tmp_path, capsys):
    import bootstrap_tenant
    from app import database
    from app.services.bootstrap_authorization import BootstrapAuthorizationError

    def denied(*args):
        raise BootstrapAuthorizationError("synthetic denial")

    def forbidden():
        raise AssertionError("Database must not be opened")

    monkeypatch.setattr(bootstrap_tenant, "authorize_bootstrap", denied)
    monkeypatch.setattr(database, "SessionLocal", forbidden)
    assert bootstrap_tenant.main(["--organization-id", "3", "--email", "first@new.example",
                                  "--manifest", str(tmp_path / "missing")]) == 2
    assert capsys.readouterr().err == "Bootstrap authorization failed.\n"
