"""Retired setup commands must stop before loading application dependencies."""
import ast
import importlib.abc
import json
import os
from pathlib import Path
import subprocess
import sys
from dataclasses import replace
from unittest.mock import Mock

import pytest


BACKEND = Path(__file__).resolve().parents[1]
LEGACY_TOOLS = ("setup_auth_users.py", "seed_foundation.py")


def assert_safe_to_invoke(path):
    """Do not execute an old or accidentally re-enabled setup implementation."""
    statements = ast.parse(path.read_bytes()).body
    if (statements and isinstance(statements[0], ast.Expr)
            and isinstance(statements[0].value, ast.Constant)
            and isinstance(statements[0].value.value, str)):
        statements = statements[1:]
    assert statements, "Legacy tool needs an unconditional safety stop."
    stop = statements[0]
    assert isinstance(stop, ast.Raise), "Refusing to execute legacy code before its safety stop."
    assert isinstance(stop.exc, ast.Call), "Legacy tool must exit before loading dependencies."
    assert isinstance(stop.exc.func, ast.Name) and stop.exc.func.id == "SystemExit"
    assert not stop.exc.keywords and len(stop.exc.args) == 1
    assert isinstance(stop.exc.args[0], ast.Constant) and isinstance(stop.exc.args[0].value, str)
    assert stop.exc.args[0].value.startswith("Legacy "), "Exit needs a safe, static explanation."


@pytest.mark.parametrize("tool", LEGACY_TOOLS)
def test_legacy_entrypoint_stops_before_loading_any_dependency(tool):
    # Reinstating an import or a setup call before the stop is a security regression.
    assert_safe_to_invoke(BACKEND / tool)


@pytest.mark.parametrize("tool", LEGACY_TOOLS)
def test_operational_setup_contains_no_literal_password_arguments(tool):
    tree = ast.parse((BACKEND / tool).read_bytes())
    count = sum(
        1 for node in ast.walk(tree) if isinstance(node, ast.Call)
        for argument in node.keywords
        if argument.arg in {"password", "password_hash"}
        and isinstance(argument.value, ast.Constant)
        and isinstance(argument.value.value, str)
    )
    # Only a count can appear in a failure; never collect the literal values.
    assert count == 0, "Operational setup must not contain hardcoded account credentials."


def isolated_environment(environment):
    # Inherit no application URL, password, token, PYTHONPATH, or secret store.
    values = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC")
              if key in os.environ}
    values.update(ENVIRONMENT=environment, DATABASE_URL="not-a-database-url",
                  JWT_SECRET_KEY="", CREATE_TABLES_ON_STARTUP="true",
                  ALLOW_LEGACY_SETUP="1", CI="true")
    return values


GUARDED_INVOCATION = r'''
import builtins
import importlib.util
import json
import os
from pathlib import Path
import runpy
import sys

path, mode = sys.argv[1:]
attempts = []
original_import = builtins.__import__
forbidden = {"app", "sqlalchemy", "psycopg2", "sqlite3", "dotenv", "bcrypt"}

def guard_import(name, *args, **kwargs):
    if name.split(".")[0] in forbidden:
        attempts.append("application_or_database_dependency")
        raise AssertionError("Application and database dependencies are forbidden.")
    return original_import(name, *args, **kwargs)

def audit(event, args):
    if event in {"socket.connect", "socket.bind", "socket.getaddrinfo", "sqlite3.connect",
                 "subprocess.Popen", "os.system", "os.mkdir", "os.remove", "os.rmdir",
                 "os.rename", "os.chmod", "os.chown"}:
        attempts.append("connection_or_process")
        raise AssertionError("External side effects are forbidden.")
    if event == "open":
        filename, access, flags = args
        name = str(filename).lower()
        if name.endswith((".env", ".db", ".sqlite", ".sqlite3")):
            attempts.append("configuration_or_database_file")
            raise AssertionError("Real configuration and database files are forbidden.")
        if isinstance(access, str) and any(letter in access for letter in "wax+"):
            attempts.append("file_write")
            raise AssertionError("File writes are forbidden.")
        if flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND):
            attempts.append("file_write")
            raise AssertionError("File writes are forbidden.")

builtins.__import__ = guard_import
sys.addaudithook(audit)
exit_code = None
try:
    if mode == "script":
        runpy.run_path(path, run_name="__main__")
    else:
        spec = importlib.util.spec_from_file_location(Path(path).stem, path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
except SystemExit as error:
    exit_code = error.code
except BaseException:
    # Do not emit exceptions, source text, locals, argv, or credential values.
    print(json.dumps({"unexpected_failure": True, "attempts": attempts}))
    raise SystemExit(2)
print(json.dumps({"exit_code": exit_code, "attempts": attempts}))
'''


