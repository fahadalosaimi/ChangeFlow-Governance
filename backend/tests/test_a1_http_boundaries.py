"""Real HTTP regression tests for existing boundaries, not unimplemented A2/A3 flows."""
import asyncio
import httpx
import pytest
from sqlalchemy.orm import Session

from a1_postgresql import a1_postgres_url, a1_pg_engine, migrate
from a1_legacy_fixture import seed_legacy
from migrations.tenant_identity_a1 import INITIAL_REVISION
from app.main import app
from app.database import get_db
from app.models.foundation import User
from app.services.auth_service import create_access_token


class ASGIClient:
    """HTTP through the real ASGI stack, without TestClient compatibility shims."""
    def request(self, method, path, **kwargs):
        async def send():
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://a1.test") as client:
                return await client.request(method, path, **kwargs)
        return asyncio.run(send())

    def get(self, path, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path, **kwargs):
        return self.request("POST", path, **kwargs)

    def patch(self, path, **kwargs):
        return self.request("PATCH", path, **kwargs)


@pytest.fixture
def http_workspace(a1_pg_engine):
    with a1_pg_engine.begin() as c:
        migrate(c, INITIAL_REVISION)
        seed_legacy(c)
        migrate(c)
    def test_db():
        with Session(a1_pg_engine) as session:
            yield session
    app.dependency_overrides[get_db] = test_db
    try:
        with Session(a1_pg_engine) as session:
            tokens = {uid: create_access_token(session.get(User, uid)) for uid in (10, 11, 13, 20)}
        yield ASGIClient(), tokens
    finally:
        app.dependency_overrides.pop(get_db, None)


def headers(tokens, uid):
    return {"Authorization": "Bearer " + tokens[uid]}


@pytest.mark.parametrize("path", [
    "/foundation/systems/201", "/foundation/systems/201/dependencies",
    "/foundation/systems/201/incidents", "/foundation/systems/201/impact-profile",
    "/change-management/requests/2001", "/change-management/requests/2001/history",
    "/change-management/requests/2001/audit-logs", "/change-management/requests/2001/approvals",
    "/change-management/requests/2001/implementation",
])
def test_http_cross_tenant_detail_reads_are_denied(http_workspace, path):
    client, tokens = http_workspace
    assert client.get(path, headers=headers(tokens, 11)).status_code == 404


def test_http_lists_do_not_contain_other_tenant_records(http_workspace):
    client, tokens = http_workspace
    result = client.get("/foundation/systems", headers=headers(tokens, 11))
    assert result.status_code == 200
    assert {item["id"] for item in result.json()} == {101, 102}
    result = client.get("/change-management/requests/paged", headers=headers(tokens, 11))
    assert result.status_code == 200
    assert [item["id"] for item in result.json()["items"]] == [1001]


def test_http_unauthenticated_and_wrong_role_requests_are_denied(http_workspace):
    client, tokens = http_workspace
    assert client.get("/foundation/systems").status_code == 401
    assert client.get("/auth/admin/users", headers=headers(tokens, 11)).status_code == 403
    assert client.post("/foundation/departments", headers=headers(tokens, 11), json={"name": "Forbidden"}).status_code == 403


def test_http_cross_tenant_writes_and_references_are_denied(http_workspace):
    client, tokens = http_workspace
    assert client.post("/foundation/systems", headers=headers(tokens, 13), json={
        "organization_id": 2, "name": "Forbidden system", "criticality": "High",
    }).status_code == 403
    assert client.post("/foundation/systems", headers=headers(tokens, 13), json={
        "name": "Invalid reference", "department_id": 2,
    }).status_code == 404
    assert client.patch("/auth/admin/users/20", headers=headers(tokens, 10), json={"is_active": "inactive"}).status_code == 404
    assert client.patch("/notifications/1/read", headers=headers(tokens, 20)).status_code == 404


def test_http_jwt_role_claim_does_not_override_database_role(http_workspace):
    from jose import jwt
    from app.settings import settings
    client, tokens = http_workspace
    payload = jwt.decode(tokens[11], settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    payload["role"] = "System Administrator"
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    assert client.get("/auth/admin/users", headers={"Authorization": "Bearer " + token}).status_code == 403


@pytest.mark.parametrize("path, payload", [
    ("/foundation/dependencies", {"source_system_id": 101, "target_system_id": 201, "dependency_type": "Application"}),
    ("/foundation/incidents", {"system_id": 201, "title": "Foreign incident"}),
    ("/foundation/systems", {"name": "Foreign owner", "owner_id": 20}),
    ("/foundation/systems", {"name": "Foreign service", "service_id": 2}),
])
def test_http_cmdb_foreign_references_are_denied(http_workspace, path, payload):
    client, tokens = http_workspace
    assert client.post(path, headers=headers(tokens, 13), json=payload).status_code == 404


def test_http_change_cannot_reference_foreign_system(http_workspace):
    client, tokens = http_workspace
    response = client.post("/change-management/requests", headers=headers(tokens, 11), json={
        "title": "Unauthorized cross-tenant change", "description": "Must not create any records for a foreign system.",
        "change_type": "application", "affected_system_ids": [201],
    })
    assert response.status_code == 404
    assert client.get("/change-management/requests/paged", headers=headers(tokens, 11)).json()["total"] == 1
