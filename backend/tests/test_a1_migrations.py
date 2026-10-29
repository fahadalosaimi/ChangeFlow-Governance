from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import hashlib
import threading
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy.exc import IntegrityError

from a1_postgresql import a1_postgres_url, a1_pg_engine, migrate, downgrade
from a1_legacy_fixture import seed_legacy
from migrations.tenant_identity_a1 import (
    INITIAL_REVISION, LEGACY_TABLES, PreservationError,
    capture_legacy_state, preflight, verify_legacy_state,
)
from app.database import Base
from app.models import foundation, change_management, change_execution, notification, invitation, tenant_access_event


@pytest.fixture
def migrated(a1_pg_engine):
    with a1_pg_engine.begin() as c:
        migrate(c, INITIAL_REVISION)
        seed_legacy(c)
        migrate(c)
    return a1_pg_engine


def reflect(connection, name):
    return sa.Table(name, sa.MetaData(), autoload_with=connection)


def role_id(connection, org=1, name="Requester"):
    return connection.scalar(sa.text("SELECT id FROM roles WHERE organization_id=:org AND name=:name"), {"org": org, "name": name})


def user_values(connection, uid=501, org=1, email="new@example.test", **extra):
    return dict(id=uid, organization_id=org, role_id=role_id(connection, org), full_name="Synthetic",
                email=email, membership_source="legacy", is_active="active", created_at=datetime(2026, 8, 1), **extra)


def invitation_values(connection, iid=501, **extra):
    now = datetime.now(timezone.utc)
    values = dict(id=iid, organization_id=1, email="invite@example.test", role_id=role_id(connection),
                  invited_by=10, purpose="membership", token_hash=hashlib.sha256(f"synthetic-{iid}".encode()).hexdigest(),
                  created_at=now, expires_at=now + timedelta(hours=1), status="pending", delivery_status="pending", delivery_attempts=0)
    values.update(extra)
    return values


def test_empty_database_migrates_to_model_schema(a1_pg_engine):
    with a1_pg_engine.begin() as c:
        migrate(c)
        assert c.scalar(sa.text("SELECT version_num FROM alembic_version")) == "a1_03_identity_enforce"
        assert not compare_metadata(MigrationContext.configure(c, opts={"compare_type": True, "compare_server_default": True}), Base.metadata)


def test_initial_migration_is_unchanged():
    original = Path(__file__).resolve().parents[1] / "migrations/versions/54c5a5c8470d_initial_changeflow_schema.py"
    assert hashlib.sha256(original.read_bytes()).hexdigest() == "6652a45395c842d9eedfa10053127baeb64bfdd80bb8aa9787df00c17ac117ca"


def test_every_legacy_table_and_account_is_preserved(a1_pg_engine):
    with a1_pg_engine.begin() as c:
        migrate(c, INITIAL_REVISION)
        seed_legacy(c)
        snapshot = capture_legacy_state(c)
        assert all(snapshot.rows[name] for name in LEGACY_TABLES)
        migrate(c)
        verify_legacy_state(c, snapshot)
        assert c.execute(sa.text("SELECT id, slug FROM organizations ORDER BY id")).all() == [(1, "org-1"), (2, "org-2")]
        assert c.scalar(sa.text("SELECT count(*) FROM roles WHERE organization_id IS NULL")) == 4
        assert c.scalar(sa.text("SELECT count(*) FROM roles WHERE organization_id IS NOT NULL")) == 8
        assert c.scalar(sa.text("SELECT count(*) FROM users WHERE membership_source='legacy' AND email_verified_at IS NULL AND membership_confirmed_at IS NULL")) == 5
        assert c.execute(sa.text("SELECT password_hash, is_active FROM users WHERE id=12")).one() == (None, "inactive")


@pytest.mark.parametrize("mutation, category", [
    ("UPDATE users SET email='PERSON@example.test' WHERE id=10", "duplicate_tenant_email_ci"),
    ("UPDATE users SET department_id=2 WHERE id=11", "users_department_id_tenant"),
    ("UPDATE it_systems SET owner_id=20 WHERE id=101", "it_systems_owner_id_tenant"),
    ("UPDATE it_systems SET service_id=2 WHERE id=101", "it_systems_service_id_tenant"),
    ("UPDATE it_services SET department_id=2 WHERE id=1", "it_services_department_id_tenant"),
    ("UPDATE managed_change_requests SET requester_id=20 WHERE id=1001", "managed_change_requests_requester_id_tenant"),
    ("UPDATE system_dependencies SET target_system_id=201 WHERE id=1", "dependency_tenant"),
    ("UPDATE notifications SET recipient_id=20 WHERE id=1", "notifications_recipient_id_tenant"),
    ("UPDATE change_approvals SET approver_id=20 WHERE id=1", "change_approvals_approver_id_tenant"),
    ("UPDATE managed_change_affected_systems SET system_id=201 WHERE id=1", "managed_change_affected_systems_system_id_tenant"),
    ("UPDATE user_administration_audit_logs SET actor_id=20 WHERE id=1", "user_administration_audit_tenant"),
])
def test_preflight_stops_without_partial_migration(a1_pg_engine, mutation, category):
    with a1_pg_engine.begin() as c:
        migrate(c, INITIAL_REVISION)
        seed_legacy(c)
        c.execute(sa.text(mutation))
    with pytest.raises(PreservationError, match=category):
        with a1_pg_engine.begin() as c:
            migrate(c)
    with a1_pg_engine.connect() as c:
        assert c.scalar(sa.text("SELECT version_num FROM alembic_version")) == INITIAL_REVISION
        assert "slug" not in {column["name"] for column in sa.inspect(c).get_columns("organizations")}
        assert c.scalar(sa.text("SELECT count(*) FROM users")) == 5


