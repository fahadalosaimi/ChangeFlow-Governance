"""Bootstrap consumption, rollback and forced lock contention on owned PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import time

from fastapi import HTTPException
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from a1_postgresql import a1_pg_engine, a1_postgres_url
from app.models.foundation import Role, User
from app.models.invitation import OrganizationInvitation as Invitation
from app.models.tenant_access_event import TenantAccessEvent
from app.services.bootstrap_authorization import verify_approval
from app.services.invitation_service import create_bootstrap_invitation
from test_a3_bootstrap import approval
from test_a3_invitations import accept, invitations, mailbox, original_password_hash, raw_token, user_snapshot


def grant(approval, **changes):
    policy, signed = approval
    document = signed(**changes)
    return verify_approval(document, policy, "test-operator", document["payload"]["organization_id"],
                           document["payload"]["email"])


def provision(workspace, authorization, mailer):
    try:
        with Session(workspace.engine) as db:
            return create_bootstrap_invitation(db, authorization, mailer)
    except HTTPException as error:
        return error


def code(result):
    return getattr(result, "status_code", 201)


def administrators(db):
    return db.query(User).join(Role, User.role_id == Role.id).filter(
        User.organization_id == 3, Role.organization_id == 3,
        Role.name == "System Administrator", User.is_active == "active").all()


def forced_overlap(engine, first, second):
    """Second transaction demonstrably waits on the first's organization lock."""
    locked, waiting = Event(), Event()
    pids = {}

    def is_lock(statement):
        return "FROM organizations" in statement and "FOR NO KEY UPDATE" in statement

    def before(connection, cursor, statement, params, context, many):
        if is_lock(statement):
            pid = connection.connection.driver_connection.get_backend_pid()
            if "first" not in pids:
                pids["first"] = pid
            elif pid != pids["first"]:
                pids["second"] = pid
                waiting.set()

    def after(connection, cursor, statement, params, context, many):
        if not is_lock(statement) or connection.connection.driver_connection.get_backend_pid() != pids["first"]:
            return
        locked.set()
        assert waiting.wait(10)
        with engine.connect() as observer:
            deadline = time.monotonic() + 10
            while pids["first"] not in observer.scalar(sa.text("SELECT pg_blocking_pids(:pid)"), {"pid": pids["second"]}):
                assert time.monotonic() < deadline, "second bootstrap did not contend for organization lock"
                time.sleep(0.01)

    sa.event.listen(engine, "before_cursor_execute", before)
    sa.event.listen(engine, "after_cursor_execute", after)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            lead = pool.submit(first)
            assert locked.wait(10)
            follower = pool.submit(second)
            return lead.result(timeout=30), follower.result(timeout=30)
    finally:
        sa.event.remove(engine, "before_cursor_execute", before)
        sa.event.remove(engine, "after_cursor_execute", after)


def test_same_approval_concurrent_bootstrap_is_issued_and_activated_only_once(invitations, mailbox, approval):
    authorization = grant(approval)
    before = user_snapshot(invitations.engine)
    results = forced_overlap(invitations.engine,
        lambda: provision(invitations, authorization, mailbox), lambda: provision(invitations, authorization, mailbox))
    assert [code(item) for item in results] == [201, 409]
    assert len(mailbox.messages) == 1 and user_snapshot(invitations.engine) == before
    with Session(invitations.engine) as db:
        assert db.query(Invitation).count() == 1 and not administrators(db)
        assert db.query(TenantAccessEvent).filter_by(action="BOOTSTRAP_INVITATION_CREATED").count() == 1
    assert accept(invitations, raw_token(mailbox)).status_code == 200
    assert accept(invitations, raw_token(mailbox)).status_code == 400
    with Session(invitations.engine) as db:
        assert len(administrators(db)) == 1
        assert db.query(TenantAccessEvent).filter_by(action="MEMBERSHIP_ACTIVATED").count() == 1
    assert user_snapshot(invitations.engine)[:6] == before


@pytest.mark.parametrize("state", ["revoked", "expired", "replaced"])
def test_approval_remains_consumed_after_lifecycle_changes(invitations, mailbox, approval, state):
    authorization = grant(approval)
    first = provision(invitations, authorization, mailbox)
    old_token = raw_token(mailbox)
    if state == "replaced":
        second = provision(invitations, grant(approval, authorization_id="new-approval-002"), mailbox)
        assert code(second) == 201
    else:
        # Bootstrap has no admin revoke/resend endpoint. Model a separately
        # authorized operational cancellation/expiry only in this owned schema.
        with Session(invitations.engine) as db:
            invitation = db.get(Invitation, first.id)
            if state == "revoked":
                invitation.status, invitation.revoked_at = "revoked", db.scalar(sa.select(sa.func.clock_timestamp()))
            else:
                db.execute(sa.text("UPDATE organization_invitations SET created_at=clock_timestamp()-interval '2 hours', "
                    "expires_at=clock_timestamp()-interval '1 hour', status='expired' WHERE id=:id"), {"id": first.id})
            db.commit()
    before = user_snapshot(invitations.engine)
    delivered = len(mailbox.messages)
    assert code(provision(invitations, authorization, mailbox)) == 409
    assert accept(invitations, old_token).status_code == 400
    assert user_snapshot(invitations.engine) == before and len(mailbox.messages) == delivered
    with Session(invitations.engine) as db:
        assert not administrators(db)
        assert db.query(Invitation).count() == (2 if state == "replaced" else 1)
        assert db.query(TenantAccessEvent).filter_by(action="BOOTSTRAP_INVITATION_CREATED").count() == delivered
    if state == "replaced":
        assert accept(invitations, raw_token(mailbox)).status_code == 200
        with Session(invitations.engine) as db:
            assert len(administrators(db)) == 1


