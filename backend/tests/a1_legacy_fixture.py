"""Synthetic initial-schema records covering every historical table."""
from datetime import datetime

import sqlalchemy as sa

from migrations.tenant_identity_a1 import LEGACY_TABLES


def seed_legacy(connection):
    metadata = sa.MetaData()
    metadata.reflect(bind=connection, only=LEGACY_TABLES)
    t = metadata.tables
    now = datetime(2026, 8, 1, 10, 0)

    def insert(table_name, **values):
        for field in ("created_at", "updated_at", "changed_at", "decided_at", "occurred_at"):
            if field in t[table_name].c:
                values.setdefault(field, now)
        connection.execute(t[table_name].insert().values(**values))

    for org in (1, 2):
        insert("organizations", id=org, name=f"Synthetic Tenant {org}", industry="Test")
        insert("departments", id=org, organization_id=org, name="Operations")
    for role_id, name in enumerate(("System Administrator", "Requester", "System Owner", "CMDB Manager"), 1):
        insert("roles", id=role_id, name=name, description="Preserve this role definition")
    for uid, org, role, email, active, password in (
        (10, 1, 1, "admin.one@example.test", "active", "synthetic-hash-admin-unchanged"),
        (11, 1, 2, "Person@example.test", "active", "synthetic-hash-requester-unchanged"),
        (12, 1, 3, "directory@example.test", "inactive", None),
        (13, 1, 4, "cmdb@example.test", "active", "synthetic-hash-cmdb-unchanged"),
        (20, 2, 1, "person@example.test", "active", "synthetic-hash-other-tenant-unchanged"),
    ):
        insert("users", id=uid, organization_id=org, department_id=org, role_id=role,
               full_name=f"Synthetic User {uid}", email=email, is_active=active, password_hash=password)
    for org in (1, 2):
        insert("it_services", id=org, organization_id=org, department_id=org,
               name="Core Service", business_criticality="High")
    for sid, org, owner in ((101, 1, 12), (102, 1, 11), (201, 2, 20)):
        insert("it_systems", id=sid, organization_id=org, department_id=org, service_id=org,
               owner_id=owner, name=f"Synthetic System {sid}", criticality="High", status="Active", environment="Production")
    insert("system_dependencies", id=1, source_system_id=101, target_system_id=102,
           dependency_type="Application", impact_level="High")
    insert("incidents", id=1, system_id=101, title="Preserve incident", severity="High", status="Resolved")
    insert("risk_rules", id=1, name="Unchanged global rule for Batch B", condition_type="change_type",
           condition_value="application", score=15, is_active="active")
    for cid, org, requester, status in ((1001, 1, 11, "Closed"), (2001, 2, 20, "Rejected")):
        insert("managed_change_requests", id=cid, organization_id=org, requester_id=requester,
               title=f"Preserve change {cid}", description="Historical description remains byte-for-byte unchanged",
               change_type="application", change_mode="Normal", priority="High", status=status,
               expected_downtime_minutes=15, rollback_complexity="Medium", security_sensitivity="High")
    for aid, cid, sid in ((1, 1001, 101), (2, 2001, 201)):
        insert("managed_change_affected_systems", id=aid, change_request_id=cid, system_id=sid, impact_role="Direct")
    for aid, score, risk in ((1, 90, "Critical"), (2, 65, "High")):
        insert("managed_impact_assessments", id=aid, change_request_id=1001, impact_score=score,
               risk_level=risk, decision_recommendation="Historical recommendation",
               directly_affected_systems='["Synthetic System 101"]', risk_factors='["Historical factor"]',
               ai_explanation="Historical explanation must not be recalculated")
    insert("change_approvals", id=1, change_request_id=1001, approver_id=10,
           approval_level="CAB Review", decision="Approved", comments="Preserve approval")
    insert("change_status_history", id=1, change_request_id=1001, old_status="Implemented", new_status="Closed", changed_by=10)
    insert("audit_logs", id=1, change_request_id=1001, actor_id=10, action="CLOSE_CHANGE",
           entity_type="ChangeImplementation", entity_id=1, details="Preserve audit")
    insert("change_implementations", id=1, change_request_id=1001, coordinator_id=10,
           implementation_status="Closed", rollback_performed=False, pir_result="Successful", pir_summary="Preserve PIR")
    insert("notifications", id=1, organization_id=1, recipient_id=11, actor_id=10, change_request_id=1001,
           notification_type="CHANGE_CLOSED", title="Preserve notification", message="Preserve message", is_read=False)
    insert("user_administration_audit_logs", id=1, actor_id=10, target_user_id=11,
           action="ROLE_CHANGED", old_role="Requester", new_role="Requester", details="Preserve access audit")
    # Fixture IDs are explicit. Synchronize only these disposable test sequences.
    for name in LEGACY_TABLES:
        connection.execute(sa.text(
            f"SELECT setval(pg_get_serial_sequence('{name}', 'id'), COALESCE((SELECT max(id) FROM {name}), 1), true)"
        ))
