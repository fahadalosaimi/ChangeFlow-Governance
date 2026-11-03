"""Opt-in pilot: owned PostgreSQL/HTTP, ORM-created schema, no Alembic or .env.

Breaks caught: stale tenant data, stale grants after 403, premature recovery DOM,
lost sessions, shared browser state, motion regressions and unclean process exits.
The CDP controls reuse the same synthetic seed without running migrations.
"""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import threading
import time
from types import SimpleNamespace
from jose import jwt

import pytest
from sqlalchemy.orm import Session
from starlette.applications import Starlette
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from starlette.routing import Route, Mount
import uvicorn

from a1_postgresql import a1_postgres_url, a1_pg_engine, assert_owned_test_connection
from a4_workspace import workspace
from app.database import Base, get_db
from app.main import app
from app.models.foundation import Organization, Role, Department, User
from app.services.auth_service import hash_password, create_access_token
from app.settings import settings
from test_a2_authentication import Client
from test_a3_invitations import mailbox
from test_a5_t2_browser import run_browser_flow


@pytest.fixture(scope="module")
def original_password_hash():
    return hash_password(secrets.token_urlsafe(24))


@pytest.fixture
def invitations(a1_pg_engine, original_password_hash):
    # Reuse registered ownership guards, but deliberately DO NOT call migrate().
    with a1_pg_engine.begin() as connection:
        assert_owned_test_connection(connection)
        Base.metadata.create_all(connection)
    with Session(a1_pg_engine) as db:
        db.add_all([Organization(id=i, name=f"Pilot Tenant {i}", slug=f"tenant-{i}") for i in (1, 2, 3)])
        db.flush()
        db.add_all([Role(id=1, name="System Administrator"), *[
            Role(id=i, organization_id=org, name=name) for i, org, name in (
                (2,1,"System Administrator"), (3,1,"Requester"), (4,1,"CMDB Manager"),
                (5,1,"Change Manager"), (6,2,"System Administrator"), (7,2,"Requester"),
                (8,3,"System Administrator"), (9,3,"Requester"), (10,1,"Unknown Legacy Role"))],
            Department(id=1, organization_id=1, name="One"),
            Department(id=2, organization_id=2, name="Two")])
        db.flush()
        for uid, org, role, email in ((1,1,2,"admin@one.example"),
                (2,1,3,"requester@one.example"), (3,2,6,"admin@two.example"),
                (6,1,2,"inactive@one.example")):
            db.add(User(id=uid, organization_id=org, role_id=role, full_name=f"Pilot User {uid}",
                email=email, password_hash=original_password_hash, membership_source="legacy",
                is_active="inactive" if uid == 6 else "active"))
        db.commit()
        tokens = {uid: create_access_token(db.get(User, uid)) for uid in (1,2,3,6)}

    def owned_db():
        with Session(a1_pg_engine) as db:
            assert_owned_test_connection(db.connection())
            yield db
    app.dependency_overrides[get_db] = owned_db
    try:
        yield SimpleNamespace(engine=a1_pg_engine, client=Client(), tokens=tokens)
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def pilot_http(workspace):
    password = secrets.token_urlsafe(24)
    with Session(workspace.engine) as db:
        assert_owned_test_connection(db.connection())
        for uid in (2,3):
            db.get(User, uid).password_hash = hash_password(password)
        db.get(User, 3).role_id = 7
        db.commit()

    async def fixture(_request):
        return JSONResponse(dict(workspace="tenant-1", other_workspace="tenant-2",
            email="requester@one.example", other_email="admin@two.example", password=password,
            expired=jwt.encode({"sub": "2", "tid": 1, "ver": 2, "exp": int(time.time()) - 60},
                settings.jwt_secret_key, algorithm=settings.jwt_algorithm)))

    async def control(request):
        action = (await request.json()).get("action")
        if action not in {"limit", "restore", "disable", "enable"}:
            return JSONResponse({"status": "invalid"}, status_code=400)
        with Session(workspace.engine) as db:
            assert_owned_test_connection(db.connection())
            if action in {"limit", "restore"}:
                db.get(User, 2).role_id = 14 if action == "limit" else 3
            else:
                db.get(User, 2).is_active = "inactive" if action == "disable" else "active"
            db.commit()
        return JSONResponse({"status": "changed"})

    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    api = "http://127.0.0.1:" + str(listener.getsockname()[1])
    fixture_app = Starlette(routes=[Route("/_test/fixture", fixture),
        Route("/_test/control", control, methods=["POST"]), Mount("/", app=app)])
    isolated = CORSMiddleware(fixture_app, allow_origin_regex=r"http://127\.0\.0\.1:[0-9]+",
        allow_methods=["*"], allow_headers=["*"])
    # Event readiness is explicit; no browser fixed sleeps or startup polling.
    ready = threading.Event()

    class Server(uvicorn.Server):
        async def startup(self, sockets=None):
            await super().startup(sockets=sockets)
            if self.started:
                ready.set()

    server = Server(uvicorn.Config(isolated, lifespan="off", log_level="critical", access_log=False))
    thread = threading.Thread(target=lambda: server.run(sockets=[listener]), daemon=True)
    thread.start()
    try:
        assert ready.wait(10), "Owned HTTP fixture did not become ready"
        yield api
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        listener.close()
        assert not thread.is_alive(), "Owned HTTP cleanup failed"


