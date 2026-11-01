"""Current resource access controls historic notification content, without erasure."""
import pytest
import sqlalchemy as sa
from sqlalchemy.orm import Session

from a4_workspace import workspace, request, CHANGE_BODY
from a1_postgresql import a1_pg_engine, a1_postgres_url
from test_a3_invitations import invitations, original_password_hash, user_snapshot
from app.database import get_db
from app.main import app
from app.models.foundation import User, UserAdministrationAudit
from app.models.change_management import ManagedChangeRequest, AuditLog, ChangeStatusHistory
from app.models.notification import Notification


def rows(engine, model):
    with engine.connect() as db:
        return {row['id']: dict(row) for row in db.execute(
            sa.select(model.__table__).order_by(model.id)).mappings()}


def test_downgrade_hides_generated_content_from_every_notification_operation_without_erasure(workspace):
    original_users = user_snapshot(workspace.engine)
    with Session(workspace.engine) as db:
        db.get(ManagedChangeRequest, 101).requester_id = 8
        own = Notification(organization_id=1, recipient_id=8, actor_id=1, change_request_id=101,
            notification_type='CHANGE_APPROVED', title='Allowed own notification', message='Allowed own message')
        general = Notification(organization_id=1, recipient_id=8, notification_type='GENERAL',
            title='General notice', message='Service hours notice')
        foreign = Notification(organization_id=2, recipient_id=9, change_request_id=200,
            notification_type='CHANGE_SUBMITTED', title='Foreign inbox', message='Foreign message')
        db.add_all([own, general, foreign])
        db.flush()
        allowed_ids = {own.id, general.id}
        db.commit()

    created = request(workspace, 'POST', '/change-management/requests', 2,
        json={**CHANGE_BODY, 'title': 'R1-SECRET-PROJECT'})
    assert created.status_code == 200, created.text
    change_id = created.json()['id']
    with Session(workspace.engine) as db:
        hidden = db.query(Notification).filter_by(recipient_id=8, change_request_id=change_id).one()
        hidden_id = hidden.id
        assert 'R1-SECRET-PROJECT' in hidden.message

    assert request(workspace, 'GET', f'/change-management/requests/{change_id}', 8).status_code == 200
    before_page = request(workspace, 'GET', '/notifications/paged', 8)
    assert before_page.status_code == 200 and before_page.json()['total'] == 3
    assert 'R1-SECRET-PROJECT' in before_page.text
    assert request(workspace, 'GET', '/notifications/unread-count', 8).json() == {'unread_count': 3}

    assert request(workspace, 'PATCH', '/auth/admin/users/8', 1,
        json={'role_name': 'Requester'}).status_code == 200
    downgraded_users = user_snapshot(workspace.engine)
    assert [(u.id, u.password_hash) for u in downgraded_users] == [
        (u.id, u.password_hash) for u in original_users]
    assert [u for u in downgraded_users if u.id != 8] == [u for u in original_users if u.id != 8]
    before = rows(workspace.engine, Notification)
    history = {model: rows(workspace.engine, model) for model in
        (AuditLog, ChangeStatusHistory, UserAdministrationAudit)}
    users = user_snapshot(workspace.engine)
    # The same pre-downgrade JWT must now respect the new DB role.
    assert request(workspace, 'GET', f'/change-management/requests/{change_id}', 8).status_code == 404
    assert request(workspace, 'GET', '/notifications/unread-count', 8).json() == {'unread_count': 2}
    visible_ids = set()
    for page in (1, 2, 3):
        response = request(workspace, 'GET', f'/notifications/paged?page_size=1&page={page}', 8)
        assert response.status_code == 200
        result = response.json()
        assert (result['total'], result['total_pages']) == (2, 2)
        visible_ids.update(row['id'] for row in result['items'])
        assert 'R1-SECRET-PROJECT' not in response.text and 'Existing User 2' not in response.text
    assert visible_ids == allowed_ids
    for secret in ('R1-SECRET-PROJECT', 'New change request submitted', 'Existing User 2'):
        result = request(workspace, 'GET', '/notifications/paged', 8, params={'search': secret}).json()
        assert result['items'] == [] and (result['total'], result['total_pages']) == (0, 1)
    assert request(workspace, 'GET', '/notifications/paged?notification_type=CHANGE_SUBMITTED', 8).json()['total'] == 0
    denied = request(workspace, 'PATCH', f'/notifications/{hidden_id}/read', 8)
    missing = request(workspace, 'PATCH', '/notifications/999999/read', 8)
    assert denied.status_code == missing.status_code == 404 and denied.json() == missing.json()
    assert rows(workspace.engine, Notification) == before
    assert request(workspace, 'PATCH', '/notifications/read-all', 8).json() == {'updated_count': 2}
    after = rows(workspace.engine, Notification)
    assert after.keys() == before.keys()
    for notification_id, row in before.items():
        if notification_id in allowed_ids:
            assert after[notification_id]['is_read'] and after[notification_id]['read_at'] is not None
            assert {k: v for k, v in after[notification_id].items() if k not in ('is_read', 'read_at')} == {
                k: v for k, v in row.items() if k not in ('is_read', 'read_at')}
        else:
            assert after[notification_id] == row  # includes other recipients and the other tenant
    assert user_snapshot(workspace.engine) == users
    assert all(rows(workspace.engine, model) == snapshot for model, snapshot in history.items())
    assert request(workspace, 'GET', '/notifications/unread-count', 8).json() == {'unread_count': 0}
    # Restoring access exposes the original, unmodified historic notification.
    assert request(workspace, 'PATCH', '/auth/admin/users/8', 1,
        json={'role_name': 'Change Manager'}).status_code == 200
    restored = request(workspace, 'GET', '/notifications/paged?search=R1-SECRET-PROJECT', 8).json()
    assert restored['total'] == 1 and restored['items'][0]['id'] == hidden_id
    assert rows(workspace.engine, Notification)[hidden_id] == before[hidden_id]
    assert request(workspace, 'PATCH', f'/notifications/{hidden_id}/read', 8).status_code == 200


