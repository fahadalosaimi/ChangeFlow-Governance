"""Controlled real 403 before manual confirmation; no production database."""
import pytest
from test_a5_t2_browser import (
    a1_postgres_url, a1_pg_engine, workspace, mailbox, invitations,
    original_password_hash, run_browser_flow,
)


@pytest.mark.parametrize("mode", ["control", "race"])
def test_dialog_verification_survives_automatic_403_recovery(workspace, mailbox, tmp_path, mode):
    run_browser_flow(workspace, mailbox, tmp_path, "a06Recovery.mjs", a06_mode=mode)
