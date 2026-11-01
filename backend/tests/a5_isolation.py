"""Process-local test guard. Never reads application environment files."""
import os
from pathlib import Path
import sys

ACTIVE = False
_root = None
_servers = []
_attempts = []


def register_native_cluster(data, port, password):
    if not ACTIVE:
        return
    data = Path(data).resolve()
    if not data.is_relative_to(_root) or data.name != "data":
        raise RuntimeError("Unowned test cluster rejected")
    identity = (data / "postmaster.pid").read_text().splitlines()
    if Path(identity[1]).resolve() != data or int(identity[3]) != port:
        raise RuntimeError("Test cluster identity mismatch")
    _servers.append((data, port, password))


def unregister_native_cluster(data):
    _servers[:] = [entry for entry in _servers if entry[0] != Path(data).resolve()]


def install(root):
    global ACTIVE, _root
    if ACTIVE:
        raise RuntimeError("Guard already installed")
    _root = Path(root).resolve(strict=True)
    if not _root.name.startswith("changeflow-a5-run-"):
        raise RuntimeError("Unknown test run root")
    ACTIVE = True
    # Disable discovery as well as loading, before app.settings can import it.
    import dotenv
    import dotenv.main
    dotenv.load_dotenv = dotenv.main.load_dotenv = lambda *a, **k: False
    dotenv.find_dotenv = dotenv.main.find_dotenv = lambda *a, **k: ""

    def audit(event, args):
        if event == "open" and isinstance(args[0], (str, bytes, os.PathLike)):
            path = Path(os.fsdecode(args[0]))
            if path.name == ".env" or path.name.startswith(".env."):
                _attempts.append("environment_file")
                raise PermissionError("Environment files are forbidden in isolated tests")
    sys.addaudithook(audit)

    import sqlite3
    import sqlite3.dbapi2
    original_sqlite = sqlite3.connect

    def memory_only(database, *args, **kwargs):
        if database != ":memory:":
            _attempts.append("unowned_sqlite")
            raise PermissionError("Only in-memory SQLite is allowed")
        return original_sqlite(database, *args, **kwargs)
    sqlite3.connect = sqlite3.dbapi2.connect = memory_only

    import psycopg2
    from psycopg2.extensions import parse_dsn
    original_pg = psycopg2.connect

    def owned_pg(dsn=None, *args, **kwargs):
        params = parse_dsn(dsn) if dsn else {}
        params.update(kwargs)
        allowed = any(
            (data / "postmaster.pid").is_file()
            and params.get("host") == "127.0.0.1"
            and int(params.get("port", 0)) == port
            and params.get("user") == "a1_test"
            and params.get("password") == password
            and params.get("dbname", params.get("database")) in {"postgres", "changeflow_a1_test"}
            and not any(key in params for key in ("service", "servicefile", "hostaddr", "passfile"))
            for data, port, password in _servers
        )
        if not allowed:
            _attempts.append("unowned_postgresql")
            raise PermissionError("PostgreSQL target is not owned by this test run")
        return original_pg(dsn, *args, **kwargs)
    psycopg2.connect = owned_pg

    import sqlalchemy as sa

    @sa.event.listens_for(sa.engine.Engine, "do_connect")
    def approved_driver(dialect, _record, _args, _kwargs):
        if dialect.name not in {"sqlite", "postgresql"} or (
            dialect.name == "postgresql" and dialect.driver != "psycopg2"
        ):
            _attempts.append("unapproved_driver")
            raise PermissionError("Unapproved test database driver")


def rejected_attempts():
    return tuple(_attempts)
