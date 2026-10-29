"""A1 deterministic backfill with in-transaction historical preservation checks."""
from alembic import op
import sqlalchemy as sa

from migrations.tenant_identity_a1 import (
    LEGACY_TABLES, PreservationError, capture_legacy_state, preflight,
    require_postgresql, refuse_downgrade, verify_legacy_state,
)

revision = "a1_02_identity_backfill"
down_revision = "a1_01_identity_expand"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_context().as_sql:
        raise PreservationError("A1 backfill requires an online migration connection.")
    connection = op.get_bind()
    require_postgresql(connection)
    connection.execute(sa.text("LOCK TABLE " + ", ".join(LEGACY_TABLES) + " IN SHARE ROW EXCLUSIVE MODE"))
    preflight(connection)
    snapshot = capture_legacy_state(connection)
    metadata = sa.MetaData()
    organizations = sa.Table("organizations", metadata, autoload_with=connection)
    roles = sa.Table("roles", metadata, autoload_with=connection)
    users = sa.Table("users", metadata, autoload_with=connection)
    # A rerun/partial manual migration must be reviewed, never silently overwritten.
    if connection.scalar(sa.select(sa.func.count()).select_from(roles).where(roles.c.organization_id.is_not(None))):
        raise PreservationError("A1 backfill found preexisting tenant roles; review the migration state.")
    if connection.scalar(sa.select(sa.func.count()).select_from(organizations).where(organizations.c.slug.is_not(None))):
        raise PreservationError("A1 backfill found preexisting slugs; supply a reviewed forward migration.")
    if connection.scalar(sa.select(sa.func.count()).select_from(users).where(sa.or_(
        users.c.membership_source.is_not(None), users.c.membership_confirmed_at.is_not(None), users.c.email_verified_at.is_not(None),
    ))):
        raise PreservationError("A1 backfill found membership metadata; review the migration state.")
    legacy_roles = connection.execute(sa.select(roles).order_by(roles.c.id)).mappings().all()
    for organization_id in connection.scalars(sa.select(organizations.c.id).order_by(organizations.c.id)).all():
        # Stable ID-based identifiers; never infer business ownership from names.
        connection.execute(organizations.update().where(organizations.c.id == organization_id).values(slug=f"org-{organization_id}"))
        for legacy in legacy_roles:
            role_id = connection.scalar(roles.insert().values(
                organization_id=organization_id, legacy_source_role_id=legacy["id"],
                name=legacy["name"], description=legacy["description"],
            ).returning(roles.c.id))
            connection.execute(users.update().where(
                users.c.organization_id == organization_id, users.c.role_id == legacy["id"],
            ).values(role_id=role_id))
    connection.execute(users.update().values(membership_source="legacy"))
    verify_legacy_state(connection, snapshot)


def downgrade():
    refuse_downgrade()
