"""B2 contracts on owned PostgreSQL; no production settings or migrations."""
from datetime import datetime, timedelta
import pytest
from sqlalchemy.orm import Session
from alembic import command
from test_a5_playwright_pilot import a1_postgres_url, a1_pg_engine, invitations, workspace, original_password_hash
from a1_postgresql import assert_owned_test_connection
from a4_workspace import request
from app.models.foundation import User
from app.models.change_management import ManagedChangeRequest, ManagedImpactAssessment

PATHS = ['/change-management/dashboard/overview', '/change-management/dashboard/work-queues',
         '/change-management/dashboard/delivery-queues', '/change-management/requests/paged?page=1&page_size=5']

@pytest.fixture(autouse=True)
def no_migrations(monkeypatch):
    def reject(*_args, **_kwargs): pytest.fail('Migrations forbidden in B2 integration')
    monkeypatch.setattr(command, 'upgrade', reject)
    monkeypatch.setattr(command, 'downgrade', reject)

@pytest.fixture
def operations(workspace):
    with Session(workspace.engine) as db:
        assert_owned_test_connection(db.connection())
        start = datetime(2026, 1, 2, 10)
        for i, status in enumerate(['Pending Approval', 'Needs More Information', 'Rejected', 'In Progress', 'Implemented', 'Failed', 'Rolled Back', 'Closed']):
            db.add(ManagedChangeRequest(id=110+i, organization_id=1, requester_id=2, title=f'Operational {status}',
                description='Synthetic B2 contract', change_type='application', status=status,
                expected_downtime_minutes=0, created_at=start+timedelta(seconds=i)))
        for cid in (100,101,200): db.get(ManagedChangeRequest,cid).created_at = datetime(2026,1,1)
        db.commit()
    return workspace

def test_dashboard_counts_mean_record_statuses_not_partial_page_or_governance_completion(operations):
    w = operations
    overview = request(w,'GET',PATHS[0],8).json()
    assert {k:overview[k] for k in ['total_changes','pending_approval','approved','rejected','needs_more_information']} == {
        'total_changes':10,'pending_approval':2,'approved':1,'rejected':1,'needs_more_information':1}
    assert request(w,'GET',PATHS[1],8).json() == {'pending_review':2,'critical_pending':0,'high_pending':0,'awaiting_requester':1}
    assert request(w,'GET',PATHS[2],8).json() == {'approved_ready':1,'in_progress':1,'pending_pir':1,'failed':1}
    recent = request(w,'GET',PATHS[3],8).json()
    assert (recent['total'],recent['page'],recent['page_size'],recent['total_pages']) == (10,1,5,2)
    assert [r['id'] for r in recent['items']] == [117,116,115,114,113]
    assert {'id','requester_id','title','status','created_at','priority','change_type'} <= recent['items'][0].keys()
    # Approved is a record status; no implementation/CAB completion is asserted.
    assert request(w,'GET','/change-management/requests/100/implementation',8).json() is None

def test_requester_own_only_and_foreign_tenant_counts_filters_and_details(operations):
    w = operations
    assert request(w,'GET',PATHS[0]).json()['total_changes'] == 9
    assert request(w,'GET',PATHS[1]).json()['pending_review'] == 1
    assert request(w,'GET',PATHS[2]).json()['in_progress'] == 1
    assert request(w,'GET',PATHS[0],9).json()['total_changes'] == 1
    for status, expected in [('Pending Approval',2),('Needs More Information',1),('Approved',1),('In Progress',1),('Implemented',1),('Failed',1)]:
        data = request(w,'GET',PATHS[3],8,params={'status':status}).json()
        assert data['total'] == expected and all(r['status'] == status for r in data['items'])
    assert request(w,'GET',PATHS[3],2,params={'requester_id':10}).status_code == 403
    assert request(w,'GET',PATHS[3],2,params={'search':'FOREIGN-SECRET'}).json()['total'] == 0
    for uid, cid in [(2,101),(2,200),(8,200),(9,100)]:
        foreign = request(w,'GET',f'/change-management/requests/{cid}',uid)
        missing = request(w,'GET','/change-management/requests/999999',uid)
        assert foreign.status_code == missing.status_code == 404 and foreign.json() == missing.json()

@pytest.mark.parametrize('uid,allowed', [(1,False),(2,True),(7,True),(8,True),(20,False),(21,False),(22,False),(23,False),(24,False)])
def test_dashboard_endpoints_require_existing_changes_read_without_role_expansion(workspace,uid,allowed):
    for path in PATHS:
        assert request(workspace,'GET',path,uid).status_code == (200 if allowed else 403)

def test_empty_dashboard_and_same_jwt_role_revocation(workspace):
    with Session(workspace.engine) as db:
        db.get(User,7).role_id = 3  # Requester with no records, same tenant/JWT.
        db.commit()
    assert request(workspace,'GET',PATHS[0],7).json()['total_changes'] == 0
    assert request(workspace,'GET',PATHS[1],7).json()['pending_review'] == 0
    assert request(workspace,'GET',PATHS[2],7).json() == {'approved_ready':0,'in_progress':0,'pending_pir':0,'failed':0}
    assert request(workspace,'GET',PATHS[3],7).json() == {'items':[],'total':0,'page':1,'page_size':5,'total_pages':1}
    with Session(workspace.engine) as db:
        db.get(User,2).role_id = 2  # System Administrator: identity, no change reads.
        db.commit()
    assert request(workspace,'GET','/auth/me').status_code == 200
    for path in PATHS: assert request(workspace,'GET',path).status_code == 403

def test_overview_assessments_are_historical_so_the_dashboard_must_not_publish_risk_averages(workspace):
    with Session(workspace.engine) as db:
        db.add(ManagedImpactAssessment(change_request_id=100,risk_level='High',impact_score=90,
            decision_recommendation='Synthetic stored result',ai_explanation='No risk calculation'))
        db.commit()
    overview = request(workspace,'GET',PATHS[0]).json()
    assert overview['total_changes'] == 1
    assert overview['average_impact_score'] == 50
    assert overview['low_risk'] == overview['high_risk'] == 1
