"""Frozen A1 data checks. Do not change after releasing these revisions.

Works with the migration connection only; never opens an application database.
Errors contain categories/counts, never email addresses or credential material.
"""

import hashlib
import json
from dataclasses import dataclass

import sqlalchemy as sa


INITIAL_REVISION = "54c5a5c8470d"
LEGACY_TABLES = (
    "organizations", "roles", "departments", "users", "it_services", "it_systems",
    "system_dependencies", "incidents", "risk_rules", "managed_change_requests",
    "managed_change_affected_systems", "managed_impact_assessments",
    "change_status_history", "audit_logs", "change_approvals",
    "change_implementations", "notifications", "user_administration_audit_logs",
)
ADDED_COLUMNS = {
    "organizations": {"slug"},
    "roles": {"organization_id", "legacy_source_role_id"},
    "users": {"membership_source", "membership_confirmed_at", "email_verified_at"},
}


class PreservationError(RuntimeError):
    pass


def require_postgresql(connection):
    if connection.dialect.name != "postgresql":
        raise PreservationError("A1 migrations require PostgreSQL; SQLite is not an equivalent migration target.")


def refuse_downgrade():
    raise PreservationError(
        "A1 downgrade is intentionally blocked: it could delete access history or invalidate "
        "tenant accounts. Use a reviewed forward repair; no records were deleted."
    )


def tables(connection):
    metadata = sa.MetaData()
    metadata.reflect(bind=connection, only=LEGACY_TABLES)
    return metadata.tables


def preflight(connection):
    """Read-only checks against the initial or expanded schema."""
    t = tables(connection)
    problems = {}

    def check(code, statement):
        count = connection.scalar(statement)
        if count:
            problems[code] = count

    u = t["users"]
    normalized = sa.func.lower(sa.func.btrim(u.c.email))
    duplicates = sa.select(u.c.organization_id, normalized).group_by(
        u.c.organization_id, normalized,
    ).having(sa.func.count() > 1).subquery()
    check("duplicate_tenant_email_ci", sa.select(sa.func.count()).select_from(duplicates))
    check("blank_user_email", sa.select(sa.func.count()).select_from(u).where(sa.func.length(sa.func.trim(u.c.email)) == 0))

    # Also detects missing references when importing a representative legacy fixture.
    for name in ("users", "departments", "it_services", "it_systems", "managed_change_requests", "notifications"):
        child, parent = t[name], t["organizations"]
        check(f"{name}_organization", sa.select(sa.func.count()).select_from(
            child.outerjoin(parent, child.c.organization_id == parent.c.id)
        ).where(parent.c.id.is_(None)))

    check("users_role_missing", sa.select(sa.func.count()).select_from(
        u.outerjoin(t["roles"], u.c.role_id == t["roles"].c.id)
    ).where(t["roles"].c.id.is_(None)))

    def reference(code, child_name, field, parent_name):
        child, parent = t[child_name], t[parent_name]
        check(code, sa.select(sa.func.count()).select_from(
            child.outerjoin(parent, child.c[field] == parent.c.id)
        ).where(child.c[field].is_not(None), sa.or_(
            parent.c.id.is_(None), child.c.organization_id != parent.c.organization_id,
        )))

    for child, field, parent in (
        ("users", "department_id", "departments"),
        ("it_services", "department_id", "departments"),
        ("it_systems", "department_id", "departments"),
        ("it_systems", "service_id", "it_services"),
        ("it_systems", "owner_id", "users"),
        ("managed_change_requests", "requester_id", "users"),
        ("notifications", "recipient_id", "users"),
        ("notifications", "actor_id", "users"),
        ("notifications", "change_request_id", "managed_change_requests"),
    ):
        reference(f"{child}_{field}_tenant", child, field, parent)

    d, source, target = t["system_dependencies"], t["it_systems"].alias("src"), t["it_systems"].alias("dst")
    check("dependency_tenant", sa.select(sa.func.count()).select_from(
        d.outerjoin(source, d.c.source_system_id == source.c.id).outerjoin(target, d.c.target_system_id == target.c.id)
    ).where(sa.or_(source.c.id.is_(None), target.c.id.is_(None), source.c.organization_id != target.c.organization_id)))

    for name, field, other_name in (
        ("managed_change_affected_systems", "system_id", "it_systems"),
        ("change_approvals", "approver_id", "users"),
        ("change_status_history", "changed_by", "users"),
        ("audit_logs", "actor_id", "users"),
        ("change_implementations", "coordinator_id", "users"),
    ):
        child, change, other = t[name], t["managed_change_requests"], t[other_name]
        # Unattached historical audit events are retained without inventing a tenant.
        check(f"{name}_{field}_tenant", sa.select(sa.func.count()).select_from(
            child.join(change, child.c.change_request_id == change.c.id).outerjoin(other, child.c[field] == other.c.id)
        ).where(child.c[field].is_not(None), sa.or_(
            other.c.id.is_(None), change.c.organization_id != other.c.organization_id,
        )))
    a, actor, target = t["user_administration_audit_logs"], u.alias("actor"), u.alias("target")
    check("user_administration_audit_tenant", sa.select(sa.func.count()).select_from(
        a.outerjoin(actor, a.c.actor_id == actor.c.id).outerjoin(target, a.c.target_user_id == target.c.id)
    ).where(sa.or_(actor.c.id.is_(None), target.c.id.is_(None), actor.c.organization_id != target.c.organization_id)))
    if problems:
        raise PreservationError("A1 preflight failed (category: count): " + json.dumps(problems, sort_keys=True))


