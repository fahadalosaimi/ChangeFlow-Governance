"""C1 read contracts on owned ORM/PostgreSQL, no migration or risk recompute."""
import json
from datetime import datetime
import pytest
from sqlalchemy.orm import Session
from alembic import command
from test_a5_playwright_pilot import a1_postgres_url,a1_pg_engine,invitations,workspace,original_password_hash
from test_a5_t4_b2 import operations
from a1_postgresql import assert_owned_test_connection
from a4_workspace import request
from app.models.change_management import ManagedChangeRequest,ManagedImpactAssessment

@pytest.fixture(autouse=True)
def no_migrations(monkeypatch):
    def reject(*_args,**_kwargs):pytest.fail('No migrations in C1')
    monkeypatch.setattr(command,'upgrade',reject)
    monkeypatch.setattr(command,'downgrade',reject)

def test_paged_and_unpaged_contracts_keep_totals_order_and_all_read_fields(operations):
    w=operations
    all_rows=request(w,'GET','/change-management/requests',8).json()
    assert {r['id'] for r in all_rows}=={100,101,110,111,112,113,114,115,116,117}
    page=request(w,'GET','/change-management/requests/paged?page=2&page_size=5',8).json()
    assert (page['total'],page['page'],page['page_size'],page['total_pages'])==(10,2,5,2)
    assert [r['id'] for r in page['items']]==[112,111,110,101,100]
    assert set(page['items'][0])=={'id','requester_id','requester_name','requester_email','title','description','change_type','change_mode','priority','status',
        'expected_downtime_minutes','rollback_complexity','security_sensitivity','business_justification','planned_start','planned_end','created_at','updated_at','affected_system_ids','latest_assessment'}
    beyond=request(w,'GET','/change-management/requests/paged?page=9&page_size=5',8).json()
    assert beyond['items']==[] and beyond['page']==9 and beyond['total_pages']==2

def test_server_search_slash_requester_type_risk_and_inclusive_date_filters(workspace):
    with Session(workspace.engine) as db:
        assert_owned_test_connection(db.connection())
        row=db.get(ManagedChangeRequest,100)
        row.title='billing/payments';row.created_at=datetime(2026,1,2,23,59,59)
        db.commit()
    path='/change-management/requests/paged'
    for params in [dict(search='billing/payments'),dict(requester_id=2),dict(status='Approved',change_type='application',risk_level='Low'),dict(created_from='2026-01-02',created_to='2026-01-02')]:
        result=request(workspace,'GET',path,8,params=params)
        assert result.status_code==200 and result.json()['total']==1 and result.json()['items'][0]['id']==100
    assert request(workspace,'GET',path,2,params={'requester_id':10}).status_code==403
    assert request(workspace,'GET',path,8,params={'search':'FOREIGN-SECRET'}).json()['total']==0
    assert request(workspace,'GET',path,8,params={'created_from':'2026-02-02','created_to':'2026-01-01'}).status_code==400

def test_detail_selects_latest_saved_assessment_without_computing_or_claiming_governance(workspace):
    with Session(workspace.engine) as db:
        db.add(ManagedImpactAssessment(change_request_id=100,risk_level='Unknown stored value',impact_score=64,
            decision_recommendation='Stored suggestion',ai_explanation='Stored historical rationale',risk_factors=json.dumps(['Stored factor']),
            recommendations=json.dumps(['Stored recommendation'])))
        db.commit()
    data=request(workspace,'GET','/change-management/requests/100').json()
    assert data['latest_assessment']['impact_score']==64
    assert data['latest_assessment']['risk_level']=='Unknown stored value'
    assert data['latest_assessment']['risk_factors']==['Stored factor']
    assert data['affected_system_ids']==[1001] and data['requester_id']==2
    for suffix in ['history','approvals','implementation']:
        assert request(workspace,'GET','/change-management/requests/100/'+suffix).status_code==200

def test_absent_assessment_remains_null_and_requester_scope_does_not_widen(workspace):
    with Session(workspace.engine) as db:
        db.query(ManagedImpactAssessment).filter_by(change_request_id=100).delete()
        db.commit()
    assert request(workspace,'GET','/change-management/requests/100').json()['latest_assessment'] is None
    assert [r['id'] for r in request(workspace,'GET','/change-management/requests').json()]==[100]
    for uid,cid in [(2,101),(2,200),(8,200),(9,100)]:
        foreign=request(workspace,'GET',f'/change-management/requests/{cid}',uid)
        missing=request(workspace,'GET','/change-management/requests/999999',uid)
        assert foreign.status_code==missing.status_code==404 and foreign.json()==missing.json()

@pytest.mark.parametrize('uid,allowed',[(1,False),(2,True),(7,True),(8,True),(20,False),(21,False),(22,False),(23,False),(24,False)])
def test_c1_all_read_endpoints_require_current_database_grants(workspace,uid,allowed):
    for suffix in ['','/paged','/100']:
        assert request(workspace,'GET','/change-management/requests'+suffix,uid).status_code==(200 if allowed else 403)
