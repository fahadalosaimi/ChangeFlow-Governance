"""Actual DB results must exclude foreign resources, including nested actors."""
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from a4_workspace import workspace, request, CHANGE_BODY
from a1_postgresql import a1_pg_engine, a1_postgres_url
from test_a3_invitations import invitations, original_password_hash, user_snapshot
from app.models.foundation import SystemDependency, UserAdministrationAudit
from app.models.change_management import ManagedChangeRequest, ManagedChangeAffectedSystem, ManagedImpactAssessment, ChangeStatusHistory, AuditLog, ChangeApproval
from app.models.change_execution import ChangeImplementation
from app.models.notification import Notification


def test_dependency_lists_counts_and_impact_profile_scope_both_endpoints(workspace):
    with Session(workspace.engine) as db:
        db.add_all([SystemDependency(id=3,source_system_id=1001,target_system_id=2001,
            dependency_type="Application",impact_level="Critical"),
            SystemDependency(id=4,source_system_id=2002,target_system_id=1001,
            dependency_type="Application",impact_level="Critical")])
        db.commit()
    for path in ("/foundation/dependencies","/foundation/systems/1001/dependencies"):
        result=request(workspace,"GET",path)
        assert result.status_code==200 and [row['id'] for row in result.json()]==[1],result.text
    assert request(workspace,"GET","/foundation/overview").json()['dependencies']==1
    profile=request(workspace,"GET","/foundation/systems/1001/impact-profile")
    assert profile.status_code==200 and 'FOREIGN-SECRET' not in profile.text
    with Session(workspace.engine) as db:
        assert db.query(SystemDependency).count()==4  # quarantine never deletes history


@pytest.mark.parametrize("relation",["requester","affected_system","history_actor","audit_actor","approver","coordinator"])
def test_changes_with_foreign_nested_resources_are_not_read_or_counted(workspace,relation):
    with Session(workspace.engine) as db:
        # Distinct stored assessments detect leakage even if the parent count is scoped.
        for cid, score, risk in ((100, 95, 'Critical'), (101, 30, 'Medium'), (200, 80, 'High')):
            assessment = db.query(ManagedImpactAssessment).filter_by(change_request_id=cid).one()
            assessment.impact_score, assessment.risk_level = score, risk
        if relation=='requester': db.get(ManagedChangeRequest,100).requester_id=3
        elif relation=='affected_system': db.add(ManagedChangeAffectedSystem(change_request_id=100,system_id=2001))
        elif relation=='history_actor': db.add(ChangeStatusHistory(change_request_id=100,new_status="Approved",changed_by=3))
        elif relation=='audit_actor': db.add(AuditLog(change_request_id=100,actor_id=3,action="TEST",entity_type="Change",details="FOREIGN-SECRET"))
        elif relation=='approver': db.add(ChangeApproval(change_request_id=100,approver_id=3,decision="Approved",approval_level="Manager Review"))
        else: db.add(ChangeImplementation(change_request_id=100,coordinator_id=3))
        db.commit()
    for suffix in ('','/history','/audit-logs','/approvals','/implementation'):
        response=request(workspace,"GET",'/change-management/requests/100'+suffix,8)
        assert response.status_code==404,(relation,suffix,response.text)
    result=request(workspace,"GET","/change-management/requests/paged",8).json()
    assert result['total']==1 and [row['id'] for row in result['items']]==[101]
    dashboard=request(workspace,"GET","/change-management/dashboard/overview",8).json()
    assert dashboard == dict(total_changes=1, pending_approval=1, approved=0, rejected=0,
        needs_more_information=0, critical_risk=0, high_risk=0, medium_risk=1, low_risk=0,
        average_impact_score=30)
    assert request(workspace,"GET","/change-management/dashboard/delivery-queues",8).json()['approved_ready']==0
    # Mutations must use the same scope; no lifecycle side effects on the bad row.
    for method,suffix,uid,payload in change_mutations():
        response=request(workspace,method,"/change-management/requests/100"+suffix,uid,json=payload)
        assert response.status_code==404,(relation,method,suffix,response.text)
    with Session(workspace.engine) as db:
        assert db.get(ManagedChangeRequest,100).status=='Approved'


def test_administration_audit_cannot_expose_foreign_actor_name_or_search_matches(workspace):
    with Session(workspace.engine) as db:
        db.add(UserAdministrationAudit(actor_id=3,target_user_id=2,action="ROLE_CHANGED",details="Synthetic foreign actor"))
        db.commit()
    result=request(workspace,"GET","/auth/admin/audit-logs",1)
    assert result.status_code==200 and result.json()==[]
    result=request(workspace,"GET","/auth/admin/audit-logs/paged?search=Existing",1).json()
    assert result['total']==0 and result['items']==[]


@pytest.mark.parametrize("relation",['actor','change'])
def test_notification_counts_search_and_updates_reject_foreign_relations(workspace,relation):
    with Session(workspace.engine) as db:
        db.add(Notification(id=2,organization_id=1,recipient_id=2,actor_id=3 if relation=='actor' else 8,
            change_request_id=200 if relation=='change' else 100,notification_type="A4_TEST",
            title="FOREIGN-SECRET",message="must not be exposed"))
        db.commit()
    assert request(workspace,"GET","/notifications/unread-count").json()['unread_count']==1
    assert request(workspace,"GET","/notifications/paged?search=FOREIGN-SECRET").json()['total']==0
    assert request(workspace,"PATCH","/notifications/2/read").status_code==404
    assert request(workspace,"PATCH","/notifications/read-all").json()['updated_count']==1
    with Session(workspace.engine) as db:
        assert db.get(Notification,1).is_read and not db.get(Notification,2).is_read


