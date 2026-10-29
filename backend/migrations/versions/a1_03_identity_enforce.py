"""A1 validate and enforce. Requires coordinated future auth cutover, not A1 deployment."""
from alembic import op
import sqlalchemy as sa

from migrations.tenant_identity_a1 import PreservationError, preflight, require_postgresql, refuse_downgrade

revision = "a1_03_identity_enforce"
down_revision = "a1_02_identity_backfill"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_context().as_sql:
        raise PreservationError("A1 enforce requires online validation.")
    connection = op.get_bind()
    require_postgresql(connection)
    connection.execute(sa.text("LOCK TABLE organizations, roles, departments, users, it_services, it_systems IN SHARE ROW EXCLUSIVE MODE"))
    preflight(connection)
    invalid = connection.scalar(sa.text(
        "SELECT count(*) FROM users u LEFT JOIN roles r ON r.id = u.role_id "
        "WHERE r.organization_id IS DISTINCT FROM u.organization_id OR u.membership_source IS NULL"
    ))
    if invalid:
        raise PreservationError("A1 enforce found invalid tenant-role mappings or incomplete membership backfill.")
    op.alter_column("organizations", "slug", nullable=False)
    op.create_unique_constraint("uq_organizations_slug", "organizations", ["slug"])
    op.create_check_constraint("ck_organizations_slug", "organizations", "length(slug) BETWEEN 3 AND 100 AND slug = lower(slug) AND slug = trim(slug)")
    # Build the authoritative expression index before releasing global uniqueness.
    op.create_index("uq_users_org_email_ci", "users", ["organization_id", sa.text("lower(btrim(email))")], unique=True)
    op.drop_constraint("uq_users_email", "users", type_="unique")
    op.alter_column("users", "membership_source", nullable=False, server_default="invitation")
    op.create_check_constraint("ck_users_membership_source", "users", "membership_source IN ('legacy', 'invitation', 'bootstrap')")
    op.create_check_constraint("ck_users_membership_activation", "users",
        "membership_source = 'legacy' OR is_active = 'inactive' OR "
        "(membership_confirmed_at IS NOT NULL AND email_verified_at IS NOT NULL "
        "AND password_hash IS NOT NULL AND length(password_hash) > 0)")
    for table, field, parent, suffix in (
        ("users", "role_id", "roles", "role"),
        ("users", "department_id", "departments", "department"),
        ("it_services", "department_id", "departments", "department"),
        ("it_systems", "department_id", "departments", "department"),
        ("it_systems", "service_id", "it_services", "service"),
        ("it_systems", "owner_id", "users", "owner"),
    ):
        op.create_foreign_key(f"fk_{table}_tenant_{suffix}", table, parent,
                              ["organization_id", field], ["organization_id", "id"])


def downgrade():
    refuse_downgrade()
