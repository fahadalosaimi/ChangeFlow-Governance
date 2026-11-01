"""A5 identity is derived from current tenant membership, never client claims."""
import pytest
from jose import jwt
from sqlalchemy.orm import Session

from a4_workspace import workspace, request
from a1_postgresql import a1_pg_engine, a1_postgres_url
from test_a3_invitations import invitations, original_password_hash
from app.models.foundation import Organization, User
from app.settings import settings

READ = {"identity.read", "foundation.read", "notifications.own", "risk_rules.read"}


@pytest.mark.parametrize("uid,extra", [
    (1, {"users.read", "users.update", "audit.read", "invitations.manage"}),
    (2, {"changes.read", "changes.create", "changes.revise"}),
    (7, {"foundation.write", "changes.read", "risk_rules.write"}),
    (8, {"changes.read", "changes.approve", "changes.implement"}),
    (20, set()), (21, set()), (22, set()), (23, set()),
])
def test_me_exposes_current_matrix_without_expanding_privileges(workspace, uid, extra):
    response = request(workspace, "GET", "/auth/me", uid)
    assert response.status_code == 200
    body = response.json()
    assert body.get("permissions") == sorted(READ | extra), "Missing or incorrect A5 permissions"
    assert body.get("workspace_slug") == "tenant-1"
    assert set(body) == {"id", "organization_id", "department_id", "full_name", "email",
                         "job_title", "role_name", "department_name", "permissions", "workspace_slug"}


def test_me_preserves_existing_fields_and_uses_own_workspace(workspace):
    body = request(workspace, "GET", "/auth/me").json()
    assert {key: body[key] for key in ("id", "organization_id", "department_id", "full_name",
                                      "email", "job_title", "role_name", "department_name")} == {
        "id": 2, "organization_id": 1, "department_id": None, "full_name": "Existing User 2",
        "email": "requester@one.example", "job_title": "Preserve existing title",
        "role_name": "Requester", "department_name": None}
    foreign = request(workspace, "GET", "/auth/me", 3).json()
    assert foreign.get("workspace_slug") == "tenant-2"
    assert foreign["organization_id"] == 2


def test_same_jwt_reflects_role_workspace_and_activity_changes(workspace):
    with Session(workspace.engine) as db:
        db.get(User, 2).role_id = 4
        db.get(Organization, 1).slug = "renamed-tenant"
        db.commit()
    body = request(workspace, "GET", "/auth/me").json()
    assert body.get("permissions") == sorted(READ | {"foundation.write", "changes.read", "risk_rules.write"})
    assert body.get("workspace_slug") == "renamed-tenant"
    with Session(workspace.engine) as db:
        db.get(User, 2).is_active = "inactive"
        db.commit()
    assert request(workspace, "GET", "/auth/me").status_code == 401


def test_client_permission_claims_and_tenant_headers_cannot_grant_access(workspace):
    payload = jwt.decode(workspace.tokens[2], settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    payload.update(permissions=["users.update"], role_name="System Administrator", workspace_slug="tenant-2")
    forged = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    response = workspace.client.request("GET", "/auth/me", headers={
        "Authorization": "Bearer " + forged, "X-Tenant-ID": "2"})
    assert response.status_code == 200
    assert response.json().get("permissions") == sorted(READ | {"changes.read", "changes.create", "changes.revise"})
    assert response.json().get("workspace_slug") == "tenant-1"


def test_foreign_tenant_jwt_and_unknown_role_are_denied(workspace):
    assert request(workspace, "GET", "/auth/me", 24).status_code == 403
    # PostgreSQL already forbids cross-tenant role writes. Exercise the HTTP
    # tenant boundary without disabling constraints or inventing invalid rows.
    payload = jwt.decode(workspace.tokens[2], settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    payload["tid"] = 2
    foreign = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    response = workspace.client.request("GET", "/auth/me", headers={"Authorization": "Bearer " + foreign})
    assert response.status_code == 401
