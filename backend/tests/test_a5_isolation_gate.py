"""Gate evidence: reject unowned targets before any driver connection."""
from pathlib import Path
import os

import pytest
import psycopg2
import sqlite3
import sqlalchemy as sa

import a5_isolation
from a1_postgresql import a1_postgres_url, a1_pg_engine, assert_owned_test_connection


def test_gate_guard_is_installed_before_application_settings():
    assert a5_isolation.ACTIVE, "Use a5_isolated_runner.py for the isolation gate"
    from app.settings import settings
    assert settings.environment == "test"
    assert settings.database_url == "sqlite:///:memory:"
    assert settings.jwt_secret_key == os.environ["CHANGEFLOW_ISOLATED_JWT_KEY"]
    assert not settings.create_tables_on_startup


def test_unapproved_targets_and_environment_reads_fail_without_connection():
    assert a5_isolation.ACTIVE
    with pytest.raises(PermissionError):
        # A nonexistent path is intentional: the guard rejects before file I/O.
        Path(os.environ["CHANGEFLOW_TEST_RUN_ROOT"], ".env").read_bytes()
    with pytest.raises(PermissionError):
        psycopg2.connect(host="192.0.2.1", dbname="unowned", connect_timeout=1)
    with pytest.raises(PermissionError):
        sqlite3.connect("unowned.db")
    assert a5_isolation.rejected_attempts() == (
        "environment_file", "unowned_postgresql", "unowned_sqlite")


def test_fresh_postgresql_cluster_is_owned_and_migratable(a1_pg_engine):
    assert a5_isolation.ACTIVE
    with a1_pg_engine.begin() as connection:
        assert_owned_test_connection(connection)
        connection.exec_driver_sql("CREATE TABLE gate_probe (id integer PRIMARY KEY)")
        connection.exec_driver_sql("INSERT INTO gate_probe VALUES (1)")
        assert connection.scalar(sa.text("SELECT count(*) FROM gate_probe")) == 1