@pytest.mark.parametrize("winner", ["replacement", "acceptance"])
def test_bootstrap_replacement_and_old_token_acceptance_have_atomic_final_state(invitations, mailbox, approval, winner):
    first = provision(invitations, grant(approval), mailbox)
    old_token = raw_token(mailbox)
    before = user_snapshot(invitations.engine)
    replacement = lambda: provision(invitations, grant(approval, authorization_id="replacement-002"), mailbox)
    acceptance = lambda: accept(invitations, old_token)
    leading, following = forced_overlap(invitations.engine,
        replacement if winner == "replacement" else acceptance,
        acceptance if winner == "replacement" else replacement)
    assert [code(leading), code(following)] == ([201, 400] if winner == "replacement" else [200, 409])
    with Session(invitations.engine) as db:
        old = db.get(Invitation, first.id)
        assert old.status == ("revoked" if winner == "replacement" else "accepted")
        assert len(administrators(db)) == (0 if winner == "replacement" else 1)
        assert db.query(Invitation).count() == (2 if winner == "replacement" else 1)
        assert db.query(Invitation).filter_by(status="pending").count() == (1 if winner == "replacement" else 0)
    if winner == "replacement":
        assert accept(invitations, raw_token(mailbox)).status_code == 200
    assert accept(invitations, old_token).status_code == 400
    with Session(invitations.engine) as db:
        assert len(administrators(db)) == 1
        assert db.query(TenantAccessEvent).filter_by(action="MEMBERSHIP_ACTIVATED").count() == 1
    assert user_snapshot(invitations.engine)[:6] == before


@pytest.mark.parametrize("operation", ["issue", "accept"])
@pytest.mark.parametrize("failure", ["audit", "transaction"])
def test_bootstrap_failure_rolls_back_membership_consumption_and_approval(invitations, mailbox, approval, operation, failure):
    authorization = grant(approval)
    if operation == "accept":
        first = provision(invitations, authorization, mailbox)
        token = raw_token(mailbox)
    before, deliveries = user_snapshot(invitations.engine), len(mailbox.messages)
    action = "BOOTSTRAP_INVITATION_CREATED" if operation == "issue" else "MEMBERSHIP_ACTIVATED"

    def fail_audit(mapper, connection, target):
        if target.action == action:
            raise RuntimeError("synthetic bootstrap audit failure")

    def fail_transaction(db):
        if db.get_bind() is invitations.engine:
            db.execute(sa.text("SELECT 1/0"))  # actual PostgreSQL transaction failure

    target, name, listener = ((TenantAccessEvent, "before_insert", fail_audit) if failure == "audit"
        else (Session, "before_commit", fail_transaction))
    sa.event.listen(target, name, listener)
    try:
        with pytest.raises(RuntimeError if failure == "audit" else sa.exc.DBAPIError):
            if operation == "issue":
                provision(invitations, authorization, mailbox)
            else:
                accept(invitations, token)
    finally:
        sa.event.remove(target, name, listener)
    assert user_snapshot(invitations.engine) == before and len(mailbox.messages) == deliveries
    with Session(invitations.engine) as db:
        assert not administrators(db)
        assert db.query(TenantAccessEvent).filter_by(action="MEMBERSHIP_ACTIVATED").count() == 0
        assert db.query(Invitation).count() == (0 if operation == "issue" else 1)
        if operation == "accept":
            row = db.get(Invitation, first.id)
            assert (row.status, row.accepted_user_id, row.consumed_at) == ("pending", None, None)
    if operation == "issue":
        assert code(provision(invitations, authorization, mailbox)) == 201
        token = raw_token(mailbox)
    assert accept(invitations, token).status_code == 200
    with Session(invitations.engine) as db:
        assert len(administrators(db)) == 1


@pytest.mark.parametrize("email", ["admin@one.example", "directory@one.example"])
def test_bootstrap_does_not_activate_or_reset_same_email_in_another_tenant(invitations, mailbox, approval, email):
    before = user_snapshot(invitations.engine)
    assert code(provision(invitations, grant(approval, email=email), mailbox)) == 201
    result = accept(invitations, raw_token(mailbox))
    assert result.status_code == 200 and result.json()["organization_id"] == 3
    assert user_snapshot(invitations.engine)[:6] == before
    with Session(invitations.engine) as db:
        assert len(administrators(db)) == 1
        user = db.get(User, result.json()["user_id"])
        assert (user.organization_id, user.role_id, user.email) == (3, 8, email)
    for tenant, status in (("tenant-1", 401), ("tenant-3", 200)):
        response = invitations.client.request("POST", "/auth/login", data=dict(
            tenant_slug=tenant, email=email, password="A3-new-safe-password"))
        assert response.status_code == status
