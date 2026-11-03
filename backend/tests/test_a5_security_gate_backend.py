"""Existing security regressions on Pilot's owned ORM schema; no Alembic.

Reuse the original test bodies and parametrization, not copies of assertions.
Only the known synthetic seed/fixture is substituted to honor no-migrations.
"""
import pytest
from alembic import command

from test_a5_playwright_pilot import (
    a1_postgres_url, a1_pg_engine, invitations, workspace, original_password_hash,
)
from test_a5_identity import (
    test_me_exposes_current_matrix_without_expanding_privileges,
    test_same_jwt_reflects_role_workspace_and_activity_changes,
    test_client_permission_claims_and_tenant_headers_cannot_grant_access,
    test_foreign_tenant_jwt_and_unknown_role_are_denied,
)
from test_a4_authorization import (
    test_tenant_context_has_immutable_permissions_from_current_db_role,
    test_signed_jwt_permissions_and_client_tenant_cannot_grant_admin_access,
    test_permissions_change_with_database_role_and_disable_in_active_session,
)
from test_a4_isolation import (
    test_dependency_lists_counts_and_impact_profile_scope_both_endpoints,
    test_changes_with_foreign_nested_resources_are_not_read_or_counted,
    test_administration_audit_cannot_expose_foreign_actor_name_or_search_matches,
    test_notification_counts_search_and_updates_reject_foreign_relations,
    test_foreign_and_missing_ids_have_identical_responses,
    test_requester_lists_search_counts_and_headers_cannot_access_another_requester,
    test_dashboard_aggregations_separate_tenants_and_requesters_with_distinct_stored_scores,
)
from test_a4_notifications import (
    test_linked_notifications_follow_all_current_role_grants,
    test_notification_scope_refreshes_with_role_changes_in_an_existing_session,
)


@pytest.fixture(autouse=True)
def forbid_alembic(monkeypatch):
    def rejected(*_args, **_kwargs):
        pytest.fail("Database migrations are forbidden in this gate")
    monkeypatch.setattr(command, "upgrade", rejected)
    monkeypatch.setattr(command, "downgrade", rejected)
