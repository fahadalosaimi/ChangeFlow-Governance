"""Metadata is validated before it can reach pytest or runner output."""
import json
import os
import sys


from a5_browser_diagnostics import canonical, collect_process, initial_record, PREFIX


def environment():
    return {key: os.environ[key] for key in ("SYSTEMROOT", "WINDIR", "PATH", "PATHEXT", "COMSPEC") if key in os.environ}


def test_metadata_rejects_unknown_fields_and_sensitive_values():
    row = initial_record("auth")
    assert canonical(row) == row
    for key in ("scenario_id", "substep_id", "category", "phase", "error_name", "document_state",
                "context_state", "target_state", "browser_state", "dom_state", "transition_id",
                "lifecycle_phase", "resource_type", "ownership_status", "completion_state"):
        assert canonical({**row, key: "synthetic-sensitive-marker"}) is None
    assert canonical({**row, "url": "https://example.test/#synthetic-sensitive-marker"}) is None
    assert canonical({**row, "exit_code": True}) is None
    assert canonical({**row, "browser_exit_code": True}) is None


def test_historical_rows_are_normalized_with_unknown_lifecycle_not_invented_evidence():
    row = initial_record("auth")
    historical = {k: v for k, v in row.items() if k not in {
        "error_name", "document_state", "context_state", "target_state", "browser_state", "browser_exit_code", "dom_state", "transition_id",
        "lifecycle_phase", "resource_type", "ownership_status", "completion_state"}}
    assert canonical(historical) == row


def test_real_process_nonzero_exit_is_a_runner_failure_and_raw_output_is_not_returned():
    row = initial_record("auth")
    script = "import sys; print('synthetic-sensitive-marker'); print(" + repr(PREFIX + json.dumps(row)) + "); sys.exit(7)"
    result = collect_process([sys.executable, "-c", script], cwd=None, env=environment(), timeout=10, suite="auth")
    assert result.returncode == 7
    assert result.rows[-1]["event"] == "process_exit"
    assert result.rows[-1]["exit_code"] == 7
    assert result.rows[-1]["failure_kind"] == "runner_failure"
    assert "synthetic-sensitive-marker" not in repr(result)
    assert not hasattr(result, "stdout") and not hasattr(result, "stderr")


def test_real_process_timeout_is_reported_without_exception_output():
    result = collect_process([sys.executable, "-c", "import threading; threading.Event().wait()"],
                             cwd=None, env=environment(), timeout=0.1, suite="auth")
    assert result.timed_out
    assert result.rows[-1]["timeout_kind"] == "process"
    assert result.rows[-1]["failure_kind"] == "runner_failure"


def test_claimed_exit_success_does_not_override_actual_process_failure():
    fake = {**initial_record("auth"), "event": "process_exit", "exit_code": 0}
    script = "import sys; print(" + repr(PREFIX + json.dumps(fake)) + "); sys.exit(9)"
    result = collect_process([sys.executable, "-c", script], cwd=None, env=environment(), timeout=10, suite="auth")
    assert result.rows[-1]["exit_code"] == 9
    assert result.rows[-1]["failure_kind"] == "runner_failure"


def test_runner_forwards_valid_checkpoints_but_rejects_injected_values():
    from a5_isolated_runner import safe_output
    row = initial_record("auth")
    assert safe_output(PREFIX + json.dumps(row)) == [PREFIX + json.dumps(row, separators=(",", ":"))]
    assert safe_output(PREFIX + json.dumps({**row, "category": "synthetic-sensitive-marker"})) == []


def test_legacy_summary_cannot_smuggle_sensitive_phase_into_runner_output():
    from a5_isolated_runner import safe_output
    bad = {"passed": 1, "failed": 0, "phase": "https://example.test/#synthetic-sensitive-marker"}
    assert safe_output("A5_BROWSER_METADATA=" + json.dumps(bad)) == []


def test_windows_unsigned_exit_code_is_retained_as_metadata():
    assert canonical({**initial_record("auth"), "exit_code": 3221225477}) is not None


def test_successful_process_without_scenario_summary_is_a_runner_failure():
    result = collect_process([sys.executable, "-c", "pass"], cwd=None, env=environment(), timeout=10, suite="auth")
    assert result.returncode == 0
    assert result.metadata is None
    assert result.rows[-1]["failure_kind"] == "runner_failure"