def fingerprint(values):
    encoded = json.dumps(values, sort_keys=True, default=lambda value: value.isoformat(), ensure_ascii=False)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


@dataclass
class LegacySnapshot:
    columns: dict
    rows: dict
    user_roles: dict


def capture_legacy_state(connection):
    t = tables(connection)
    columns, rows = {}, {}
    for name in LEGACY_TABLES:
        columns[name] = [c.name for c in t[name].columns if c.name not in ADDED_COLUMNS.get(name, set())
                         and not (name == "users" and c.name == "role_id")]
        rows[name] = {row["id"]: fingerprint(dict(row)) for row in connection.execute(
            sa.select(*(t[name].c[c] for c in columns[name]))
        ).mappings()}
    user_roles = dict(connection.execute(sa.select(t["users"].c.id, t["users"].c.role_id)).all())
    return LegacySnapshot(columns, rows, user_roles)


def verify_legacy_state(connection, snapshot):
    t = tables(connection)
    for name in LEGACY_TABLES:
        actual = {row["id"]: fingerprint(dict(row)) for row in connection.execute(
            sa.select(*(t[name].c[c] for c in snapshot.columns[name]))
        ).mappings()}
        expected = snapshot.rows[name]
        if name == "roles":  # Only newly appended tenant copies are allowed.
            valid = all(actual.get(key) == value for key, value in expected.items())
        else:
            valid = actual == expected
        if not valid:
            raise PreservationError(f"A1 preservation check failed for {name}; transaction must roll back.")
    # Prove that every added role is an exact tenant copy, not merely a row
    # pointing at a legacy source with a different permission-bearing name.
    copied_pairs = set()
    for row in connection.execute(sa.select(t["roles"])).mappings():
        if row["id"] in snapshot.rows["roles"]:
            if row["organization_id"] is not None or row["legacy_source_role_id"] is not None:
                raise PreservationError("A1 changed ownership of a preserved legacy role.")
            continue
        source_id = row["legacy_source_role_id"]
        original_shape = {column: row[column] for column in snapshot.columns["roles"]}
        original_shape["id"] = source_id
        if fingerprint(original_shape) != snapshot.rows["roles"].get(source_id):
            raise PreservationError("A1 tenant role copy differs from its legacy definition.")
        copied_pairs.add((row["organization_id"], source_id))
    expected_pairs = {(org, role) for org in snapshot.rows["organizations"] for role in snapshot.rows["roles"]}
    if copied_pairs != expected_pairs:
        raise PreservationError("A1 tenant role copies are incomplete or have an invalid organization.")
    users, roles = t["users"], t["roles"]
    assignments = connection.execute(sa.select(
        users.c.id, users.c.organization_id, roles.c.organization_id.label("role_org"), roles.c.legacy_source_role_id,
    ).select_from(users.join(roles, users.c.role_id == roles.c.id))).mappings()
    for row in assignments:
        if row["organization_id"] != row["role_org"] or row["legacy_source_role_id"] != snapshot.user_roles[row["id"]]:
            raise PreservationError("A1 role mapping preservation failed; transaction must roll back.")
