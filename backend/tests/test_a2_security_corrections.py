"""Regression cases for blank identifiers and bcrypt work-factor differences."""
import bcrypt
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from a1_legacy_fixture import seed_legacy
from a1_postgresql import a1_pg_engine, a1_postgres_url, assert_owned_test_connection, migrate
from migrations.tenant_identity_a1 import INITIAL_REVISION
from app.database import get_db
from app.main import app
from app.models.foundation import User
from test_a2_authentication import (
    Client, assert_auth_failure, bearer, login, passwords, workspace,
)


def user_rows(engine):
    """Snapshot every persisted user field, including credentials and membership."""
    with engine.connect() as connection:
        return connection.execute(sa.select(User.__table__).order_by(User.id)).all()


@pytest.mark.parametrize("stored_email,supplied_email", [
    ("", None), ("", ""), ("", " "),
    ("   ", None), ("   ", ""), ("   ", "     "),
])
def test_blank_email_cannot_authenticate_even_with_blank_database_identity(
    workspace, stored_email, supplied_email,
):
    with Session(workspace.engine) as db:
        db.get(User, 2).email = stored_email
        db.commit()
    before = user_rows(workspace.engine)
    data = dict(tenant_slug="one", password="existing-password-one")
    if supplied_email is not None:
        data["email"] = supplied_email
    response = workspace.client.request("POST", "/auth/login", data=data)
    assert_auth_failure(response)
    assert user_rows(workspace.engine) == before


@pytest.mark.parametrize("boundary", ["\t", "\u00a0"])
def test_ascii_space_validation_does_not_strip_other_email_characters(workspace, boundary):
    with Session(workspace.engine) as db:
        db.get(User, 2).email = boundary + "Person@Example.test" + boundary
        db.commit()
    before = user_rows(workspace.engine)
    # A1 preserves these characters in the DB key; broad Python strip() would
    # silently change which account is selected.
    assert login(workspace, email=boundary + "person@example.test" + boundary).status_code == 200
    assert_auth_failure(login(workspace))
    assert user_rows(workspace.engine) == before


@pytest.fixture(scope="module")
def legacy_hashes():
    return {
        cost: bcrypt.hashpw(b"existing-password-one", bcrypt.gensalt(rounds=cost)).decode("ascii")
        for cost in (4, 11, 13)
    }


@pytest.mark.parametrize("case,expected_status,expected_work", [
    ("missing-workspace", 401, 4096),
    ("missing-account", 401, 4096),
    ("directory-user", 401, 4096),
    ("malformed-hash", 401, 4096),
    ("invalid-salt", 401, 4096),
    ("empty-password", 401, 4096),
    ("oversize-password", 401, 4096),
    ("blank-email", 401, 4096),
    ("low-cost-correct", 200, 4096),
    ("low-cost-wrong", 401, 4096),
    ("near-target-correct", 200, 4096),
    ("target-correct", 200, 4096),
    ("high-cost-correct", 200, 8192),
    ("high-cost-wrong", 401, 8192),
    ("inactive-low-cost", 401, 4096),
])
def test_login_has_minimum_bcrypt_work_without_downgrading_legacy_hashes(
    workspace, legacy_hashes, monkeypatch, case, expected_status, expected_work,
):
    changes = {}
    with Session(workspace.engine) as db:
        user = db.get(User, 2)
        if case in {"low-cost-correct", "low-cost-wrong", "inactive-low-cost",
                    "empty-password", "oversize-password"}:
            user.password_hash = legacy_hashes[4]
        elif case == "near-target-correct":
            user.password_hash = legacy_hashes[11]
        elif case.startswith("high-cost"):
            user.password_hash = legacy_hashes[13]
        elif case == "directory-user":
            user.password_hash = None
        elif case == "malformed-hash":
            user.password_hash = "not-a-bcrypt-hash"
        elif case == "invalid-salt":
            # The last salt character is not canonical. bcrypt rejects this
            # immediately, so attempting this hash is not expensive padding.
            user.password_hash = "$2b$12$" + "A" * 53
        elif case == "blank-email":
            user.email = "   "
            changes["email"] = ""
        if case == "inactive-low-cost":
            user.is_active = "inactive"
        stored_hash = user.password_hash
        db.commit()
    if case == "missing-workspace":
        changes["tenant_slug"] = "absent"
    elif case == "missing-account":
        changes["email"] = "absent@example.test"
    elif case.endswith("-wrong"):
        changes["password"] = "wrong-password"
    elif case == "empty-password":
        changes["password"] = ""
    elif case == "oversize-password":
        changes["password"] = "x" * 73

    before = user_rows(workspace.engine)
    completed_hashes = []
    original = bcrypt.checkpw

    def observed_check(password, encoded_hash):
        # Observe the actual cryptographic boundary while retaining real bcrypt.
        # A ValueError is not completed work and must not satisfy the assertion.
        result = original(password, encoded_hash)
        completed_hashes.append(encoded_hash.decode("ascii"))
        return result

    monkeypatch.setattr(bcrypt, "checkpw", observed_check)
    response = login(workspace, **changes)
    assert response.status_code == expected_status
    if expected_status == 401:
        assert_auth_failure(response)
    else:
        me = workspace.client.request("GET", "/auth/me", headers=bearer(response.json()["access_token"]))
        assert (me.status_code, me.json()["id"], me.json()["organization_id"]) == (200, 2, 1)
        assert stored_hash in completed_hashes
    # bcrypt's work scales as 2**cost. The expected budgets are literal policy
    # examples, independent of the application's padding implementation.
    assert sum(2 ** int(value.split("$")[2]) for value in completed_hashes) == expected_work
    assert user_rows(workspace.engine) == before


@pytest.mark.parametrize("prefix", ["$2a$", "$2b$", "$2y$"])
def test_legacy_bcrypt_prefixes_still_authenticate_without_rehash(workspace, legacy_hashes, prefix):
    original_hash = prefix + legacy_hashes[4][4:]
    with Session(workspace.engine) as db:
        db.get(User, 2).password_hash = original_hash
        db.commit()
    before = user_rows(workspace.engine)
    assert login(workspace).status_code == 200
    assert_auth_failure(login(workspace, password="wrong-password"))
    assert user_rows(workspace.engine) == before


def test_a1_migrated_legacy_account_can_login_without_changing_any_user_data(a1_pg_engine, legacy_hashes):
    with a1_pg_engine.begin() as connection:
        assert_owned_test_connection(connection)
        migrate(connection, INITIAL_REVISION)
        seed_legacy(connection)
        connection.execute(sa.text("UPDATE users SET password_hash=:value WHERE id=11"),
                           {"value": "$2y$" + legacy_hashes[4][4:]})
        migrate(connection)
    before = user_rows(a1_pg_engine)

    def test_db():
        with Session(a1_pg_engine) as db:
            yield db

    app.dependency_overrides[get_db] = test_db
    try:
        client = Client()
        data = dict(tenant_slug="org-1", email=" person@example.test ", password="existing-password-one")
        response = client.request("POST", "/auth/login", data=data)
        assert response.status_code == 200
        me = client.request("GET", "/auth/me", headers=bearer(response.json()["access_token"]))
        assert (me.status_code, me.json()["id"], me.json()["organization_id"]) == (200, 11, 1)
        assert_auth_failure(client.request("POST", "/auth/login", data={**data, "password": "wrong"}))
        assert user_rows(a1_pg_engine) == before
    finally:
        app.dependency_overrides.pop(get_db, None)