@pytest.mark.parametrize('uid,can_read_change', [(1, False), (2, True), (7, True), (8, True),
    (20, False), (21, False), (22, False), (23, False)])
def test_linked_notifications_follow_all_current_role_grants(workspace, uid, can_read_change):
    with Session(workspace.engine) as db:
        linked = Notification(organization_id=1, recipient_id=uid, change_request_id=100,
            notification_type='CHANGE_CLOSED', title='Protected title', message='Protected message')
        general = Notification(organization_id=1, recipient_id=uid, notification_type='GENERAL',
            title='Public service notice', message='General information')
        db.add_all([linked, general])
        db.flush()
        linked_id, general_id = linked.id, general.id
        db.commit()
    page = request(workspace, 'GET', '/notifications/paged?search=Protected', uid).json()
    assert page['total'] == int(can_read_change)
    visible = request(workspace, 'GET', '/notifications/paged?search=Public%20service', uid).json()
    assert visible['total'] == 1 and visible['items'][0]['id'] == general_id
    before = rows(workspace.engine, Notification)
    response = request(workspace, 'PATCH', f'/notifications/{linked_id}/read', uid)
    assert response.status_code == (200 if can_read_change else 404)
    after = rows(workspace.engine, Notification)
    if not can_read_change:
        assert after == before
    else:
        assert after[linked_id]['is_read'] and after[linked_id]['message'] == 'Protected message'


