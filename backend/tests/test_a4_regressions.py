"""A4 route coverage, business flows, and explicitly deferred findings."""
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session
from fastapi.routing import APIRoute

from a4_workspace import workspace, request, CHANGE_BODY
from a1_postgresql import a1_pg_engine, a1_postgres_url, assert_owned_test_connection
from test_a3_invitations import invitations, original_password_hash, user_snapshot
from app.main import app
from app.models.foundation import Role, User
from app.models.change_management import ManagedChangeRequest, ManagedImpactAssessment, ChangeApproval
from app.services.tenant_context import get_tenant_context


def test_every_tenant_route_requires_explicit_permissions_in_addition_to_authentication():
    public={'/','/health','/auth/login','/auth/register','/auth/invitations/accept'}
    def routes(router):
        for item in router.routes:
            if hasattr(item,'original_router'): yield from routes(item.original_router)
            else: yield item
    def permissions(dependant):
        if getattr(dependant.call,'__name__','')=='permission_checker': return True
        return any(permissions(child) for child in dependant.dependencies)
    protected=[route for route in routes(app) if isinstance(route,APIRoute) and route.path not in public]
    assert len(protected)>40
    assert all(permissions(route.dependant) for route in protected)


def test_permissions_refresh_inside_an_existing_db_session(workspace):
    with Session(workspace.engine) as db:
        assert 'foundation.write' in get_tenant_context(workspace.tokens[7],db).permissions
        with Session(workspace.engine) as updater:
            updater.get(User,7).role_id=3
            updater.commit()
        refreshed=get_tenant_context(workspace.tokens[7],db)
        assert 'foundation.write' not in refreshed.permissions and 'changes.create' in refreshed.permissions


def test_renamed_role_and_incomplete_membership_cannot_use_old_tokens(workspace):
    with Session(workspace.engine) as db:
        db.get(Role,4).name='Unapproved role'
        db.commit()
    assert request(workspace,'GET','/foundation/systems',7).status_code==403
    with workspace.engine.begin() as connection:
        assert_owned_test_connection(connection)
        connection.exec_driver_sql('ALTER TABLE users DROP CONSTRAINT ck_users_membership_activation')
        connection.execute(sa.update(User).where(User.id==2).values(membership_source='invitation'))
    assert request(workspace,'GET','/foundation/systems',2).status_code==401


def test_catalog_lists_counts_and_tenant_query_headers_use_database_scope(workspace):
    before=user_snapshot(workspace.engine)
    for path,expected in [('/foundation/organizations',{1}),('/foundation/departments',{1}),
        ('/foundation/services',{1}),('/foundation/systems',{1001,1002}),('/foundation/incidents',{1}),
        ('/foundation/dependencies',{1})]:
        response=workspace.client.request('GET',path+'?organization_id=2&tenant_id=2',
            headers={'Authorization':'Bearer '+workspace.tokens[2],'X-Tenant-ID':'2'})
        assert response.status_code==200 and {row['id'] for row in response.json()}==expected,response.text
        assert 'FOREIGN-SECRET' not in response.text
    assert {row['id'] for row in request(workspace,'GET','/foundation/roles').json()}=={2,3,4,5,10,11,12,13,14}
    users=request(workspace,'GET','/foundation/users').json()
    assert all(row['organization_id']==1 for row in users)
    overview=request(workspace,'GET','/foundation/overview').json()
    assert (overview['systems'],overview['dependencies'],overview['incidents'],overview['departments'])==(2,1,1,1)
    assert user_snapshot(workspace.engine)==before
    # No catalog delete operation exists: equal method rejection must never
    # become a new mutation or disclose whether the resource exists.
    own=request(workspace,'DELETE','/foundation/systems/1001',7)
    foreign=request(workspace,'DELETE','/foundation/systems/2001',7)
    assert own.status_code==foreign.status_code==405 and own.json()==foreign.json()


