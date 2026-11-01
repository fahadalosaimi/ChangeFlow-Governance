"""Real browser -> Vite -> HTTP FastAPI -> owned migrated PostgreSQL only."""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
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


def test_browser_workspace_sessions_and_invitation_flow(workspace, mailbox, tmp_path):
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
    try:
        deadline = time.monotonic() + 10
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert server.started, "Owned HTTP fixture failed to start"
        frontend = Path(__file__).resolve().parents[2] / "frontend"
        env = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "COMSPEC", "TEMP", "TMP") if key in os.environ}
        completed = subprocess.run([node, str(frontend/"e2e/auth.mjs"), "--api", api_origin,
            "--frontend-port", str(frontend_port), "--browser-bin", browser,
            "--temporary-root", str(tmp_path)], cwd=frontend, env=env, capture_output=True, text=True, timeout=180)
        # The driver emits only three allowlisted metadata fields, never locals.
        lines = [line for line in completed.stdout.splitlines() if line.startswith("A5_BROWSER_METADATA=")]
        assert lines, "Browser driver produced no safe result"
        report = json.loads(lines[-1].split("=", 1)[1])
        assert set(report) == {"passed", "failed", "phase"}
        print("A5_BROWSER_METADATA=" + json.dumps(report))
        assert completed.returncode == 0, "Browser integration failed; raw output withheld"
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        listener.close()
        assert not thread.is_alive(), "Owned HTTP fixture did not stop"