def test_missing_or_unclassified_resource_references_fail_closed_but_general_notices_survive(workspace):
    # No content guessing: every current protected event type without its FK is quarantined.
    protected_types = ('CHANGE_SUBMITTED', 'CHANGE_RESUBMITTED', 'CHANGE_APPROVED', 'CHANGE_REJECTED',
        'CHANGE_INFORMATION_REQUESTED', 'CHANGE_IMPLEMENTATION_STARTED', 'CHANGE_IMPLEMENTED',
        'CHANGE_IMPLEMENTATION_FAILED', 'CHANGE_ROLLED_BACK', 'CHANGE_CLOSED',
        'UNKNOWN_LEGACY_EVENT', 'change_submitted', '')
    with Session(workspace.engine) as db:
        hidden = [Notification(organization_id=1, recipient_id=8, notification_type=event,
            title='ORPHAN-SECRET', message='Unverifiable protected history') for event in protected_types]
        # A GENERAL label never overrides an actual protected resource or a foreign actor.
        hidden.extend([
            Notification(organization_id=1, recipient_id=8, change_request_id=200,
                notification_type='GENERAL', title='ORPHAN-SECRET', message='Foreign resource'),
            Notification(organization_id=1, recipient_id=8, actor_id=3,
                notification_type='GENERAL', title='ORPHAN-SECRET', message='Foreign actor')])
        general = Notification(organization_id=1, recipient_id=8, notification_type='GENERAL',
            title='General notice', message='Not linked to a protected resource')
        # A legacy label with an intact FK can be authorized from the resource itself.
        linked = Notification(organization_id=1, recipient_id=8, change_request_id=100,
            notification_type='LEGACY_LABEL', title='Valid reference', message='Authorized historic content')
        db.add_all([*hidden, general, linked])
        db.flush()
        hidden_ids = {row.id for row in hidden}
        visible_ids = {general.id, linked.id}
        db.commit()
    before = rows(workspace.engine, Notification)
    page = request(workspace, 'GET', '/notifications/paged', 8).json()
    assert page['total'] == 2 and {row['id'] for row in page['items']} == visible_ids
    assert request(workspace, 'GET', '/notifications/unread-count', 8).json()['unread_count'] == 2
    assert request(workspace, 'GET', '/notifications/paged?search=ORPHAN-SECRET', 8).json()['total'] == 0
    for notification_id in hidden_ids:
        assert request(workspace, 'PATCH', f'/notifications/{notification_id}/read', 8).status_code == 404
    assert rows(workspace.engine, Notification) == before
    assert request(workspace, 'PATCH', '/notifications/read-all', 8).json()['updated_count'] == 2
    after = rows(workspace.engine, Notification)
    assert all(after[notification_id] == before[notification_id] for notification_id in hidden_ids)


def test_notification_scope_refreshes_with_role_changes_in_an_existing_session(workspace, monkeypatch):
    with Session(workspace.engine) as writer:
        writer.add(Notification(organization_id=1, recipient_id=8, change_request_id=100,
            notification_type='CHANGE_SUBMITTED', title='Session secret', message='Session protected message'))
        writer.commit()
    with Session(workspace.engine) as active_session:
        def test_db():
            yield active_session
        with monkeypatch.context() as patch:
            patch.setitem(app.dependency_overrides, get_db, test_db)
            assert request(workspace, 'GET', '/notifications/paged', 8).json()['total'] == 1
            for role_id, expected in ((3, 0), (4, 1), (11, 0), (5, 1)):
                with Session(workspace.engine) as writer:
                    writer.get(User, 8).role_id = role_id
                    writer.commit()
                page = request(workspace, 'GET', '/notifications/paged', 8)
                assert page.status_code == 200 and page.json()['total'] == expected


def test_notification_listing_query_count_does_not_grow_per_resource(workspace):
    def add_notifications(count):
        with Session(workspace.engine) as db:
            db.add_all([Notification(organization_id=1, recipient_id=8, actor_id=2, change_request_id=100,
                notification_type='CHANGE_SUBMITTED', title='Visible', message='Authorized') for _ in range(count)])
            db.commit()

    def measured_page():
        statements = []
        def record(connection, cursor, statement, parameters, context, executemany):
            if statement.lstrip().upper().startswith('SELECT'):
                statements.append(statement)
        sa.event.listen(workspace.engine, 'before_cursor_execute', record)
        try:
            response = request(workspace, 'GET', '/notifications/paged?page_size=100', 8)
            assert response.status_code == 200
            return response.json(), len(statements)
        finally:
            sa.event.remove(workspace.engine, 'before_cursor_execute', record)

    add_notifications(1)
    small, small_queries = measured_page()
    add_notifications(25)
    large, large_queries = measured_page()
    assert small['total'] == 1 and large['total'] == 26 and len(large['items']) == 26
    assert large_queries == small_queries
