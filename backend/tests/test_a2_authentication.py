"""A2 HTTP contract tests against disposable SQLite and opt-in PostgreSQL."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import asyncio

import httpx
import pytest
import sqlalchemy as sa
from fastapi import HTTPException
from jose import jwt
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from a1_postgresql import a1_pg_engine, a1_postgres_url, assert_owned_test_connection
from app.database import Base, get_db
from app.main import app
from app.models.foundation import Department, Organization, Role, User
from app.services import auth_service
from app.services.tenant_context import (
    AUTHENTICATION_FAILURE, context_for_user, get_tenant_context,
)
from app.settings import settings


class Client:
    def request(self, method, path, **kwargs):
        async def send():
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://a2.test",
            ) as client:
                return await client.request(method, path, **kwargs)
        return asyncio.run(send())


@pytest.fixture(scope="module")
def passwords():
    return {"one": auth_service.hash_password("existing-password-one"),
            "two": auth_service.hash_password("existing-password-two")}


@pytest.fixture(params=["sqlite", "postgresql"])
def workspace(request, passwords):
    if request.param == "postgresql":
        engine = request.getfixturevalue("a1_pg_engine")
        with engine.connect() as connection:
            assert_owned_test_connection(connection)
    else:
        engine = sa.create_engine(
            "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False},
        )
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([Organization(id=1, name="One", slug="one"),
                    Organization(id=2, name="Two", slug="two")])
        db.flush()
        # Global and foreign roles deliberately precede the current tenant's.
        db.add_all([Role(id=1, name="System Administrator"),
                    Role(id=2, name="System Administrator", organization_id=2),
                    Role(id=3, name="Requester", organization_id=2),
                    Role(id=4, name="System Administrator", organization_id=1),
                    Role(id=5, name="Requester", organization_id=1)])
        db.flush()
        db.add_all([
            User(id=1, organization_id=1, role_id=4, full_name="Admin One",
                 email="Admin@example.test", password_hash=passwords["one"], membership_source="legacy"),
            User(id=2, organization_id=1, role_id=5, full_name="Person One",
                 email="  Person@Example.test  ", password_hash=passwords["one"], membership_source="legacy"),
            User(id=3, organization_id=2, role_id=2, full_name="Person Two",
                 email="person@example.test", password_hash=passwords["two"], membership_source="legacy"),
            User(id=4, organization_id=1, role_id=5, full_name="Pending Member",
                 email="pending@example.test", password_hash=passwords["one"],
                 membership_source="invitation", is_active="inactive"),
        ])
        db.commit()

    def test_db():
        with Session(engine) as db:
            yield db
    app.dependency_overrides[get_db] = test_db
    try:
        yield SimpleNamespace(client=Client(), engine=engine, passwords=passwords)
    finally:
        app.dependency_overrides.pop(get_db, None)
        if request.param == "sqlite":
            engine.dispose()


def login(workspace, **changes):
    data = dict(tenant_slug="one", email="person@example.test", password="existing-password-one")
    data.update(changes)
    return workspace.client.request("POST", "/auth/login", data=data)


def token_for(workspace, uid=2, **claims):
    with Session(workspace.engine) as db:
        token = auth_service.create_access_token(db.get(User, uid))
    payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    payload.update(claims)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def bearer(token):
    return {"Authorization": "Bearer " + token}


def assert_auth_failure(response):
    assert response.status_code == 401, response.text
    assert response.json() == {"detail": AUTHENTICATION_FAILURE}
    assert response.headers["www-authenticate"] == "Bearer"


def test_workspace_login_and_v2_claims_preserve_hash_and_email(workspace):
    result = login(workspace, email=" PERSON@EXAMPLE.TEST ")
    assert result.status_code == 200
    assert set(result.json()) == {"access_token", "token_type"}
    payload = jwt.decode(result.json()["access_token"], settings.jwt_secret_key,
                         algorithms=[settings.jwt_algorithm])
    assert set(payload) == {"sub", "tid", "ver", "exp"}
    assert (payload["sub"], payload["tid"], payload["ver"]) == ("2", 1, 2)
    remaining = payload["exp"] - datetime.now(timezone.utc).timestamp()
    assert settings.access_token_expire_minutes * 60 - 5 <= remaining <= settings.access_token_expire_minutes * 60
    response = workspace.client.request("GET", "/auth/me", headers=bearer(result.json()["access_token"]))
    assert response.status_code == 200
    assert response.json()["organization_id"] == 1
    with Session(workspace.engine) as db:
        user = db.get(User, 2)
        assert user.password_hash == workspace.passwords["one"]
        assert user.email == "  Person@Example.test  "
        assert user.membership_confirmed_at is None


@pytest.mark.parametrize("changes", [
    {"password": "wrong"}, {"tenant_slug": "absent"}, {"email": "absent@example.test"},
    {"tenant_slug": ""}, {"email": ""}, {"password": ""},
    {"email": "\tperson@example.test\t"}, {"password": "x" * 73},
    {"tenant_slug": "one\x00"}, {"email": "person\x00@example.test"},
    {"email": "pending@example.test"},
])
def test_login_failures_have_one_response(workspace, changes):
    assert_auth_failure(login(workspace, **changes))


@pytest.mark.parametrize("missing", ["tenant_slug", "email", "password"])
def test_missing_form_fields_are_generic_and_do_not_echo_secrets(workspace, missing):
    data = dict(tenant_slug="one", email="person@example.test", password="existing-password-one")
    data.pop(missing)
    assert_auth_failure(workspace.client.request("POST", "/auth/login", data=data))


def test_same_email_is_resolved_only_in_requested_workspace(workspace):
    assert_auth_failure(login(workspace, tenant_slug="two"))
    result = login(workspace, tenant_slug="two", password="existing-password-two")
    assert result.status_code == 200
    me = workspace.client.request("GET", "/auth/me", headers=bearer(result.json()["access_token"]))
    assert (me.json()["id"], me.json()["organization_id"]) == (3, 2)


@pytest.mark.parametrize("source", ["invitation", "bootstrap"])
def test_confirmed_memberships_can_authenticate(workspace, source):
    with Session(workspace.engine) as db:
        user = db.get(User, 4)
        user.membership_source = source
        user.email_verified_at = user.membership_confirmed_at = datetime.now(timezone.utc)
        user.is_active = "active"
        db.commit()
    assert login(workspace, email="pending@example.test").status_code == 200


@pytest.mark.parametrize("claims", [
    {"tid": 2}, {"tid": "1"}, {"tid": True}, {"tid": None}, {"tid": 0},
    {"ver": 1}, {"ver": None}, {"ver": "2"}, {"ver": 2.0},
    {"sub": "999999999999999999999999999"}, {"sub": "0"}, {"sub": "1.5"},
    {"sub": "9999"}, {"sub": None}, {"exp": 1}, {"exp": "9999999999"},
    {"exp": float("nan")}, {"exp": float("inf")},
])
def test_invalid_claims_are_rejected(workspace, claims):
    assert_auth_failure(workspace.client.request("GET", "/auth/me", headers=bearer(token_for(workspace, **claims))))


@pytest.mark.parametrize("missing", ["ver", "tid", "exp", "sub"])
def test_v1_and_missing_required_claims_are_rejected(workspace, missing):
    payload = dict(sub="2", tid=1, ver=2, exp=datetime.now(timezone.utc) + timedelta(minutes=1))
    payload.pop(missing)
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    assert_auth_failure(workspace.client.request("GET", "/auth/me", headers=bearer(token)))


def test_missing_malformed_wrong_signature_and_algorithm_are_rejected(workspace):
    payload = dict(sub="2", tid=1, ver=2, exp=datetime.now(timezone.utc) + timedelta(minutes=1))
    tokens = ["broken", jwt.encode(payload, "a-different-test-only-signing-secret", algorithm=settings.jwt_algorithm),
              jwt.encode(payload, settings.jwt_secret_key, algorithm="HS384")]
    for token in tokens:
        assert_auth_failure(workspace.client.request("GET", "/auth/me", headers=bearer(token)))
    assert_auth_failure(workspace.client.request("GET", "/auth/me"))
    assert_auth_failure(workspace.client.request("GET", "/auth/me", headers={"Authorization": "Basic irrelevant"}))


def test_claimed_roles_permissions_and_tenant_headers_do_not_grant_access(workspace):
    token = token_for(workspace, role="System Administrator", permissions=["*"], organization_id=2)
    response = workspace.client.request("GET", "/auth/admin/users?organization_id=2", headers={
        **bearer(token), "X-Organization-ID": "2", "X-Tenant-ID": "2",
    })
    assert response.status_code == 403
    response = workspace.client.request("GET", "/auth/me?organization_id=2", headers=bearer(token))
    assert response.json()["organization_id"] == 1
    with Session(workspace.engine) as db:
        context = get_tenant_context(token, db)
        assert (context.user_id, context.organization_id, context.role_id) == (2, 1, 5)
        # A4 supplies only the actual DB Requester's explicit grants. The
        # forged wildcard/admin claims above never enter Tenant Context.
        assert context.permissions == frozenset({
            "identity.read", "foundation.read", "notifications.own", "risk_rules.read",
            "changes.read", "changes.create", "changes.revise",
        })


def test_disable_and_role_changes_take_effect_on_existing_token(workspace):
    token = token_for(workspace, uid=1)
    with Session(workspace.engine) as db:
        db.get(User, 1).role_id = 5
        db.commit()
    assert workspace.client.request("GET", "/auth/admin/users", headers=bearer(token)).status_code == 403
    with Session(workspace.engine) as db:
        db.get(User, 1).is_active = "inactive"
        db.commit()
    assert_auth_failure(workspace.client.request("GET", "/auth/me", headers=bearer(token)))
    assert_auth_failure(login(workspace, email="admin@example.test"))


def test_admin_role_resolution_and_user_changes_remain_tenant_local(workspace):
    headers = bearer(token_for(workspace, uid=1))
    response = workspace.client.request("GET", "/auth/admin/roles", headers=headers)
    assert response.status_code == 200
    assert {row["id"] for row in response.json()} == {4, 5}
    roles = workspace.client.request("GET", "/foundation/roles", headers=headers)
    assert roles.status_code == 200
    assert {row["id"] for row in roles.json()} == {4, 5}
    overview = workspace.client.request("GET", "/foundation/overview", headers=headers)
    assert overview.status_code == 200
    assert overview.json()["roles"] == 2
    response = workspace.client.request("PATCH", "/auth/admin/users/2", headers=headers,
                                        json={"role_name": "System Administrator"})
    assert response.status_code == 200
    with Session(workspace.engine) as db:
        assert db.get(User, 2).role_id == 4
    assert workspace.client.request("PATCH", "/auth/admin/users/3", headers=headers,
                                    json={"is_active": "inactive"}).status_code == 404
    assert workspace.client.request("PATCH", "/auth/admin/users/4", headers=headers,
                                    json={"is_active": "active"}).status_code == 400


def test_old_public_registration_cannot_create_or_activate_memberships(workspace):
    response = workspace.client.request("POST", "/auth/register", json={
        "full_name": "Unapproved", "email": "new@example.test", "password": "not-approved-password",
        "organization_id": 2,
    })
    assert response.status_code == 403
    with Session(workspace.engine) as db:
        assert db.query(User).count() == 4


@pytest.mark.parametrize("changes", [
    {"role": SimpleNamespace(id=9, name="System Administrator", organization_id=2)},
    {"role": SimpleNamespace(id=9, name="System Administrator", organization_id=None)},
    {"role": None}, {"organization": None}, {"is_active": "inactive"},
    {"password_hash": None}, {"membership_source": "unknown"},
    {"membership_source": "invitation"}, {"membership_source": "bootstrap"},
    {"membership_source": "invitation", "membership_confirmed_at": datetime.now(timezone.utc)},
    {"membership_source": "bootstrap", "email_verified_at": datetime.now(timezone.utc)},
    {"department_id": 7, "department": SimpleNamespace(organization_id=2)},
    {"department_id": 7, "department": None},
])
def test_corrupt_or_incomplete_account_is_rejected_even_before_database_constraints(changes):
    user = SimpleNamespace(
        id=1, organization_id=1, organization=object(), role_id=1,
        role=SimpleNamespace(id=1, name="Requester", organization_id=1),
        department_id=None, department=None, is_active="active", password_hash="existing-hash",
        membership_source="legacy", membership_confirmed_at=None, email_verified_at=None,
    )
    user.__dict__.update(changes)
    with pytest.raises(HTTPException) as error:
        context_for_user(user)
    assert error.value.status_code == 401
    assert error.value.detail == AUTHENTICATION_FAILURE


def test_every_protected_route_uses_the_shared_tenant_boundary():
    from fastapi.routing import APIRoute
    def includes(dependency):
        return dependency.call is get_tenant_context or any(includes(child) for child in dependency.dependencies)
    def routes_in(router):
        for route in router.routes:
            if hasattr(route, "original_router"):
                yield from routes_in(route.original_router)
            else:
                yield route
    public = {"/", "/health", "/auth/login", "/auth/register", "/auth/invitations/accept"}
    protected = 0
    for route in routes_in(app):
        if isinstance(route, APIRoute) and route.path not in public:
            protected += 1
            assert includes(route.dependant), route.path
    assert protected > 0


@pytest.mark.parametrize("changes", [{}, {"tenant_slug": "absent"}, {"email": "absent@example.test"},
                                      {"password": "wrong"}, {"email": "pending@example.test"}])
def test_login_performs_one_bcrypt_check_for_existing_and_missing_accounts(workspace, monkeypatch, changes):
    original = auth_service.verify_password
    calls = []
    def check(password, password_hash):
        calls.append(password_hash)
        return original(password, password_hash)
    monkeypatch.setattr(auth_service, "verify_password", check)
    login(workspace, **changes)
    assert len(calls) == 1
    assert auth_service._BCRYPT_HASH.fullmatch(calls[0])


def test_credentials_are_not_logged(workspace, caplog):
    caplog.set_level("DEBUG")
    response = login(workspace)
    token = response.json()["access_token"]
    login(workspace, password="unique-wrong-test-password")
    workspace.client.request("GET", "/auth/me", headers=bearer(token))
    assert "existing-password-one" not in caplog.text
    assert "unique-wrong-test-password" not in caplog.text
    assert token not in caplog.text


def test_postgres_email_comparison_uses_database_collation(workspace):
    if workspace.engine.dialect.name != "postgresql":
        pytest.skip("Database collation behavior requires PostgreSQL.")
    # Compute both insertion key and supplied key in PostgreSQL, including Unicode.
    with Session(workspace.engine) as db:
        user = db.get(User, 2)
        user.email = "  İPERSON@EXAMPLE.TEST  "
        db.commit()
        normalized = db.scalar(sa.text("SELECT lower(btrim(:email))"), {"email": user.email})
    assert login(workspace, email=normalized).status_code == 200


@pytest.mark.parametrize("values,constraints", [
    ({"role_id": 1}, ["fk_users_tenant_role"]),
    ({"role_id": 3}, ["fk_users_tenant_role"]),
    ({"membership_source": "invitation"}, ["ck_users_membership_activation"]),
    ({"membership_source": "bootstrap", "email_verified_at": datetime.now(timezone.utc)},
     ["ck_users_membership_activation"]),
    ({"membership_source": "invitation", "membership_confirmed_at": datetime.now(timezone.utc)},
     ["ck_users_membership_activation"]),
    ({"password_hash": None}, []),
    ({"password_hash": "invalid-hash"}, []),
])
def test_http_rejects_invalid_database_membership_and_roles(workspace, values, constraints):
    token = token_for(workspace)
    with workspace.engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            assert_owned_test_connection(connection)
            # Deliberately corrupt only this fixture-owned, disposable schema
            # to prove the application enforces the boundary independently.
            for constraint in constraints:
                connection.exec_driver_sql(f'ALTER TABLE users DROP CONSTRAINT "{constraint}"')
        else:
            connection.exec_driver_sql("PRAGMA ignore_check_constraints=ON")
        connection.execute(sa.update(User).where(User.id == 2).values(**values))
    assert_auth_failure(login(workspace))
    # A malformed nonempty hash is not an activation field; login still refuses
    # it, while an already issued token uses the account's membership checks.
    if values.get("password_hash") != "invalid-hash":
        assert_auth_failure(workspace.client.request("GET", "/auth/me", headers=bearer(token)))


def test_context_refreshes_existing_session_identity(workspace):
    token = token_for(workspace)
    with Session(workspace.engine) as db:
        context = get_tenant_context(token, db)
        assert context.role_name == "Requester"
        with Session(workspace.engine) as updater:
            updater.get(User, 2).role_id = 4
            updater.commit()
        refreshed = get_tenant_context(token, db)
        assert refreshed.role_name == "System Administrator"


def test_cross_tenant_body_is_rejected_and_last_admin_guards_remain(workspace):
    headers = bearer(token_for(workspace, uid=1))
    # Current administrator has no CMDB grant; a body cannot change that.
    assert workspace.client.request("POST", "/foundation/departments", headers=headers,
                                    json={"organization_id": 2, "name": "Forbidden"}).status_code == 403
    assert workspace.client.request("PATCH", "/auth/admin/users/1", headers=headers,
                                    json={"is_active": "inactive"}).status_code == 400
    assert workspace.client.request("PATCH", "/auth/admin/users/1", headers=headers,
                                    json={"role_name": "Requester"}).status_code == 400