def test_preservation_failure_rolls_back_backfill(a1_pg_engine, monkeypatch):
    with a1_pg_engine.begin() as c:
        migrate(c, INITIAL_REVISION)
        seed_legacy(c)
    def fail_check(*args):
        raise PreservationError("Injected preservation failure")
    monkeypatch.setattr("migrations.tenant_identity_a1.verify_legacy_state", fail_check)
    with pytest.raises(PreservationError, match="Injected"):
        with a1_pg_engine.begin() as c:
            migrate(c)
    with a1_pg_engine.connect() as c:
        assert c.scalar(sa.text("SELECT count(*) FROM roles")) == 4
        assert c.scalar(sa.text("SELECT role_id FROM users WHERE id=11")) == 2
        assert c.scalar(sa.text("SELECT version_num FROM alembic_version")) == INITIAL_REVISION


def test_preservation_detects_role_copy_permission_changes(a1_pg_engine):
    with a1_pg_engine.begin() as c:
        migrate(c, INITIAL_REVISION)
        seed_legacy(c)
        snapshot = capture_legacy_state(c)
        migrate(c)
        c.execute(sa.text("UPDATE roles SET name='Changed Privilege' WHERE organization_id=1 AND name='Requester'"))
        with pytest.raises(PreservationError, match="role copy differs"):
            verify_legacy_state(c, snapshot)


@pytest.mark.parametrize("email", ["PERSON@example.test", " Person@example.test "])
def test_email_uniqueness_is_case_insensitive_inside_tenant(migrated, email):
    with pytest.raises(IntegrityError) as error:
        with migrated.begin() as c:
            c.execute(reflect(c, "users").insert().values(**user_values(c, email=email)))
    assert error.value.orig.pgcode == "23505"


def test_email_unicode_and_cross_tenant_independence(migrated):
    with migrated.begin() as c:
        u = reflect(c, "users")
        c.execute(u.insert().values(**user_values(c, email="ÉLODIE@example.test")))
        c.execute(u.insert().values(**user_values(c, uid=502, org=2, email="ÉLODIE@example.test")))
    with pytest.raises(IntegrityError):
        with migrated.begin() as c:
            c.execute(reflect(c, "users").insert().values(**user_values(c, uid=503, email="élodie@example.test")))


@pytest.mark.parametrize("table, field, foreign_id", [
    ("users", "role_id", "role"), ("users", "department_id", 2),
    ("it_services", "department_id", 2),
    ("it_systems", "department_id", 2), ("it_systems", "service_id", 2), ("it_systems", "owner_id", 20),
])
def test_existing_core_relationships_reject_cross_tenant_writes(migrated, table, field, foreign_id):
    with pytest.raises(IntegrityError) as error:
        with migrated.begin() as c:
            target = reflect(c, table)
            value = role_id(c, 2) if foreign_id == "role" else foreign_id
            c.execute(target.update().where(target.c.id == {"users": 11, "it_services": 1, "it_systems": 101}[table]).values(**{field: value}))
    assert error.value.orig.pgcode == "23503"


@pytest.mark.parametrize("field, value", [("role_id", "role"), ("department_id", 2), ("invited_by", 20), ("target_user_id", 20), ("accepted_user_id", 20)])
def test_invitation_references_are_tenant_bound(migrated, field, value):
    with pytest.raises(IntegrityError) as error:
        with migrated.begin() as c:
            changes = {field: role_id(c, 2) if value == "role" else value}
            if field == "target_user_id":
                changes["purpose"] = "directory_activation"
            if field == "accepted_user_id":
                changes.update(status="accepted", consumed_at=datetime.now(timezone.utc))
                values = invitation_values(c, **changes)
                values["consumed_at"] = values["created_at"]
            else:
                values = invitation_values(c, **changes)
            c.execute(reflect(c, "organization_invitations").insert().values(**values))
    assert error.value.orig.pgcode == "23503"


def test_activation_and_bootstrap_require_evidence(migrated):
    with pytest.raises(IntegrityError):
        with migrated.begin() as c:
            values = user_values(c)
            values["membership_source"] = "invitation"
            c.execute(reflect(c, "users").insert().values(**values))
    with pytest.raises(IntegrityError):
        with migrated.begin() as c:
            c.execute(reflect(c, "organization_invitations").insert().values(**invitation_values(c, purpose="bootstrap", invited_by=None)))


