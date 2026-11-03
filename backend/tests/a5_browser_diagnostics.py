"""Strict metadata-only boundary; captured raw child output is never returned."""
from dataclasses import dataclass
import json
from pathlib import Path
import subprocess

PREFIX = "A5_BROWSER_DIAGNOSTIC="
SCHEMA = json.loads((Path(__file__).resolve().parents[2] / "frontend/e2e/diagnostic-schema.json").read_text(encoding="utf-8"))
FIELDS, DEFAULTS = SCHEMA["fields"], SCHEMA["defaults"]
NUMBERS = ("exit_code", "browser_exit_code", "startup_elapsed_ms")


def canonical(value):
    if not isinstance(value, dict):
        return None
    value = {**DEFAULTS, **value}
    if set(value) != set(FIELDS) | set(NUMBERS):
        return None
    if any(not isinstance(value[key], str) or value[key] not in allowed for key, allowed in FIELDS.items()):
        return None
    for key in NUMBERS:
        code = value[key]
        lower, upper = (0, 300000) if key == "startup_elapsed_ms" else (-2147483648, 4294967295)
        if code is not None and (type(code) is not int or not lower <= code <= upper):
            return None
    return {key: value[key] for key in (*FIELDS, *NUMBERS)}


def initial_record(suite):
    return canonical(dict(**DEFAULTS, suite=suite if suite in FIELDS["suite"] else "unknown", scenario_id="none", substep_id="none",
                phase="process", event="phase", failure_kind="none", category="none", timeout_kind="none",
                cleanup_kind="none", cleanup_status="none", exit_code=None))


def canonical_summary(value):
    if (isinstance(value, dict) and set(value) == {"passed", "failed", "phase"}
            and all(type(value[k]) is int and 0 <= value[k] <= 1000 for k in ("passed", "failed"))
            and value["phase"] in FIELDS["phase"] + FIELDS["scenario_id"]):
        return value
    return None


@dataclass
class ProcessResult:
    returncode: int | None
    rows: list
    metadata: dict | None
    timed_out: bool


def collect_process(arguments, *, cwd, env, timeout, suite):
    timed_out = False
    try:
        completed = subprocess.run(arguments, cwd=cwd, env=env, capture_output=True, text=True, timeout=timeout)
        output, code = completed.stdout, completed.returncode
    except subprocess.TimeoutExpired as error:
        output = error.stdout or ""
        if isinstance(output, bytes):
            output = output.decode("utf-8", errors="replace")
        code, timed_out = None, True
    except OSError:
        output, code = "", None
    rows, metadata = [], None
    for line in output.splitlines():
        prefix = PREFIX if line.startswith(PREFIX) else "A5_BROWSER_METADATA=" if line.startswith("A5_BROWSER_METADATA=") else None
        if not prefix:
            continue
        try:
            value = json.loads(line[len(prefix):])
        except (ValueError, TypeError):
            continue
        if prefix == PREFIX:
            row = canonical(value)
            if row:
                rows.append(row)
        else:
            metadata = canonical_summary(value)
    last = rows[-1] if rows else initial_record(suite)
    final = {**last, "event": "process_exit", "phase": "exit", "exit_code": code}
    if timed_out:
        final.update(timeout_kind="process", failure_kind="runner_failure", cleanup_status="unconfirmed")
    elif code != 0 and final["failure_kind"] == "none":
        final.update(failure_kind="runner_failure", category="process_exit")
    elif metadata is None:
        final.update(failure_kind="runner_failure", category="unknown")
    rows.append(final)
    return ProcessResult(code, rows, metadata, timed_out)
