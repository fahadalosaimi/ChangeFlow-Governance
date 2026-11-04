"""D1 permissions and read-state writes, on owned ORM PostgreSQL only."""
from datetime import datetime
import pytest
from alembic import command
from sqlalchemy import text
from sqlalchemy.orm import Session
from test_a5_playwright_pilot import a1_postgres_url,a1_pg_engine,invitations,workspace,original_password_hash
from a1_postgresql import assert_owned_test_connection
from a4_workspace import request
from app.models.foundation import User
from app.models.notification import Notification
from test_a4_notifications import (
    test_missing_or_unclassified_resource_references_fail_closed_but_general_notices_survive,
    test_notification_listing_query_count_does_not_grow_per_resource,
)

@pytest.fixture(autouse=True)
def no_migrations(monkeypatch):
    def fail(*_a,**_kw):pytest.fail('Migrations forbidden in D1')
    monkeypatch.setattr(command,'upgrade',fail);monkeypatch.setattr(command,'downgrade',fail)

def seed_notices(db):
    assert_owned_test_connection(db.connection())
    db.get(Notification,1).created_at=datetime(2026,1,1)
    for nid,org,recipient,cid,actor,kind,title,read in [
        (10,1,2,None,None,'GENERAL','Service maintenance',False),
        (11,1,2,100,8,'CHANGE_SUBMITTED','billing/payments',False),
        (12,1,10,101,8,'CHANGE_SUBMITTED','Other recipient',False),
        (13,2,9,200,3,'CHANGE_SUBMITTED','FOREIGN-NOTICE',False),
        (14,1,2,200,8,'CHANGE_SUBMITTED','FOREIGN-RESOURCE',False),
        (15,1,2,100,3,'CHANGE_SUBMITTED','FOREIGN-ACTOR',False),
        (16,1,2,None,None,'CHANGE_SUBMITTED','ORPHAN-NOTICE',False),
        (17,1,2,None,None,'GENERAL','Read service notice',True),
    ]:
        db.add(Notification(id=nid,organization_id=org,recipient_id=recipient,change_request_id=cid,actor_id=actor,
            notification_type=kind,title=title,message='Synthetic notification details',is_read=read,
            created_at=datetime(2026,1,1),read_at=datetime(2026,1,2) if read else None))
    db.flush();db.execute(text("SELECT setval(pg_get_serial_sequence('notifications','id'), (SELECT max(id) FROM notifications), true)"))

@pytest.fixture
def notices(workspace):
    with Session(workspace.engine) as db:seed_notices(db);db.commit()
    return workspace

def snapshot(w):
    with Session(w.engine) as db:return {r.id:{c.name:getattr(r,c.name) for c in Notification.__table__.columns} for r in db.query(Notification)}

def test_d1_scoped_count_page_filters_search_and_metadata(notices):
    assert request(notices,'GET','/notifications/unread-count').json()=={'unread_count':3}
    result=request(notices,'GET','/notifications/paged?page=2&page_size=2').json()
    assert (result['total'],result['total_pages'],result['page'],result['page_size'])==(4,2,2,2)
    assert [r['id'] for r in result['items']]==[10,1]
    assert request(notices,'GET','/notifications/paged?unread_only=true').json()['total']==3
    assert request(notices,'GET','/notifications/paged?notification_type=GENERAL').json()['total']==2
    assert [r['id'] for r in request(notices,'GET','/notifications/paged',params={'search':'billing/payments'}).json()['items']]==[11]
    for secret in ['FOREIGN','ORPHAN','Other recipient']:
        assert request(notices,'GET','/notifications/paged',params={'search':secret}).json()['total']==0

def test_d1_mark_one_returns_server_timestamp_and_repeat_preserves_it(notices):
    before=snapshot(notices)
    one=request(notices,'PATCH','/notifications/11/read')
    assert one.status_code==200 and one.json()['is_read'] is True and one.json()['read_at'] is not None
    again=request(notices,'PATCH','/notifications/11/read')
    assert again.json()['read_at']==one.json()['read_at']
    after=snapshot(notices)
    assert all(after[nid]==row for nid,row in before.items() if nid!=11)
    assert after[11]['is_read'] and after[11]['read_at'] is not None
    assert request(notices,'GET','/notifications/unread-count').json()['unread_count']==2
    assert request(notices,'GET','/notifications/paged?unread_only=true').json()['total']==2

def test_d1_mark_all_updates_only_visible_unread_rows_and_is_repeatable_without_new_dates(notices):
    before=snapshot(notices)
    assert request(notices,'PATCH','/notifications/read-all').json()=={'updated_count':3}
    after=snapshot(notices)
    for nid,row in before.items():
        if nid in {1,10,11}:
            assert after[nid]['is_read'] and after[nid]['read_at'] is not None
            assert {k:v for k,v in after[nid].items() if k not in {'is_read','read_at'}}=={k:v for k,v in row.items() if k not in {'is_read','read_at'}}
        else:assert after[nid]==row
    assert request(notices,'PATCH','/notifications/read-all').json()=={'updated_count':0}
    assert snapshot(notices)==after
    assert request(notices,'GET','/notifications/unread-count').json()['unread_count']==0
    assert request(notices,'GET','/notifications/paged?unread_only=true').json()['items']==[]

def test_d1_denied_recipient_foreign_actor_resource_and_missing_have_generic_404_without_write(notices):
    before=snapshot(notices)
    missing=request(notices,'PATCH','/notifications/999999/read')
    for nid in [12,13,14,15,16]:
        denied=request(notices,'PATCH',f'/notifications/{nid}/read')
        assert denied.status_code==missing.status_code==404 and denied.json()==missing.json()
    assert request(notices,'PATCH','/notifications/11/read',9).status_code==404
    assert snapshot(notices)==before

def test_d1_current_role_and_active_membership_enforced_for_every_operation(notices):
    with Session(notices.engine) as db:db.get(User,2).role_id=2;db.commit()
    assert request(notices,'GET','/notifications/unread-count').json()['unread_count']==1
    assert {r['id'] for r in request(notices,'GET','/notifications/paged').json()['items']}=={10,17}
    before=snapshot(notices)
    assert request(notices,'PATCH','/notifications/11/read').status_code==404
    assert request(notices,'PATCH','/notifications/read-all').json()=={'updated_count':1}
    assert snapshot(notices)[11]==before[11] and snapshot(notices)[1]==before[1]
    with Session(notices.engine) as db:db.get(User,2).role_id=3;db.commit()
    assert request(notices,'GET','/notifications/unread-count').json()['unread_count']==2
    with Session(notices.engine) as db:db.get(User,2).is_active='inactive';db.commit()
    for method,path in [('GET','/notifications/paged'),('GET','/notifications/unread-count'),('PATCH','/notifications/11/read'),('PATCH','/notifications/read-all')]:
        assert request(notices,method,path).status_code==401

@pytest.mark.parametrize('uid,allowed',[(1,True),(2,True),(7,True),(8,True),(20,True),(21,True),(22,True),(23,True),(24,False)])
def test_d1_notifications_own_grant_not_changes_read_controls_general_notices(workspace,uid,allowed):
    with Session(workspace.engine) as db:
        row=Notification(organization_id=1,recipient_id=uid,notification_type='GENERAL',title='Owned general',message='Synthetic notice')
        db.add(row);db.flush();nid=row.id;db.commit()
    for method,path in [('GET','/notifications/paged'),('GET','/notifications/unread-count'),('PATCH',f'/notifications/{nid}/read'),('PATCH','/notifications/read-all')]:
        assert request(workspace,method,path,uid).status_code==(200 if allowed else 403)
