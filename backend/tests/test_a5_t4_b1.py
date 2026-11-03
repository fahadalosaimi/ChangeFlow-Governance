"""T4-B1 contracts: original endpoints on owned PostgreSQL, never migrations."""
import pytest
from sqlalchemy.orm import Session
from alembic import command
from test_a5_playwright_pilot import a1_postgres_url, a1_pg_engine, invitations, workspace, original_password_hash
from app.models.foundation import User
from a4_workspace import request

@pytest.fixture(autouse=True)
def no_migrations(monkeypatch):
    def reject(*_args, **_kwargs): pytest.fail('Migrations forbidden in B1 integration')
    monkeypatch.setattr(command, 'upgrade', reject)
    monkeypatch.setattr(command, 'downgrade', reject)

def test_systems_read_contracts_are_available_without_foundation_write(workspace):
    me = request(workspace, 'GET', '/auth/me').json()
    assert 'foundation.read' in me['permissions'] and 'foundation.write' not in me['permissions']
    rows = request(workspace, 'GET', '/foundation/systems')
    assert rows.status_code == 200 and {r['id'] for r in rows.json()} == {1001,1002}
    system = request(workspace, 'GET', '/foundation/systems/1001').json()
    assert set(system) == {'id','organization_id','department_id','service_id','owner_id','name','description','system_type','environment','criticality','status'}
    assert system['organization_id'] == 1 and system['system_type'] is None
    dependencies = request(workspace, 'GET', '/foundation/systems/1001/dependencies').json()
    assert [(d['source_system_id'],d['target_system_id']) for d in dependencies] == [(1001,1002)]
    incidents = request(workspace, 'GET', '/foundation/systems/1001/incidents').json()
    assert incidents[0]['system_id'] == 1001 and incidents[0]['resolved_at'] is None
    profile = request(workspace, 'GET', '/foundation/systems/1001/impact-profile').json()
    assert profile['system_id'] == 1001 and profile['owner_name']
    assert isinstance(profile['outgoing_dependencies'],list) and len(profile['outgoing_dependencies']) == 1
    assert 'FOREIGN' not in str(profile)

@pytest.mark.parametrize('suffix', ['', '/dependencies', '/incidents', '/impact-profile'])
def test_foreign_system_and_missing_have_identical_404_contract(workspace, suffix):
    foreign = request(workspace, 'GET', '/foundation/systems/2001'+suffix)
    missing = request(workspace, 'GET', '/foundation/systems/999999'+suffix)
    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()

def test_unknown_role_cannot_read_any_systems_endpoint_with_existing_jwt(workspace):
    with Session(workspace.engine) as db:
        db.get(User,2).role_id = 10
        db.commit()
    for suffix in ['', '/1001', '/1001/dependencies', '/1001/incidents', '/1001/impact-profile']:
        assert request(workspace,'GET','/foundation/systems'+suffix).status_code == 403