@pytest.mark.parametrize('operation',['complete','fail','rollback','post-implementation-review'])
def test_execution_permission_and_business_flow_remain_intact(workspace,operation):
    assert request(workspace,'POST','/change-management/requests/100/implementation/start',8,json={}).status_code==200
    payloads={'complete':{'completion_summary':'Completed safely','validation_results':'Tests passed'},
        'fail':{'failure_summary':'Controlled failure'},'rollback':{'rollback_reason':'Controlled rollback'},
        'post-implementation-review':{'pir_result':'Successful','pir_summary':'Validated in test'}}
    if operation=='rollback':
        assert request(workspace,'POST','/change-management/requests/100/implementation/fail',8,json=payloads['fail']).status_code==200
    if operation=='post-implementation-review':
        assert request(workspace,'POST','/change-management/requests/100/implementation/complete',8,json=payloads['complete']).status_code==200
    path='/change-management/requests/100/implementation/'+operation
    for uid in (1,2,7,20,21,22,23):
        assert request(workspace,'POST',path,uid,json=payloads[operation]).status_code==403
    assert request(workspace,'POST',path,8,json=payloads[operation]).status_code==200


def test_revision_is_owned_and_does_not_accept_foreign_systems(workspace):
    with Session(workspace.engine) as db:
        db.get(ManagedChangeRequest,100).status='Needs More Information'
        db.commit()
    body={**CHANGE_BODY,'revision_comment':'A4 authorized revision'}
    assert request(workspace,'PUT','/change-management/requests/100/revise',10,json=body).status_code==404
    assert request(workspace,'PUT','/change-management/requests/100/revise',2,json={**body,'affected_system_ids':[2001]}).status_code==404
    assert request(workspace,'PUT','/change-management/requests/100/revise',2,json=body).status_code==200
    with Session(workspace.engine) as db:
        assert db.get(ManagedChangeRequest,100).status=='Pending Approval'


def test_admin_cannot_cross_tenant_update_or_self_promote_through_extra_fields(workspace):
    before=user_snapshot(workspace.engine)
    assert request(workspace,'PATCH','/auth/admin/users/3',1,json={'is_active':'inactive'}).status_code==404
    assert request(workspace,'PATCH','/auth/admin/users/2',2,json={'role_name':'System Administrator'}).status_code==403
    assert request(workspace,'POST','/foundation/departments',7,json={'organization_id':2,'name':'Foreign mutation'}).status_code==403
    assert user_snapshot(workspace.engine)==before


def test_batch_b_finding_global_rule_mutation_is_still_shared_and_not_claimed_isolated(workspace):
    """Characterize the deferred HIGH finding; this is not a safety assertion."""
    created=request(workspace,'POST','/foundation/risk-rules',7,json=dict(name='A4 deferred global rule',
        condition_type='change_type',condition_value='application',score=10))
    assert created.status_code==201
    rule_id=created.json()['id']
    assert request(workspace,'PATCH',f'/foundation/risk-rules/{rule_id}',7,json={'score':77}).status_code==200
    remote=request(workspace,'GET','/foundation/risk-rules',9)
    assert remote.status_code==200 and next(row for row in remote.json() if row['id']==rule_id)['score']==77


def test_batch_c_finding_cab_label_is_not_independent_authorization(workspace):
    """Characterize deferred CAB enforcement without implementing Batch C."""
    with Session(workspace.engine) as db:
        assessment=db.query(ManagedImpactAssessment).filter_by(change_request_id=101).one()
        assessment.risk_level='Critical'; assessment.impact_score=95
        assessment.decision_recommendation='Do Not Proceed Without CAB Approval'
        db.commit()
    result=request(workspace,'POST','/change-management/requests/101/approvals',8,
        json={'decision':'Approved','approval_level':'CAB Review'})
    assert result.status_code==200
    with Session(workspace.engine) as db:
        assert db.get(ManagedChangeRequest,101).status=='Approved'
        assert db.query(ChangeApproval).filter_by(change_request_id=101).one().approval_level=='CAB Review'
