"""Append-oriented access events; no claim of storage-level immutability."""

from sqlalchemy import (
    CheckConstraint, Column, DateTime, ForeignKey, ForeignKeyConstraint,
    Index, Integer, JSON, String,
)

from app.database import Base
from app.models.invitation import utc_now


class TenantAccessEvent(Base):
    __tablename__ = "tenant_access_events"
    __table_args__ = (
        ForeignKeyConstraint(["organization_id", "actor_id"], ["users.organization_id", "users.id"], name="fk_access_events_tenant_actor"),
        ForeignKeyConstraint(["organization_id", "target_user_id"], ["users.organization_id", "users.id"], name="fk_access_events_tenant_target"),
        ForeignKeyConstraint(["organization_id", "invitation_id"], ["organization_invitations.organization_id", "organization_invitations.id"], name="fk_access_events_tenant_invitation"),
        CheckConstraint("source IN ('administrator', 'bootstrap', 'system')", name="ck_access_events_source"),
        CheckConstraint("source <> 'administrator' OR actor_id IS NOT NULL", name="ck_access_events_actor"),
        CheckConstraint(
            "(source = 'bootstrap' AND actor_id IS NULL AND bootstrap_authorization_id IS NOT NULL "
            "AND length(trim(bootstrap_authorization_id)) > 0) OR "
            "(source <> 'bootstrap' AND bootstrap_authorization_id IS NULL)",
            name="ck_access_events_bootstrap",
        ),
        Index("ix_access_events_org_created", "organization_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    actor_id = Column(Integer, nullable=True)
    target_user_id = Column(Integer, nullable=True)
    invitation_id = Column(Integer, nullable=True)
    action = Column(String(100), nullable=False)
    source = Column(String(20), nullable=False)
    bootstrap_authorization_id = Column(String(128), nullable=True)
    # A3 must whitelist metadata; passwords and raw tokens must never be supplied.
    event_metadata = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
