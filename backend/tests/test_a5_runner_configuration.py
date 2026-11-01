"""Runner configuration must be portable and must not inherit app secrets."""
import os
from pathlib import Path

import pytest

import a5_isolated_runner as runner


def fake_binaries(tmp_path):
    directory = tmp_path / "postgres-bin"
    directory.mkdir()
    suffix = ".exe" if os.name == "nt" else ""
    for name in ("initdb", "pg_ctl", "postgres"):
        (directory / (name + suffix)).touch()
    return directory


def test_explicit_binary_directory_is_resolved_without_developer_paths(tmp_path):
    resolve = getattr(runner, "resolve_postgres_bin", None)
    assert callable(resolve), "Portable binary resolution is missing"
    directory = fake_binaries(tmp_path)
    assert resolve(str(directory)) == directory.resolve()


def test_missing_binaries_fail_without_attempting_database_connection(tmp_path, monkeypatch):
    resolve = getattr(runner, "resolve_postgres_bin", None)
    assert callable(resolve), "Portable binary resolution is missing"
    monkeypatch.setattr(runner.shutil, "which", lambda _name: None)
    with pytest.raises(RuntimeError, match="postgres-bin"):
        resolve(None)
    with pytest.raises(RuntimeError, match="PostgreSQL"):
        resolve(str(tmp_path))


def test_path_discovery_requires_all_tools_from_the_same_directory(tmp_path, monkeypatch):
    resolve = getattr(runner, "resolve_postgres_bin", None)
    assert callable(resolve), "Portable binary resolution is missing"
    directory = fake_binaries(tmp_path)
    suffix = ".exe" if os.name == "nt" else ""
    monkeypatch.setattr(runner.shutil, "which", lambda name: str(directory / (name + suffix)))
    assert resolve(None) == directory.resolve()
    monkeypatch.setattr(runner.shutil, "which", lambda name: str(
        (tmp_path if name == "pg_ctl" else directory) / (name + suffix)))
    with pytest.raises(RuntimeError, match="same directory"):
        resolve(None)


def test_child_environment_discards_inherited_settings_and_generates_fresh_keys(tmp_path, monkeypatch):
    build = getattr(runner, "build_child_environment", None)
    assert callable(build), "Explicit child environment builder is missing"
    directory = fake_binaries(tmp_path)
    for name in ("DATABASE_URL", "JWT_SECRET_KEY", "PGPASSWORD", "PGSERVICE", "NODE_OPTIONS", "GEMINI_API_KEY"):
        monkeypatch.setenv(name, "synthetic inherited marker")
    first = build(tmp_path, directory)
    second = build(tmp_path, directory)
    assert first["DATABASE_URL"] == "sqlite:///:memory:"
    assert first["JWT_SECRET_KEY"] == ""
    assert first["CHANGEFLOW_ISOLATED_JWT_KEY"] != second["CHANGEFLOW_ISOLATED_JWT_KEY"]
    assert first["CHANGEFLOW_ISOLATED_JWT_KEY"] != os.environ["JWT_SECRET_KEY"]
    assert all(name not in first for name in ("PGPASSWORD", "PGSERVICE", "NODE_OPTIONS", "GEMINI_API_KEY"))
    assert Path(first["CHANGEFLOW_TEST_POSTGRES_BIN"]) == directory
