"""A4 owns only migrated, disposable A1 PostgreSQL schemas."""
from types import SimpleNamespace

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from a1_postgresql import a1_pg_engine, a1_postgres_url, assert_owned_test_connection
from app.models.foundation import ITService, ITSystem, Incident, Role, SystemDependency, User
from app.models.change_management import ManagedChangeRequest, ManagedChangeAffectedSystem, ManagedImpactAssessment
from app.models.change_execution import ChangeImplementation
from app.models.notification import Notification
from app.services.auth_service import create_access_token
from test_a3_invitations import invitations, original_password_hash, user_snapshot
from test_a2_authentication import bearer


@pytest.fixture
def workspace(invitations, original_password_hash):
    with Session(invitations.engine) as db:
        db.add_all([Role(id=11+i, organization_id=1, name=name) for i,name in enumerate(
            ("Admin", "System Owner", "Approver", "Viewer"))])
        db.flush()
        for uid,org,role,name in [(7,1,4,"CMDB Manager"),(8,1,5,"Change Manager"),
            (9,2,7,"Foreign Requester"),(10,1,3,"Other Requester"),
            (20,1,11,"Admin"),(21,1,12,"System Owner"),(22,1,13,"Approver"),
            (23,1,14,"Viewer"),(24,1,10,"Unknown Legacy Role")]:
            db.add(User(id=uid,organization_id=org,role_id=role,full_name=name,
                email=f"a4-{uid}@example.test",password_hash=original_password_hash,
                membership_source="legacy",is_active="active"))
        db.flush()
        db.add_all([ITService(id=i,organization_id=i,department_id=i,name=f"Service {i}",
            business_criticality="High") for i in (1,2)])
        db.flush()
        for sid,org,owner,name in [(1001,1,2,"Local System"),(1002,1,10,"Local Other"),
            (2001,2,3,"FOREIGN-SECRET-System"),(2002,2,9,"FOREIGN-SECRET-Other")]:
            db.add(ITSystem(id=sid,organization_id=org,department_id=org,service_id=org,
                owner_id=owner,name=name,criticality="High",environment="Production",status="Active"))
        db.flush()
        db.add_all([SystemDependency(id=1,source_system_id=1001,target_system_id=1002,
            dependency_type="Application",impact_level="High"),
            SystemDependency(id=2,source_system_id=2001,target_system_id=2002,
            dependency_type="Application",impact_level="High")])
        db.add_all([Incident(id=i,system_id=sid,title=title,severity="Low",status="Resolved")
            for i,sid,title in [(1,1001,"Local Incident"),(2,2001,"FOREIGN-SECRET-Incident")]])
        for cid,org,requester,title,status in [(100,1,2,"Local Change","Approved"),
            (101,1,10,"Other Change","Pending Approval"),(200,2,9,"FOREIGN-SECRET-Change","Pending Approval")]:
            db.add(ManagedChangeRequest(id=cid,organization_id=org,requester_id=requester,
                title=title,description="A4 controlled change description",change_type="application",
                status=status,expected_downtime_minutes=0))
        db.flush()
        for cid,sid in [(100,1001),(101,1002),(200,2001)]:
            db.add(ManagedChangeAffectedSystem(change_request_id=cid,system_id=sid))
            db.add(ManagedImpactAssessment(change_request_id=cid,risk_level="Low",impact_score=10,
                decision_recommendation="Proceed",ai_explanation="Controlled A4 assessment"))
        db.add(Notification(id=1,organization_id=1,recipient_id=2,actor_id=8,change_request_id=100,
            notification_type="A4_TEST",title="Local notification",message="Local message"))
        db.flush()
        assert_owned_test_connection(db.connection())
        for table in ("users","roles","departments","it_services","it_systems","system_dependencies",
                      "incidents","managed_change_requests","notifications"):
            db.execute(sa.text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                               f"COALESCE((SELECT max(id) FROM {table}), 1), true)"))
        db.commit()
        tokens={uid:create_access_token(db.get(User,uid)) for uid in (1,2,3,6,7,8,9,10,20,21,22,23,24)}
    yield SimpleNamespace(engine=invitations.engine,client=invitations.client,tokens=tokens)


def request(workspace,method,path,uid=2,**kwargs):
    return workspace.client.request(method,path,headers=bearer(workspace.tokens[uid]),**kwargs)


CHANGE_BODY=dict(title="A4 created change",description="A4 legitimate change description",change_type="application",
                 affected_system_ids=[1001])
