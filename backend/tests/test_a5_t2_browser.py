"""Real browser -> Vite -> HTTP FastAPI -> owned migrated PostgreSQL only."""
import json
import os
from pathlib import Path
import secrets
import socket
import threading
import time
from datetime import datetime, timezone
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
from test_a3_invitations import invitations, original_password_hash, mailbox, issue, raw_token
from app.main import app
from app.models.foundation import User
from app.services.auth_service import hash_password
from app.settings import settings
from a5_browser_diagnostics import collect_process, initial_record, canonical, PREFIX


def run_browser_flow(workspace, mailbox, tmp_path, script="auth.mjs", a06_mode=None):
    assert script in {"auth.mjs", "presentation.mjs", "a06Recovery.mjs"}
    browser = os.environ.get("CHANGEFLOW_TEST_BROWSER_BIN")
    node = os.environ.get("CHANGEFLOW_TEST_NODE_BIN")
    if not browser or not node:
        pytest.skip("Browser integration requires explicit --browser-bin and --node-bin; no substitute E2E claimed")
    password = secrets.token_urlsafe(24)
    with Session(workspace.engine) as db:
        assert_owned_test_connection(db.connection())
        db.get(User, 2).password_hash = hash_password(password)
        db.get(User, 3).password_hash = hash_password(password)
        db.get(User, 3).role_id = 7
        if script == "presentation.mjs":
            db.get(User, 2).full_name = "سارة العبدالله — فريق الخدمات المؤسسية"
        db.commit()
    issued = issue(workspace, email="browser-invite@example.test")
    assert issued.status_code == 201
    invitation = raw_token(mailbox)
    expired = jwt.encode({"sub": "2", "tid": 1, "ver": 2,
        "exp": datetime.now(timezone.utc).timestamp()-60}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    with socket.socket() as reservation:
        reservation.bind(("127.0.0.1", 0))
        frontend_port = reservation.getsockname()[1]
    origin = "http://127.0.0.1:" + str(frontend_port)

    async def fixture(_request):
        return JSONResponse({"workspace": "tenant-1", "other_workspace": "tenant-2",
            "email": "requester@one.example", "other_email": "admin@two.example",
            "password": password, "invitation": invitation, "expired": expired})

    async def control(request):
        action = (await request.json()).get("action")
        with Session(workspace.engine) as db:
            assert_owned_test_connection(db.connection())
            if action == "limit": db.get(User, 2).role_id = 14
            elif action == "disable": db.get(User, 2).is_active = "inactive"
            else: return JSONResponse({"status": "invalid"}, status_code=400)
            db.commit()
        return JSONResponse({"status": "changed"})

    fixture_app = Starlette(routes=[Route("/_test/fixture", fixture),
        Route("/_test/control", control, methods=["POST"]), Mount("/", app=app)])
    isolated_app = CORSMiddleware(fixture_app, allow_origins=[origin], allow_methods=["*"], allow_headers=["*"])
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    api_origin = "http://127.0.0.1:" + str(listener.getsockname()[1])
    server = uvicorn.Server(uvicorn.Config(isolated_app, lifespan="off", log_level="critical", access_log=False))
    thread = threading.Thread(target=lambda: server.run(sockets=[listener]), daemon=True)
    thread.start()
    diagnostic = initial_record(script.removesuffix(".mjs"))
    try:
        deadline = time.monotonic() + 10
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert server.started, "Owned HTTP fixture failed to start"
        frontend = Path(__file__).resolve().parents[2] / "frontend"
        env = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "COMSPEC", "TEMP", "TMP") if key in os.environ}
        arguments = [node, str(frontend/"e2e"/script), "--api", api_origin,
            "--frontend-port", str(frontend_port), "--browser-bin", browser,
            "--temporary-root", str(tmp_path)]
        if script == "auth.mjs":
            arguments += ["--trace-a06"]
        if a06_mode is not None:
            assert a06_mode in {"control", "race"}
            arguments += ["--a06-mode", a06_mode]
        artifact_root = os.environ.get("CHANGEFLOW_TEST_ARTIFACTS_ROOT")
        if artifact_root:
            artifact_directory = Path(artifact_root) / (script.removesuffix(".mjs") + ("-" + a06_mode if a06_mode else ""))
            artifact_directory.mkdir()
            arguments += ["--artifacts-root", str(artifact_directory)]
        completed = collect_process(arguments, cwd=frontend, env=env, timeout=240, suite=script.removesuffix(".mjs"))
        diagnostic = completed.rows[-1]
        for row in completed.rows:
            if row["event"] in {"failure", "cdp_error", "cleanup", "process_exit", "transition", "resource"} or row["scenario_id"] == "A05":
                print(PREFIX + json.dumps(row))
        if artifact_root:
            # Only canonical finite metadata, never screenshots, bodies or traces.
            (artifact_directory / "diagnostics.json").write_text(json.dumps(completed.rows), encoding="utf-8")
        # The driver emits only three allowlisted metadata fields, never locals.
        lines = [] if completed.metadata is None else ["A5_BROWSER_METADATA=" + json.dumps(completed.metadata)]
        assert lines, "Browser driver produced no safe result"
        report = json.loads(lines[-1].split("=", 1)[1])
        assert set(report) == {"passed", "failed", "phase"}
        print("A5_BROWSER_METADATA=" + json.dumps(report))
        assert completed.returncode == 0, "Browser integration failed; raw output withheld"
    finally:
        try:
            server.should_exit = True
            thread.join(timeout=10)
        finally:
            listener.close()
            resource = canonical({**diagnostic, "event": "resource", "phase": "cleanup",
                "lifecycle_phase": "fastapi-stop", "resource_type": "fastapi", "ownership_status": "owned",
                "completion_state": "timed-out" if thread.is_alive() else "completed"})
            print(PREFIX + json.dumps(resource))
            row = canonical({**diagnostic, "event": "cleanup", "phase": "cleanup", "cleanup_kind": "fastapi",
                             "cleanup_status": "timeout" if thread.is_alive() else "passed"})
            if thread.is_alive():
                row["failure_kind"] = "runner_failure"
                row["timeout_kind"] = "cleanup"
            print(PREFIX + json.dumps(row))
        assert not thread.is_alive(), "Owned HTTP fixture did not stop"


def test_browser_workspace_sessions_and_invitation_flow(workspace, mailbox, tmp_path):
    run_browser_flow(workspace, mailbox, tmp_path)
