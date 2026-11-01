"""A5-T3 uses the same owned real HTTP/PostgreSQL browser fixture as T2."""
from test_a5_t2_browser import (
    a1_postgres_url, a1_pg_engine, workspace, mailbox, invitations,
    original_password_hash, run_browser_flow,
)


def test_browser_routing_localization_and_responsive_shell(workspace, mailbox, tmp_path):
    run_browser_flow(workspace, mailbox, tmp_path, "presentation.mjs")
