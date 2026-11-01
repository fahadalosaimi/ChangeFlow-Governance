"""Permission decisions use real HTTP, DB roles, and owned PostgreSQL."""
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session
from jose import jwt

from a4_workspace import workspace, request, CHANGE_BODY
from a1_postgresql import a1_pg_engine, a1_postgres_url
from test_a3_invitations import invitations, original_password_hash, user_snapshot
from app.models.foundation import User
from app.services.tenant_context import context_for_user
from app.settings import settings


@pytest.mark.parametrize("uid",[1,2,7,8,20,21,22,23,24])
def test_http_permission_matrix_preserves_explicit_business_grants(workspace,uid):
    known=uid!=24
    readers=uid in (2,7,8)
    operations=[
        ("GET","/auth/me",None,200 if known else 403),
        ("GET","/foundation/systems",None,200 if known else 403),
        ("GET","/foundation/overview",None,200 if known else 403),
        ("GET","/auth/admin/users/paged",None,200 if uid==1 else 403),
        ("GET","/auth/admin/roles",None,200 if uid==1 else 403),
        ("GET","/auth/admin/audit-logs/paged",None,200 if uid==1 else 403),
        ("PATCH","/auth/admin/users/10",{"is_active":"inactive"},200 if uid==1 else 403),
        ("GET","/auth/invitations",None,200 if uid==1 else 403),
        ("POST","/auth/invitations",{"email":"new-a4@example.test","role_id":3},201 if uid==1 else 403),
        ("GET","/change-management/requests/paged",None,200 if readers else 403),
        ("GET","/change-management/dashboard/overview",None,200 if readers else 403),
        ("GET","/change-management/dashboard/delivery-queues",None,200 if readers else 403),
        ("POST","/change-management/requests",CHANGE_BODY,200 if uid==2 else 403),
        ("POST","/foundation/departments",{"name":"A4 new department"},201 if uid==7 else 403),
        ("POST","/foundation/systems",{"name":"A4 new system","department_id":1},201 if uid==7 else 403),
        ("POST","/foundation/incidents",{"system_id":1001,"title":"A4 incident"},201 if uid==7 else 403),
        ("POST","/foundation/dependencies",{"source_system_id":1002,"target_system_id":1001,
            "dependency_type":"Application"},201 if uid==7 else 403),
        ("POST","/change-management/requests/101/approvals",{"decision":"Approved"},200 if uid==8 else 403),
        ("POST","/change-management/requests/100/implementation/start",{"start_notes":"A4 execution"},200 if uid==8 else 403),
        ("GET","/notifications/paged",None,200 if known else 403),
    ]
    before=user_snapshot(workspace.engine)
    for method,path,payload,expected in operations:
        response=request(workspace,method,path,uid,**({"json":payload} if payload is not None else {}))
        assert response.status_code==expected,(uid,method,path,response.status_code,response.text)
    assert [(u.id,u.password_hash) for u in user_snapshot(workspace.engine)]==[(u.id,u.password_hash) for u in before]


def test_tenant_context_has_immutable_permissions_from_current_db_role(workspace):
    with Session(workspace.engine) as db:
        permissions=context_for_user(db.get(User,7)).permissions
        assert isinstance(permissions,frozenset)
        assert "foundation.write" in permissions and "users.update" not in permissions
        assert context_for_user(db.get(User,24)).permissions==frozenset()


def test_signed_jwt_permissions_and_client_tenant_cannot_grant_admin_access(workspace):
    payload=jwt.decode(workspace.tokens[2],settings.jwt_secret_key,algorithms=[settings.jwt_algorithm])
    payload.update(role="System Administrator",permissions=["users.update","invitations.manage"],organization_id=2)
    forged=jwt.encode(payload,settings.jwt_secret_key,algorithm=settings.jwt_algorithm)
    response=workspace.client.request("PATCH","/auth/admin/users/2?organization_id=2",
        headers={"Authorization":"Bearer "+forged,"X-Tenant-ID":"2"},json={"role_name":"System Administrator"})
    assert response.status_code==403
    with Session(workspace.engine) as db:
        assert db.get(User,2).role_id==3


def test_permissions_change_with_database_role_and_disable_in_active_session(workspace):
    assert request(workspace,"POST","/foundation/departments",7,json={"name":"Before role change"}).status_code==201
    with Session(workspace.engine) as db:
        db.get(User,7).role_id=3
        db.commit()
    assert request(workspace,"POST","/foundation/departments",7,json={"name":"After role change"}).status_code==403
    with Session(workspace.engine) as db:
        db.get(User,7).is_active="inactive"
        db.commit()
    assert request(workspace,"GET","/foundation/systems",7).status_code==401


@pytest.mark.parametrize("path,payload,uid",[
    ("/foundation/departments",{"name":"Mass assignment","role_id":2},7),
    ("/foundation/systems",{"name":"Mass assignment","role_name":"System Administrator"},7),
    ("/foundation/incidents",{"system_id":1001,"title":"Mass assignment","organization_id":2},7),
    ("/change-management/requests",{**CHANGE_BODY,"organization_id":2,"requester_id":9,"status":"Approved"},2),
    ("/auth/admin/users/10",{"role_name":"Requester","organization_id":2},1),
    ("/change-management/requests/100/implementation/start",{"coordinator_id":3},8),
])
def test_extra_identity_and_authority_fields_are_rejected_without_writes(workspace,path,payload,uid):
    before=user_snapshot(workspace.engine)
    tables=('departments','it_systems','incidents','managed_change_requests','managed_impact_assessments',
            'change_implementations','change_status_history','audit_logs','notifications')
    with workspace.engine.connect() as db:
        counts={table:db.scalar(sa.text(f'SELECT count(*) FROM {table}')) for table in tables}
    response=request(workspace,"PATCH" if path.startswith('/auth/admin') else "POST",path,uid,json=payload)
    assert response.status_code==422,response.text
    assert user_snapshot(workspace.engine)==before
    with workspace.engine.connect() as db:
        assert counts=={table:db.scalar(sa.text(f'SELECT count(*) FROM {table}')) for table in tables}