@pytest.mark.parametrize("selection", ["security", "presentation", "forward", "reverse", "session-boundaries"])
def test_playwright_pilot(pilot_http, tmp_path, selection):
    run_playwright_gate(pilot_http, tmp_path, selection)


def run_playwright_gate(pilot_http, tmp_path, selection, *, expect_success=True):
    node = os.environ.get("CHANGEFLOW_TEST_NODE_BIN")
    assert node, "Explicit --node-bin is required; pilot cannot silently skip"
    pilot = Path(__file__).resolve().parents[2] / "frontend" / "e2e" / "playwright"
    env = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "COMSPEC") if key in os.environ}
    env.update(TEMP=str(tmp_path), TMP=str(tmp_path), PILOT_API=pilot_http,
        PILOT_ROOT=str(tmp_path), PILOT_SELECTION=selection,
        PLAYWRIGHT_BROWSERS_PATH=str(pilot / ".browsers"), NODE_ENV="test")
    result = subprocess.run([node, str(pilot / "run.mjs")], cwd=pilot, env=env,
        capture_output=True, text=True, timeout=150)
    # Never forward assertion errors, response bodies, call logs or credentials.
    rows = []
    for line in result.stdout.splitlines():
        if line.startswith("PILOT="):
            row = json.loads(line[6:])
            assert set(row) <= {"case", "status", "duration_ms", "failure_line", "passed", "failed", "exit", "contexts", "browser_exit", "cleanup"}
            rows.append(row)
    for row in rows:
        print("A5_FAILURE_METADATA=" + json.dumps({"pilot": selection, **row}))
    print("A5_BROWSER_METADATA=" + json.dumps({"passed": sum(r.get("status") == "passed" for r in rows),
        "failed": sum(r.get("status") != "passed" for r in rows if "case" in r), "phase": "exit"}))
    # All assertion locals stay in captured process memory, including on failure.
    assert result.returncode == (0 if expect_success else 1), "Unexpected Playwright exit (raw output withheld)"
    assert any(r.get("cleanup") == "passed" and r.get("exit") == result.returncode for r in rows), "Unconfirmed runner cleanup"
    if expect_success:
        assert any(r.get("browser_exit") == 0 for r in rows), "Unconfirmed Chromium exit"
        assert all(r.get("status") == "passed" for r in rows if "case" in r), "Gate cannot exclude a failed/skipped case"
        assert len([r for r in rows if r.get("status") == "passed"]) == {"security": 7, "presentation": 4, "forward": 11, "reverse": 11, "session-boundaries": 1}[selection]
    assert not any(p.suffix in {".zip", ".png", ".webm", ".har"} for p in tmp_path.rglob("*")), "Sensitive artifact capture forbidden"


def test_playwright_runner_rejects_empty_gate(pilot_http, tmp_path):
    run_playwright_gate(pilot_http, tmp_path, "unknown", expect_success=False)


def test_cdp_auth_control(workspace, mailbox, tmp_path):
    run_browser_flow(workspace, mailbox, tmp_path, "auth.mjs")


def test_cdp_presentation_control(workspace, mailbox, tmp_path):
    run_browser_flow(workspace, mailbox, tmp_path, "presentation.mjs")
