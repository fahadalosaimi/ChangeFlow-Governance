"""Forced PostgreSQL interleavings for A3 security review corrections."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import time

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from a1_postgresql import a1_pg_engine, a1_postgres_url
from app.models.foundation import User
from app.models.invitation import OrganizationInvitation as Invitation
from test_a2_authentication import bearer
from test_a3_invitations import (
    accept, invitations, issue, mailbox, original_password_hash, raw_token, user_snapshot,
)


@pytest.mark.parametrize("operation", ["create", "accept"])
@pytest.mark.parametrize("actor", [1, 6])
def test_a2_role_update_and_directory_invitation_do_not_deadlock(invitations, mailbox, operation, actor):
    """Hold A3's role lock until A2 either waits in PostgreSQL or commits.

    Before the correction the wait graph is A3 -> directory user -> A2 ->
    role/actor -> A3; PostgreSQL raises SQLSTATE 40P01. These are actual HTTP
    handlers and FK checks, not simulated lock acquisition.
    """
    # Use a second administrator so an actor FK cannot hide the role/user cycle.
    with Session(invitations.engine) as db:
        db.get(User, 6).is_active = "active"
        db.commit()
    changes = dict(purpose="directory_activation", target_user_id=4,
                   email="directory@one.example", role_id=4)
    if operation == "accept":
        assert issue(invitations, **changes).status_code == 201
        token = raw_token(mailbox)
    before = user_snapshot(invitations.engine)
    role_locked, update_started, update_finished = Event(), Event(), Event()
    pids, observed_wait = {}, []

    def before_sql(connection, cursor, statement, parameters, context, many):
        if statement.startswith(("UPDATE users SET", "INSERT INTO user_administration_audit_logs")) and not update_started.is_set():
            cursor.execute("SELECT pg_backend_pid()")
            pids["a2"] = cursor.fetchone()[0]
            update_started.set()

    def after_sql(connection, cursor, statement, parameters, context, many):
        if "FROM roles" not in statement or "FOR " not in statement or role_locked.is_set():
            return
        pids["a3"] = connection.connection.driver_connection.get_backend_pid()
        role_locked.set()
        assert update_started.wait(10)
        deadline = time.monotonic() + 10
        with invitations.engine.connect() as observer:
            while not update_finished.is_set():
                blockers = observer.scalar(sa.text("SELECT pg_blocking_pids(:pid)"), {"pid": pids["a2"]})
                if pids["a3"] in blockers:
                    observed_wait.append(True)
                    break
                assert time.monotonic() < deadline, "A2 neither committed nor waited on A3"
                time.sleep(0.01)

    def invitation_request():
        try:
            return accept(invitations, token) if operation == "accept" else issue(invitations, **changes)
        except Exception as error:
            return type(error).__name__, getattr(getattr(error, "orig", None), "pgcode", None)

    def administration_request():
        try:
            return invitations.client.request("PATCH", "/auth/admin/users/4",
                headers=bearer(invitations.tokens[actor]), json={"role_name": "CMDB Manager"})
        except Exception as error:
            return type(error).__name__, getattr(getattr(error, "orig", None), "pgcode", None)
        finally:
            update_finished.set()

    sa.event.listen(invitations.engine, "before_cursor_execute", before_sql)
    sa.event.listen(invitations.engine, "after_cursor_execute", after_sql)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            a3 = pool.submit(invitation_request)
            assert role_locked.wait(10)
            a2 = pool.submit(administration_request)
            results = [a3.result(timeout=25), a2.result(timeout=25)]
        outcomes = [getattr(result, "status_code", result) for result in results]
        assert outcomes == [200 if operation == "accept" else 201, 200], outcomes
    finally:
        sa.event.remove(invitations.engine, "before_cursor_execute", before_sql)
        sa.event.remove(invitations.engine, "after_cursor_execute", after_sql)
    after = user_snapshot(invitations.engine)
    assert [row for row in after if row.id != 4] == [row for row in before if row.id != 4]
    with Session(invitations.engine) as db:
        target = db.get(User, 4)
        assert target.role_id == 4
        assert db.query(Invitation).count() == 1
        invitation = db.query(Invitation).one()
        if operation == "accept":
            assert target.password_hash and target.membership_confirmed_at and target.email_verified_at
            assert invitation.status == "accepted" and invitation.accepted_user_id == 4
        else:
            assert target.password_hash is None and invitation.status == "pending"


@pytest.mark.parametrize("authority", ["role", "inviter"])
def test_invitation_locks_still_prevent_concurrent_authority_changes(invitations, mailbox, authority):
    """Weaker FK-compatible locks must still block actual authority UPDATEs."""
    locked, started = Event(), Event()
    pids = {}

    def after_sql(connection, cursor, statement, parameters, context, many):
        if "FROM roles" not in statement or "FOR SHARE" not in statement or locked.is_set():
            return
        pids["invitation"] = connection.connection.driver_connection.get_backend_pid()
        locked.set()
        assert started.wait(10)
        with invitations.engine.connect() as observer:
            deadline = time.monotonic() + 10
            while pids["invitation"] not in observer.scalar(sa.text("SELECT pg_blocking_pids(:pid)"), {"pid": pids["mutation"]}):
                assert time.monotonic() < deadline, "authority mutation was not blocked"
                time.sleep(0.01)

    def change_authority():
        with Session(invitations.engine) as db:
            pids["mutation"] = db.scalar(sa.select(sa.func.pg_backend_pid()))
            started.set()
            if authority == "role":
                from app.models.foundation import Role
                db.execute(sa.update(Role).where(Role.id == 3).values(name="Unsupported role"))
            else:
                db.execute(sa.update(User).where(User.id == 1).values(is_active="inactive"))
            db.commit()

    sa.event.listen(invitations.engine, "after_cursor_execute", after_sql)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            issuing = pool.submit(issue, invitations)
            assert locked.wait(10)
            changing = pool.submit(change_authority)
            assert issuing.result(timeout=25).status_code == 201
            changing.result(timeout=25)
    finally:
        sa.event.remove(invitations.engine, "after_cursor_execute", after_sql)
    before = user_snapshot(invitations.engine)
    assert accept(invitations, raw_token(mailbox)).status_code == 400
    assert user_snapshot(invitations.engine) == before
