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


def test_metadata_filter_does_not_echo_traceback_copies_of_browser_output():
    sanitize = getattr(runner, "safe_output", None)
    assert callable(sanitize), "Safe metadata output filter is missing"
    metadata = 'A5_BROWSER_METADATA={"passed":0,"failed":1,"phase":"workspace-login"}'
    output = metadata + '\nE + CompletedProcess(stdout=' + metadata + ', stderr="synthetic private marker")\n1 failed in 1.00s'
    result = sanitize(output)
    assert metadata in result
    assert all("synthetic private marker" not in line and "CompletedProcess" not in line for line in result)


def test_visual_artifacts_stay_outside_checkout_and_preserve_existing_files(tmp_path, monkeypatch):
    prepare = getattr(runner, "prepare_artifacts_root", None)
    assert callable(prepare), "Owned artifact directory validation is missing"
    checkout = tmp_path / "checkout"
    backend = checkout / "backend"
    backend.mkdir(parents=True)
    monkeypatch.setattr(runner, "BACKEND", backend)
    with pytest.raises(RuntimeError, match="outside"):
        prepare(checkout)
    screenshots = tmp_path / "screenshots"
    screenshots.mkdir()
    sentinel = screenshots / "existing.txt"
    sentinel.write_text("synthetic metadata", encoding="utf-8")
    created = prepare(screenshots)
    assert created.parent == screenshots.resolve()
    assert created.name.startswith("changeflow-a5-t3-visual-")
    assert sentinel.read_text(encoding="utf-8") == "synthetic metadata"