@pytest.mark.parametrize("path",['/foundation/systems/2001','/foundation/systems/2001/dependencies',
    '/foundation/systems/2001/impact-profile','/change-management/requests/200',
    '/change-management/requests/200/history','/change-management/requests/200/approvals',
    '/change-management/requests/200/implementation'])
def test_foreign_and_missing_ids_have_identical_responses(workspace,path):
    foreign=request(workspace,'GET',path,8)
    absent=request(workspace,'GET',path.replace('2001','99999').replace('/200','/99999'),8)
    assert foreign.status_code==absent.status_code==404
    assert foreign.json()==absent.json()
    if path=='/change-management/requests/200':
        for method,suffix,uid,payload in change_mutations():
            foreign=request(workspace,method,path+suffix,uid,json=payload)
            absent=request(workspace,method,'/change-management/requests/99999'+suffix,uid,json=payload)
            assert foreign.status_code==absent.status_code==404
            assert foreign.json()==absent.json()
        with Session(workspace.engine) as db:
            assert db.get(ManagedChangeRequest,200).status=='Pending Approval'


def change_mutations():
    return [
        ('POST','/approvals',8,{'decision':'Approved'}),
        ('PUT','/revise',2,{**CHANGE_BODY,'revision_comment':'A4 foreign mutation'}),
        ('POST','/implementation/start',8,{}),
        ('POST','/implementation/complete',8,{'completion_summary':'Controlled complete','validation_results':'Controlled checks'}),
        ('POST','/implementation/fail',8,{'failure_summary':'Controlled failure'}),
        ('POST','/implementation/rollback',8,{'rollback_reason':'Controlled rollback'}),
        ('POST','/implementation/post-implementation-review',8,{'pir_result':'Successful','pir_summary':'Controlled review'}),
    ]


def test_requester_lists_search_counts_and_headers_cannot_access_another_requester(workspace):
    result=workspace.client.request('GET','/change-management/requests/paged?requester_id=10&organization_id=2',
        headers={'Authorization':'Bearer '+workspace.tokens[2],'X-Organization-ID':'2'})
    assert result.status_code==403  # explicit filter cannot broaden own-record scope
    assert request(workspace,'GET','/change-management/requests/paged?search=FOREIGN-SECRET').json()['total']==0
    assert request(workspace,'GET','/change-management/requests/101').status_code==404
    assert request(workspace,'GET','/change-management/dashboard/overview').json()['total_changes']==1


def test_dashboard_aggregations_separate_tenants_and_requesters_with_distinct_stored_scores(workspace):
    # Stored assessments isolate authorization from Batch B's global rule calculation.
    with Session(workspace.engine) as db:
        for cid, score, risk in ((100, 10, 'Low'), (101, 30, 'Medium'), (200, 80, 'High')):
            assessment = db.query(ManagedImpactAssessment).filter_by(change_request_id=cid).one()
            assessment.impact_score, assessment.risk_level = score, risk
        db.get(ManagedChangeRequest, 200).status = 'Needs More Information'
        db.add_all([ManagedChangeRequest(id=201, organization_id=2, requester_id=9,
            title='Foreign rejected', description='Synthetic', change_type='application', status='Rejected'),
            ManagedChangeRequest(id=202, organization_id=2, requester_id=9,
            title='Foreign approved', description='Synthetic', change_type='application', status='Approved')])
        db.flush()
        for cid, score in ((201, 90), (202, 100)):
            db.add(ManagedImpactAssessment(change_request_id=cid, risk_level='Critical', impact_score=score,
                decision_recommendation='Controlled stored assessment', ai_explanation='No global rule evaluation'))
        db.commit()
    cases = [
        (8, dict(total_changes=2, pending_approval=1, approved=1, rejected=0, needs_more_information=0,
            critical_risk=0, high_risk=0, medium_risk=1, low_risk=1, average_impact_score=20)),
        (2, dict(total_changes=1, pending_approval=0, approved=1, rejected=0, needs_more_information=0,
            critical_risk=0, high_risk=0, medium_risk=0, low_risk=1, average_impact_score=10)),
        (9, dict(total_changes=3, pending_approval=0, approved=1, rejected=1, needs_more_information=1,
            critical_risk=2, high_risk=1, medium_risk=0, low_risk=0, average_impact_score=90)),
    ]
    for uid, expected in cases:
        response = request(workspace, 'GET', '/change-management/dashboard/overview', uid)
        assert response.status_code == 200 and response.json() == expected


@pytest.mark.parametrize("path,payload",[
    ('/foundation/systems',{'name':'Cross department','department_id':2}),
    ('/foundation/systems',{'name':'Cross service','service_id':2}),
    ('/foundation/systems',{'name':'Cross owner','owner_id':3}),
    ('/foundation/incidents',{'title':'Foreign incident','system_id':2001}),
    ('/foundation/dependencies',{'source_system_id':1001,'target_system_id':2001,'dependency_type':'Application'}),
])
def test_foreign_fk_inputs_are_rejected_before_any_mutation(workspace,path,payload):
    with workspace.engine.connect() as db:
        before={table:db.scalar(sa.text(f'SELECT count(*) FROM {table}')) for table in
            ('it_systems','incidents','system_dependencies')}
    assert request(workspace,'POST',path,7,json=payload).status_code==404
    with workspace.engine.connect() as db:
        assert before=={table:db.scalar(sa.text(f'SELECT count(*) FROM {table}')) for table in before}