def test_bootstrap_uniqueness_and_directory_acceptor(migrated):
    with migrated.begin() as c:
        c.execute(reflect(c, "organization_invitations").insert().values(**invitation_values(
            c, purpose="bootstrap", invited_by=None, bootstrap_authorization_id="synthetic-approval-reference")))
    with pytest.raises(IntegrityError) as error:
        with migrated.begin() as c:
            c.execute(reflect(c, "organization_invitations").insert().values(**invitation_values(
                c, iid=502, email="other@example.test", purpose="bootstrap", invited_by=None,
                bootstrap_authorization_id="synthetic-approval-reference-2")))
    assert error.value.orig.pgcode == "23505"
    with pytest.raises(IntegrityError) as error:
        with migrated.begin() as c:
            values = invitation_values(c, iid=503, email="directory@example.test", purpose="directory_activation",
                                       target_user_id=12, accepted_user_id=11, status="accepted")
            values["consumed_at"] = values["created_at"]
            c.execute(reflect(c, "organization_invitations").insert().values(**values))
    assert error.value.orig.pgcode == "23514"


def test_orm_role_assignment_cannot_move_user_to_another_tenant(migrated):
    from sqlalchemy.orm import Session
    from app.models.foundation import User, Role
    with Session(migrated) as session:
        user = session.get(User, 11)
        foreign_role = session.query(Role).filter(Role.organization_id == 2, Role.name == "Requester").one()
        user.role = foreign_role
        assert user.organization_id == 1
        with pytest.raises(IntegrityError):
            session.flush()
        session.rollback()
        assert session.get(User, 11).organization_id == 1


def test_existing_department_set_null_semantics_are_preserved(migrated):
    with migrated.begin() as c:
        c.execute(sa.text("DELETE FROM departments WHERE id=1"))
        assert c.scalar(sa.text("SELECT department_id FROM users WHERE id=11")) is None
        assert c.scalar(sa.text("SELECT department_id FROM it_systems WHERE id=101")) is None
        assert c.scalar(sa.text("SELECT department_id FROM it_services WHERE id=1")) is None


def test_access_events_reject_cross_tenant_actor_and_invitation(migrated):
    with migrated.begin() as c:
        c.execute(reflect(c, "organization_invitations").insert().values(**invitation_values(c)))
    for changes in ({"actor_id": 20}, {"organization_id": 2, "actor_id": 20, "invitation_id": 501}):
        with pytest.raises(IntegrityError) as error:
            with migrated.begin() as c:
                values = dict(organization_id=1, actor_id=10, action="INVITATION_CREATED", source="administrator", event_metadata={}, created_at=datetime.now(timezone.utc))
                values.update(changes)
                c.execute(reflect(c, "tenant_access_events").insert().values(**values))
        assert error.value.orig.pgcode == "23503"


def test_downgrade_refuses_without_deleting_data(migrated):
    with pytest.raises(PreservationError, match="downgrade"):
        with migrated.begin() as c:
            downgrade(c)
    with migrated.connect() as c:
        assert c.scalar(sa.text("SELECT count(*) FROM users")) == 5
        assert c.scalar(sa.text("SELECT version_num FROM alembic_version")) == "a1_03_identity_enforce"


def test_concurrent_email_inserts_have_one_winner(migrated):
    barrier = threading.Barrier(2)
    def insert(uid):
        try:
            with migrated.begin() as c:
                values = user_values(c, uid=uid, email="Concurrent@example.test" if uid == 501 else "concurrent@example.test")
                barrier.wait(timeout=10)
                c.execute(reflect(c, "users").insert().values(**values))
            return "created"
        except IntegrityError as e:
            return e.orig.pgcode
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(insert, (501, 502))) == ["23505", "created"]


def test_concurrent_invitation_consumption_primitive_has_one_winner(migrated):
    with migrated.begin() as c:
        c.execute(reflect(c, "organization_invitations").insert().values(**invitation_values(c)))
    barrier = threading.Barrier(2)
    def consume(_):
        with migrated.begin() as c:
            barrier.wait(timeout=10)
            return c.execute(sa.text(
                "UPDATE organization_invitations SET status='accepted', consumed_at=now(), accepted_user_id=11 "
                "WHERE id=501 AND status='pending' AND expires_at>now() RETURNING id"
            )).scalar_one_or_none()
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(consume, (1, 2)))
    assert outcomes.count(501) == 1 and outcomes.count(None) == 1
    # This tests the persistence primitive only. A3 acceptance/API replay tests remain outstanding.


def test_pending_invitation_uniqueness_allows_revocation_and_reissue(migrated):
    with migrated.begin() as c:
        table = reflect(c, "organization_invitations")
        c.execute(table.insert().values(**invitation_values(c)))
    with pytest.raises(IntegrityError):
        with migrated.begin() as c:
            c.execute(reflect(c, "organization_invitations").insert().values(**invitation_values(c, iid=502, email="INVITE@example.test")))
    with migrated.begin() as c:
        table = reflect(c, "organization_invitations")
        c.execute(table.update().where(table.c.id == 501).values(status="revoked", revoked_at=datetime.now(timezone.utc)))
        c.execute(table.insert().values(**invitation_values(c, iid=503)))
        assert c.scalar(sa.select(sa.func.count()).select_from(table)) == 2
