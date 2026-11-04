"""Real C2A mutations on owned synthetic ORM PostgreSQL; no production settings."""
import pytest
from alembic import command
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from test_a5_playwright_pilot import a1_postgres_url,a1_pg_engine,invitations,workspace,original_password_hash
from a1_postgresql import assert_owned_test_connection
from a4_workspace import request
from app.models.change_management import ManagedChangeRequest,ManagedChangeAffectedSystem,ManagedImpactAssessment,ChangeStatusHistory

BODY=dict(title='Synthetic C2A request',description='Synthetic request description',change_type='application',change_mode='Normal',priority='Medium',
    affected_system_ids=[1001],expected_downtime_minutes=20,rollback_complexity='Medium',security_sensitivity='High',
    business_justification='Controlled integration',planned_start='2026-12-01T10:00:00',planned_end='2026-12-01T11:00:00')

@pytest.fixture(autouse=True)
def forbid_migrations(monkeypatch):
    def fail(*_a,**_kw):pytest.fail('Migrations forbidden in C2A')
    monkeypatch.setattr(command,'upgrade',fail);monkeypatch.setattr(command,'downgrade',fail)

def eligible(w):
    with Session(w.engine) as db:
        assert_owned_test_connection(db.connection())
        db.get(ManagedChangeRequest,100).status='Needs More Information';db.commit()

def test_create_persists_local_request_association_assessment_and_history(workspace):
    result=request(workspace,'POST','/change-management/requests',json=BODY)
    assert result.status_code==200
    data=result.json();cid=data['id']
    assert data['requester_id']==2 and data['status']=='Pending Approval' and data['affected_system_ids']==[1001]
    assert data['latest_assessment'] is not None
    assert request(workspace,'GET',f'/change-management/requests/{cid}').json()==data
    with Session(workspace.engine) as db:
        assert_owned_test_connection(db.connection())
        row=db.get(ManagedChangeRequest,cid)
        assert row.organization_id==1 and row.title==BODY['title'] and row.expected_downtime_minutes==20
        assert db.query(ManagedChangeAffectedSystem).filter_by(change_request_id=cid,system_id=1001).count()==1
        assert db.query(ManagedImpactAssessment).filter_by(change_request_id=cid).count()==1
        assert db.query(ChangeStatusHistory).filter_by(change_request_id=cid,new_status='Pending Approval').count()==1
    assert request(workspace,'GET',f'/change-management/requests/{cid}',9).status_code==404

def test_revision_updates_only_own_eligible_record_and_appends_assessment_history(workspace):
    eligible(workspace)
    result=request(workspace,'PUT','/change-management/requests/100/revise',json={**BODY,'title':'Revised synthetic request','revision_comment':'Corrected scope'})
    assert result.status_code==200 and result.json()['status']=='Pending Approval'
    with Session(workspace.engine) as db:
        assert_owned_test_connection(db.connection())
        row=db.get(ManagedChangeRequest,100)
        assert row.organization_id==1 and row.requester_id==2 and row.title=='Revised synthetic request'
        assert db.query(ManagedImpactAssessment).filter_by(change_request_id=100).count()==2
        history=db.query(ChangeStatusHistory).filter_by(change_request_id=100).one()
        assert history.old_status=='Needs More Information' and history.new_status=='Pending Approval' and history.changed_by==2
    second=request(workspace,'PUT','/change-management/requests/100/revise',json={**BODY,'revision_comment':'Do not repeat'})
    assert second.status_code==400

@pytest.mark.parametrize('patch',[{'title':'ab'},{'title':'x'*256},{'description':'short'},{'change_type':'invented'},
    {'change_mode':'normal'},{'priority':'unknown'},{'expected_downtime_minutes':-1},{'expected_downtime_minutes':43201},
    {'affected_system_ids':[]},{'affected_system_ids':[1001,1001]},{'business_justification':'x'*8001},
    {'planned_start':'2026-02-30T10:00:00'},{'planned_end':'2026-01-01T10:00:00'},{'tenant_id':2}])
def test_invalid_create_never_writes_postgresql(workspace,patch):
    result=request(workspace,'POST','/change-management/requests',json={**BODY,**patch})
    assert result.status_code==422
    with Session(workspace.engine) as db:assert db.query(ManagedChangeRequest).count()==3

@pytest.mark.parametrize('uid,allowed',[(1,False),(2,True),(7,False),(8,False),(20,False),(21,False),(22,False),(23,False),(24,False)])
def test_current_role_permissions_enforced_for_create_and_revision(workspace,uid,allowed):
    eligible(workspace)
    created=request(workspace,'POST','/change-management/requests',uid,json=BODY)
    revised=request(workspace,'PUT','/change-management/requests/100/revise',uid,json={**BODY,'revision_comment':'Controlled correction'})
    assert created.status_code==(200 if allowed else 403)
    assert revised.status_code==(200 if allowed else 403)

def test_foreign_systems_requesters_and_tenants_rejected_without_partial_writes(workspace):
    eligible(workspace)
    for ids in [[2001],[1001,2001],[999999]]:
        assert request(workspace,'POST','/change-management/requests',json={**BODY,'affected_system_ids':ids}).status_code==404
        assert request(workspace,'PUT','/change-management/requests/100/revise',json={**BODY,'affected_system_ids':ids,'revision_comment':'Controlled correction'}).status_code==404
    for cid,uid in [(100,9),(100,10),(101,2),(200,2),(999999,2)]:
        assert request(workspace,'PUT',f'/change-management/requests/{cid}/revise',uid,json={**BODY,'revision_comment':'Controlled correction'}).status_code==404
    with Session(workspace.engine) as db:
        assert db.query(ManagedChangeRequest).count()==3
        assert db.get(ManagedChangeRequest,100).status=='Needs More Information'
        assert db.query(ManagedImpactAssessment).count()==3

def test_revision_requires_state_and_nonblank_comment(workspace):
    assert request(workspace,'PUT','/change-management/requests/100/revise',json={**BODY,'revision_comment':'Controlled correction'}).status_code==400
    eligible(workspace)
    for comment,code in [('',422),('ab',422),('   ',400),('x'*4001,422)]:
        assert request(workspace,'PUT','/change-management/requests/100/revise',json={**BODY,'revision_comment':comment}).status_code==code

def test_postgresql_foreign_key_rejects_missing_system_and_catalog_is_scoped(workspace):
    catalog=request(workspace,'GET','/foundation/systems').json()
    assert {s['id'] for s in catalog}=={1001,1002}
    with Session(workspace.engine) as db:
        assert_owned_test_connection(db.connection())
        with pytest.raises(IntegrityError):
            with db.begin_nested():
                db.add(ManagedChangeAffectedSystem(change_request_id=100,system_id=999999));db.flush()
