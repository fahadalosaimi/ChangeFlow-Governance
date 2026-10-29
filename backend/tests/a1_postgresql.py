"""Opt-in disposable PostgreSQL fixture. No external database URL is accepted."""
import os
import secrets
import subprocess
import tempfile
import time
import uuid
import weakref
from dataclasses import dataclass, field

import psycopg2
import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from pathlib import Path


BACKEND = Path(__file__).resolve().parents[1]


class TestDatabaseSafetyError(RuntimeError):
    __test__ = False


@dataclass
class _Server:
    url: sa.URL = field(repr=False)
    identity: tuple
    active: bool = True
    schemas: set = field(default_factory=set)


@dataclass(frozen=True)
class _EngineOwnership:
    server: _Server
    schema: str
    identity: tuple


_SERVERS = {}
_OWNED_ENGINES = weakref.WeakKeyDictionary()
_IDENTITY_SQL = (
    "SELECT current_database(), current_user, current_schema(), current_schemas(false), "
    "(SELECT system_identifier::text FROM pg_control_system())"
)


def _assert_server_identity(connection, server):
    if not server.active or _SERVERS.get(server.url) is not server or connection.engine.url != server.url:
        raise TestDatabaseSafetyError("Connection is not owned by an active A1 PostgreSQL fixture.")
    row = connection.exec_driver_sql(_IDENTITY_SQL).one()
    if (row[0], row[1], row[4]) != server.identity:
        raise TestDatabaseSafetyError("A1 PostgreSQL database identity does not match its fixture.")
    return row


def assert_owned_test_connection(connection):
    """Reject unknown engines before executing even an identity query on them."""
    if not isinstance(connection, sa.engine.Connection) or connection.closed:
        raise TestDatabaseSafetyError("A live fixture-owned SQLAlchemy Connection is required.")
    owner = _OWNED_ENGINES.get(connection.engine)
    if owner is None or connection.dialect.name != "postgresql":
        raise TestDatabaseSafetyError("Unregistered connection: external databases are forbidden in A1 tests.")
    if connection.get_execution_options().get("schema_translate_map"):
        raise TestDatabaseSafetyError("Schema redirection is forbidden in A1 migration tests.")
    if owner.schema not in owner.server.schemas or owner.identity != owner.server.identity:
        raise TestDatabaseSafetyError("A1 schema ownership or recorded database identity is invalid.")
    row = _assert_server_identity(connection, owner.server)
    if row[2] != owner.schema or list(row[3]) != [owner.schema]:
        raise TestDatabaseSafetyError("A1 migration connection has an unapproved schema search path.")


def _missing_container(error, reference):
    message = (error.stderr or "").lower()
    return any(f"{phrase}: {reference.lower()}" in message for phrase in ("no such container", "no such object"))


def _cleanup_container(reference, ownership_token):
    """Inspect only the resource created/named by this run; never stop another one."""
    try:
        result = docker("inspect", "--format", '{{.Id}} {{index .Config.Labels "changeflow.a1.owner"}}', reference)
    except subprocess.CalledProcessError as error:
        if _missing_container(error, reference):
            return
        raise
    container_id, token = result.split()
    if token != ownership_token:
        raise TestDatabaseSafetyError("Refusing to clean up a container not owned by this fixture.")
    try:
        docker("stop", "--time", "5", container_id)
    except subprocess.CalledProcessError as error:
        if not _missing_container(error, container_id):
            raise


def docker(*args, **kwargs):
    env = os.environ.copy()
    for key in ("DOCKER_HOST", "DOCKER_CONTEXT", "DOCKER_TLS", "DOCKER_TLS_VERIFY", "DOCKER_CERT_PATH"):
        env.pop(key, None)
    return subprocess.run(
        ["docker", "--host=unix:///var/run/docker.sock", *args],
        env=env, check=True, capture_output=True, text=True, timeout=60, **kwargs,
    ).stdout.strip()


