"""Run pytest in a fresh process with explicit synthetic settings and DB guards."""
import json
import argparse
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
import tempfile

BACKEND = Path(__file__).resolve().parents[1]


def resolve_postgres_bin(value):
    """Accept tool binaries only, never a database URL or an existing cluster."""
    suffix = ".exe" if os.name == "nt" else ""
    names = ("initdb", "pg_ctl", "postgres")
    if value is None:
        discovered = [shutil.which(name) for name in names]
        if not all(discovered):
            raise RuntimeError("Provide --postgres-bin or put PostgreSQL tools on PATH")
        parents = {Path(item).resolve().parent for item in discovered}
        if len(parents) != 1:
            raise RuntimeError("PostgreSQL tools must be in the same directory")
        value = parents.pop()
    try:
        directory = Path(value).resolve(strict=True)
    except OSError:
        raise RuntimeError("PostgreSQL tool directory is unavailable") from None
    if not directory.is_dir() or not all((directory / (name + suffix)).is_file() for name in names):
        raise RuntimeError("PostgreSQL tool directory is incomplete")
    return directory


def build_child_environment(directory, postgres_bin):
    env = {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "COMSPEC", "PATH", "PATHEXT")
           if key in os.environ}
    env.update(TEMP=str(directory), TMP=str(directory), CHANGEFLOW_TEST_RUN_ROOT=str(directory),
               PYTHONDONTWRITEBYTECODE="1", PYTEST_DISABLE_PLUGIN_AUTOLOAD="1",
               PYTHONPATH=str(BACKEND), PYTHON_DOTENV_DISABLED="1",
               CHANGEFLOW_ISOLATED_JWT_KEY=secrets.token_urlsafe(64),
               JWT_SECRET_KEY="", DATABASE_URL="sqlite:///:memory:",
               ENVIRONMENT="test", CREATE_TABLES_ON_STARTUP="false", SQL_ECHO="false",
               CHANGEFLOW_A1_POSTGRES_TESTS="1", CHANGEFLOW_A3_WINDOWS_TRUST_TESTS="0",
               CHANGEFLOW_TEST_POSTGRES_BIN=str(postgres_bin))
    return env


def child():
    import a5_isolation
    a5_isolation.install(os.environ["CHANGEFLOW_TEST_RUN_ROOT"])
    import pytest
    import re

    class Evidence:
        def __init__(self):
            self.groups = {}
            self.outcomes = {}

        def pytest_collection_modifyitems(self, items):
            for item in items:
                params = getattr(getattr(item, "callspec", None), "params", {})
                self.groups[item.nodeid] = (
                    "postgresql" if "a1_pg_engine" in item.fixturenames
                    or any(isinstance(value, str) and value == "postgresql" for value in params.values())
                    else "unit_or_memory")

        def totals(self):
            result = {group: {outcome: 0 for outcome in ("passed", "failed", "skipped")}
                      for group in ("postgresql", "unit_or_memory")}
            for node, outcome in self.outcomes.items():
                result[self.groups[node]][outcome] += 1
            return result

        def pytest_runtest_logreport(self, report):
            if report.failed:
                self.outcomes[report.nodeid] = "failed"
            elif report.skipped and self.outcomes.get(report.nodeid) != "failed":
                self.outcomes[report.nodeid] = "skipped"
            elif report.when == "call" and report.passed and self.outcomes.get(report.nodeid) != "failed":
                self.outcomes[report.nodeid] = "passed"
            Path(os.environ["CHANGEFLOW_TEST_RUN_ROOT"], "progress.json").write_text(
                json.dumps(self.totals()), encoding="utf-8")
            if report.failed and hasattr(report.longrepr, "reprcrash"):
                crash = report.longrepr.reprcrash
                kind = re.match(r"(?:[\w.]+(?:Error|Exception)|assert \d+ == \d+)", crash.message)
                print("A5_FAILURE_METADATA=" + json.dumps({"test": report.nodeid,
                      "path": crash.path, "line": crash.lineno,
                      "kind": kind.group(0) if kind else "assertion (details withheld)"}))

        def pytest_sessionfinish(self):
            print("A5_COUNTS_METADATA=" + json.dumps(self.totals()))

    raise SystemExit(pytest.main(sys.argv[2:], plugins=[Evidence()]))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--child":
        child()
        return
    # Never inherit application credentials, provider keys, PG*, or PYTHONPATH.
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--postgres-bin")
    options, pytest_arguments = parser.parse_known_args()
    postgres_bin = resolve_postgres_bin(options.postgres_bin)
    with tempfile.TemporaryDirectory(prefix="changeflow-a5-run-") as directory:
        env = build_child_environment(directory, postgres_bin)
        print(json.dumps({"event": "isolated_run_started", "run_directory": directory}), flush=True)
        result = subprocess.run([sys.executable, "-B", __file__, "--child", "-q", "-ra",
                                 "--tb=short", "-p", "no:cacheprovider", *pytest_arguments],
                                env=env, cwd=BACKEND, capture_output=True, text=True)
        # Only summaries and test names reach the terminal, never assertion locals.
        lines = (result.stdout + result.stderr).splitlines()
        safe = [line for line in lines if (
            line.startswith(("FAILED tests/", "ERROR tests/", "SKIPPED ["))
            or "A5_FAILURE_METADATA=" in line
            or "A5_COUNTS_METADATA=" in line
            or (" in " in line and any(word in line for word in (" passed", " failed", " error", " skipped")))
        )]
        print(json.dumps({"exit_code": result.returncode, "summary": safe,
                          "raw_output_withheld": True}))
        raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
