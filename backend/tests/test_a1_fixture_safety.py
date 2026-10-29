"""Failure-path tests never contact Docker unless the real PostgreSQL fixture is requested."""
import inspect
import stat
import subprocess
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest
import sqlalchemy as sa

import a1_postgresql as pg
from a1_postgresql import a1_postgres_url, a1_pg_engine, TestDatabaseSafetyError


@pytest.fixture
def fake_fixture_runtime(monkeypatch, tmp_path):
    state = dict(created=False, stop=False, stop_failure=False, removed_on_stop=False,
                 start_failure=False, start_timeout=False, files=[])
    original = pg.tempfile.NamedTemporaryFile

    def private_file(**kwargs):
        result = original(dir=tmp_path, **kwargs)
        state["files"].append(Path(result.name))
        return result

    def docker(*args, **kwargs):
        if args[0] == "run":
            state["token"] = next(value.split("=", 1)[1] for value in args if value.startswith("changeflow.a1.owner="))
            if state["start_failure"]:
                raise RuntimeError("Simulated Docker startup failure")
            state["created"] = True
            if state["start_timeout"]:
                raise subprocess.TimeoutExpired("docker run", 1)
            return "a" * 64
        if args[0] == "port":
            return "127.0.0.1:55432"
        if args[0] == "inspect":
            if not state["created"]:
                raise subprocess.CalledProcessError(1, "docker inspect", stderr="No such object: " + args[-1])
            return "a" * 64 + " " + state["token"]
        if args[0] == "stop":
            state["stop"] = True
            if state["removed_on_stop"]:
                state["created"] = False
                raise subprocess.CalledProcessError(1, "docker stop", stderr="No such container: " + args[-1])
            if state["stop_failure"]:
                raise RuntimeError("Simulated Docker stop failure")
            state["created"] = False
            return "a" * 64
        raise AssertionError("Unexpected Docker operation")

    class Cursor:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def execute(self, statement): assert statement == pg._IDENTITY_SQL
        def fetchone(self): return ("changeflow_a1_test", "a1_test", "public", ["public"], "synthetic-cluster")

    monkeypatch.setenv("CHANGEFLOW_A1_POSTGRES_TESTS", "1")
    monkeypatch.setattr(pg.tempfile, "NamedTemporaryFile", private_file)
    monkeypatch.setattr(pg, "docker", docker)
    monkeypatch.setattr(pg.psycopg2, "connect", lambda **kwargs: SimpleNamespace(cursor=Cursor, close=lambda: None))
    state["start"] = lambda: inspect.unwrap(pg.a1_postgres_url)()
    yield state
    assert all(not path.exists() for path in state["files"]), "A generated test secret was not removed."


def test_password_file_removed_when_docker_stop_fails(fake_fixture_runtime):
    state = fake_fixture_runtime
    generator = state["start"]()
    url = next(generator)
    assert stat.S_IMODE(state["files"][0].stat().st_mode) == 0o600
    state["stop_failure"] = True
    with pytest.raises(RuntimeError, match="stop failure"):
        generator.close()
    assert state["stop"] and not state["files"][0].exists()
    assert url not in pg._SERVERS


@pytest.mark.parametrize("removed_on_stop", [False, True])
def test_already_removed_container_is_safe(fake_fixture_runtime, removed_on_stop):
    state = fake_fixture_runtime
    generator = state["start"]()
    next(generator)
    if removed_on_stop:
        state["removed_on_stop"] = True
    else:
        state["created"] = False
    generator.close()
    assert not state["files"][0].exists()


@pytest.mark.parametrize("failure", ["start_failure", "start_timeout"])
def test_startup_failure_also_cleans_secret_and_owned_container(fake_fixture_runtime, failure):
    state = fake_fixture_runtime
    state[failure] = True
    with pytest.raises((RuntimeError, subprocess.TimeoutExpired)):
        next(state["start"]())
    assert not state["created"]
    assert not state["files"][0].exists()


def test_secret_cleanup_survives_setup_failure(fake_fixture_runtime, monkeypatch):
    def fail_permissions(*args):
        raise PermissionError("Simulated secret setup failure")
    monkeypatch.setattr(pg.os, "chmod", fail_permissions)
    with pytest.raises(PermissionError):
        next(fake_fixture_runtime["start"]())
    assert not fake_fixture_runtime["files"][0].exists()


def test_cleanup_never_stops_a_container_with_wrong_owner(fake_fixture_runtime):
    state = fake_fixture_runtime
    generator = state["start"]()
    next(generator)
    state["token"] = "different-owner"
    with pytest.raises(TestDatabaseSafetyError, match="not owned"):
        generator.close()
    assert not state["stop"] and not state["files"][0].exists()


@pytest.mark.parametrize("operation", [pg.migrate, pg.downgrade])
def test_unregistered_connection_rejected_before_sql(operation):
    engine = sa.create_engine("sqlite:///:memory:")
    executed = []
    try:
        with engine.connect() as connection:
            sa.event.listen(connection, "before_cursor_execute", lambda *args: executed.append(True))
            with pytest.raises(TestDatabaseSafetyError, match="Unregistered"):
                operation(connection)
        assert not executed
    finally:
        engine.dispose()


def test_external_url_and_environment_cannot_start_migration_fixture(monkeypatch):
    # Synthetic external identity only: no network connection is opened.
    foreign = sa.URL.create("postgresql+psycopg2", host="external.invalid", database="production")
    monkeypatch.setenv("DATABASE_URL", foreign.render_as_string())
    def forbidden(*args, **kwargs):
        raise AssertionError("External engine creation must never be attempted")
    monkeypatch.setattr(pg.sa, "create_engine", forbidden)
    with pytest.raises(TestDatabaseSafetyError, match="External PostgreSQL URLs"):
        next(inspect.unwrap(pg.a1_pg_engine)(foreign))


def test_same_url_different_engine_is_not_owned(a1_pg_engine):
    other = sa.create_engine(a1_pg_engine.url)
    try:
        with other.begin() as connection:
            with pytest.raises(TestDatabaseSafetyError, match="Unregistered"):
                pg.migrate(connection)
    finally:
        other.dispose()


@pytest.mark.parametrize("component", [0, 1, 2])
def test_actual_database_identity_is_checked(a1_pg_engine, monkeypatch, component):
    owner = pg._OWNED_ENGINES[a1_pg_engine]
    changed = list(owner.identity)
    changed[component] = "unapproved-identity"
    changed = tuple(changed)
    monkeypatch.setattr(owner.server, "identity", changed)
    monkeypatch.setitem(pg._OWNED_ENGINES, a1_pg_engine, replace(owner, identity=changed))
    with a1_pg_engine.begin() as connection:
        with pytest.raises(TestDatabaseSafetyError, match="database identity"):
            pg.migrate(connection)


@pytest.mark.parametrize("extra_public", [False, True])
def test_schema_search_path_redirection_is_rejected(a1_pg_engine, extra_public):
    owner = pg._OWNED_ENGINES[a1_pg_engine]
    with a1_pg_engine.begin() as connection:
        path = f'"{owner.schema}", public' if extra_public else "public"
        connection.exec_driver_sql("SET LOCAL search_path TO " + path)
        with pytest.raises(TestDatabaseSafetyError, match="search path"):
            pg.migrate(connection)


def test_schema_translation_is_rejected(a1_pg_engine):
    with a1_pg_engine.begin() as connection:
        connection = connection.execution_options(schema_translate_map={None: "public"})
        with pytest.raises(TestDatabaseSafetyError, match="Schema redirection"):
            pg.migrate(connection)