@pytest.fixture(scope="session")
def a1_postgres_url():
    if os.environ.get("CHANGEFLOW_A1_POSTGRES_TESTS") != "1":
        pytest.skip("PostgreSQL tests not run; opt in with CHANGEFLOW_A1_POSTGRES_TESTS=1 (local Docker required).")
    name = "changeflow-a1-test-" + uuid.uuid4().hex
    ownership_token = uuid.uuid4().hex
    password = secrets.token_urlsafe(32)
    # A private temporary file supplies only this container's generated password.
    # The container receives no project mount, application env file, or real credentials.
    secret_file = tempfile.NamedTemporaryFile(prefix="changeflow-a1-secret-", delete=False)
    container = None
    url = None
    server = None
    try:
        with secret_file:
            os.chmod(secret_file.name, 0o600)
            secret_file.write(password.encode())
        container = docker(
            "run", "--detach", "--rm", "--name", name,
            "--label", "changeflow.purpose=a1-disposable-test",
            "--label", "changeflow.a1.owner=" + ownership_token,
            "--publish", "127.0.0.1::5432",
            "--tmpfs", "/a1-pgdata:rw,size=512m",
            "--mount", f"type=bind,src={secret_file.name},dst=/run/secrets/a1-password,readonly",
            "--env", "PGDATA=/a1-pgdata", "--env", "POSTGRES_USER=a1_test",
            "--env", "POSTGRES_DB=changeflow_a1_test",
            "--env", "POSTGRES_PASSWORD_FILE=/run/secrets/a1-password", "postgres:16-alpine",
        )
        port = int(docker("port", container, "5432/tcp").rsplit(":", 1)[1])
        url = sa.URL.create("postgresql+psycopg2", username="a1_test", password=password,
                            host="127.0.0.1", port=port, database="changeflow_a1_test")
        deadline = time.monotonic() + 40
        while True:
            try:
                connection = psycopg2.connect(host="127.0.0.1", port=port, user="a1_test", password=password,
                                              dbname="changeflow_a1_test", connect_timeout=1)
                try:
                    with connection.cursor() as cursor:
                        cursor.execute(_IDENTITY_SQL)
                        identity = cursor.fetchone()
                    if identity[0:2] != ("changeflow_a1_test", "a1_test"):
                        raise TestDatabaseSafetyError("Unexpected database identity in newly created fixture.")
                    server = _Server(url, (identity[0], identity[1], identity[4]))
                    _SERVERS[url] = server
                finally:
                    connection.close()
                break
            except psycopg2.OperationalError:
                if time.monotonic() >= deadline:
                    pytest.fail("Disposable PostgreSQL failed to become ready; no external database was contacted.")
                time.sleep(0.2)
        yield url
    finally:
        if server is not None:
            server.active = False
            _SERVERS.pop(url, None)
        try:
            # The unique name also allows cleanup if docker run timed out after creation.
            _cleanup_container(container or name, ownership_token)
        finally:
            # Docker failure must never prevent removal of the generated secret.
            try:
                secret_file.close()
            finally:
                Path(secret_file.name).unlink(missing_ok=True)


@pytest.fixture
def a1_pg_engine(a1_postgres_url):
    server = _SERVERS.get(a1_postgres_url)
    if server is None or not server.active:
        raise TestDatabaseSafetyError("External PostgreSQL URLs are forbidden; start the approved fixture.")
    schema = "a1_test_" + uuid.uuid4().hex
    admin = sa.create_engine(a1_postgres_url)
    engine = None
    created = False
    try:
        with admin.begin() as connection:
            _assert_server_identity(connection, server)
            connection.execute(sa.text(f'CREATE SCHEMA "{schema}"'))
        created = True
        server.schemas.add(schema)
        engine = sa.create_engine(a1_postgres_url, connect_args={"options": f"-csearch_path={schema} -ctimezone=UTC"})
        _OWNED_ENGINES[engine] = _EngineOwnership(server, schema, server.identity)
        yield engine
    finally:
        try:
            if engine is not None:
                _OWNED_ENGINES.pop(engine, None)
                engine.dispose()
        finally:
            try:
                if created:
                    with admin.begin() as connection:
                        _assert_server_identity(connection, server)
                        connection.execute(sa.text(f'DROP SCHEMA "{schema}" CASCADE'))
            finally:
                server.schemas.discard(schema)
                admin.dispose()


def migrate(connection, revision="head"):
    assert_owned_test_connection(connection)
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "migrations"))
    config.attributes["connection"] = connection
    command.upgrade(config, revision)


def downgrade(connection):
    assert_owned_test_connection(connection)
    config = Config(str(BACKEND / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND / "migrations"))
    config.attributes["connection"] = connection
    command.downgrade(config, "54c5a5c8470d")