@pytest.mark.parametrize("tool", LEGACY_TOOLS)
@pytest.mark.parametrize("environment", ("development", "test", "production"))
@pytest.mark.parametrize("mode", ("script", "import"))
def test_script_and_import_fail_without_database_hashing_or_mutation(tool, environment, mode):
    path = BACKEND / tool
    assert_safe_to_invoke(path)
    result = subprocess.run(
        [sys.executable, "-I", "-B", "-c", GUARDED_INVOCATION, str(path), mode],
        env=isolated_environment(environment), cwd=BACKEND, capture_output=True, timeout=15,
    )
    assert result.returncode == 0, "Safety harness detected unexpected behavior; output suppressed."
    outcome = json.loads(result.stdout)
    assert outcome["attempts"] == [], "Setup attempted a dependency, connection, or write."
    assert isinstance(outcome["exit_code"], str) and "disabled" in outcome["exit_code"].lower()
    assert result.stderr == b""


@pytest.mark.parametrize("tool", LEGACY_TOOLS)
@pytest.mark.parametrize("environment", ("development", "test", "production"))
def test_direct_cli_exits_nonzero_without_traceback_or_argument_echo(tool, environment):
    path = BACKEND / tool
    assert_safe_to_invoke(path)
    result = subprocess.run(
        [sys.executable, "-I", "-B", str(path), "--enable", "synthetic-argument-not-a-credential"],
        env=isolated_environment(environment), cwd=BACKEND, capture_output=True, timeout=15,
    )
    assert result.returncode == 1
    assert result.stdout == b""
    assert b"disabled" in result.stderr.lower()
    assert b"Traceback" not in result.stderr
    assert b"synthetic-argument" not in result.stderr
    assert len(result.stderr.splitlines()) == 1


@pytest.mark.parametrize("create_tables", (False, True))
def test_fastapi_lifespan_does_not_load_legacy_setup(monkeypatch, create_tables):
    from app import main

    attempts = []

    class RejectLegacyImport(importlib.abc.MetaPathFinder):
        def find_spec(self, fullname, path=None, target=None):
            if fullname.rsplit(".", 1)[-1] in {"setup_auth_users", "seed_foundation"}:
                attempts.append(fullname)
                raise AssertionError("FastAPI startup must not load retired setup modules.")

    monkeypatch.setattr(sys, "meta_path", [RejectLegacyImport(), *sys.meta_path])
    for name in ("setup_auth_users", "seed_foundation"):
        monkeypatch.delitem(sys.modules, name, raising=False)
    connect = Mock(side_effect=AssertionError("Database connections are forbidden in this test."))
    monkeypatch.setattr(main.engine, "connect", connect)
    monkeypatch.setattr(main.engine, "raw_connection", connect)
    create_all = Mock()
    monkeypatch.setattr(main.Base.metadata, "create_all", create_all)
    monkeypatch.setattr(main, "settings", replace(main.settings, create_tables_on_startup=create_tables))

    async def startup():
        async with main.lifespan(main.app):
            assert main.health_check()["status"] == "ok"
            assert main.root()["version"] == main.settings.app_version

    # The current lifespan has no event-loop work. Drive it directly so this
    # isolated test does not create a Windows event loop or its loopback sockets.
    invocation = startup()
    try:
        with pytest.raises(StopIteration):
            invocation.send(None)
    finally:
        invocation.close()
    assert attempts == []
    connect.assert_not_called()
    assert create_all.call_count == int(create_tables)
