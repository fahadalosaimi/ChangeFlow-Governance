"""Tenant invitation persistence only; issuance/acceptance belong to A3."""

from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint, Column, DateTime, ForeignKey, ForeignKeyConstraint,
    Index, Integer, String, UniqueConstraint,
)

from app.database import Base
from app.models.email_key import EmailKey


def utc_now():
    return datetime.now(timezone.utc)


class OrganizationInvitation(Base):
    __tablename__ = "organization_invitations"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_invitations_org_id"),
        UniqueConstraint("token_hash", name="uq_invitations_token_hash"),
        ForeignKeyConstraint(["organization_id", "role_id"], ["roles.organization_id", "roles.id"], name="fk_invitations_tenant_role"),
        ForeignKeyConstraint(["organization_id", "department_id"], ["departments.organization_id", "departments.id"], name="fk_invitations_tenant_department"),
        ForeignKeyConstraint(["organization_id", "invited_by"], ["users.organization_id", "users.id"], name="fk_invitations_tenant_inviter"),
        ForeignKeyConstraint(["organization_id", "target_user_id"], ["users.organization_id", "users.id"], name="fk_invitations_tenant_target"),
        ForeignKeyConstraint(["organization_id", "accepted_user_id"], ["users.organization_id", "users.id"], name="fk_invitations_tenant_acceptor"),
        CheckConstraint("length(token_hash) = 64", name="ck_invitations_hash_length"),
        CheckConstraint("length(trim(email)) > 0", name="ck_invitations_email"),
        CheckConstraint("purpose IN ('membership', 'directory_activation', 'bootstrap')", name="ck_invitations_purpose"),
        CheckConstraint("status IN ('pending', 'accepted', 'revoked', 'expired')", name="ck_invitations_status"),
        CheckConstraint("delivery_status IN ('pending', 'sent', 'failed') AND delivery_attempts >= 0", name="ck_invitations_delivery"),
        CheckConstraint("expires_at > created_at", name="ck_invitations_expiry"),
        CheckConstraint(
            "(purpose = 'bootstrap' AND invited_by IS NULL AND bootstrap_authorization_id IS NOT NULL "
            "AND length(trim(bootstrap_authorization_id)) > 0) OR "
            "(purpose <> 'bootstrap' AND invited_by IS NOT NULL AND bootstrap_authorization_id IS NULL)",
            name="ck_invitations_authority",
        ),
        CheckConstraint(
            "(purpose = 'directory_activation' AND target_user_id IS NOT NULL) OR "
            "(purpose <> 'directory_activation' AND target_user_id IS NULL)",
            name="ck_invitations_target",
        ),
        CheckConstraint(
            "(status = 'accepted' AND consumed_at IS NOT NULL AND accepted_user_id IS NOT NULL "
            "AND consumed_at >= created_at AND consumed_at <= expires_at) OR "
            "(status <> 'accepted' AND consumed_at IS NULL AND accepted_user_id IS NULL)",
            name="ck_invitations_consumption",
        ),
        CheckConstraint(
            "purpose <> 'directory_activation' OR status <> 'accepted' OR accepted_user_id = target_user_id",
            name="ck_invitations_directory_acceptor",
        ),
        CheckConstraint(
            "(status = 'revoked' AND revoked_at IS NOT NULL) OR "
            "(status <> 'revoked' AND revoked_at IS NULL)", name="ck_invitations_revocation",
        ),
        Index("ix_invitations_org_created", "organization_id", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    email = Column(String(255), nullable=False)
    role_id = Column(Integer, nullable=False)
    department_id = Column(Integer, nullable=True)
    invited_by = Column(Integer, nullable=True)
    target_user_id = Column(Integer, nullable=True)
    accepted_user_id = Column(Integer, nullable=True)
    purpose = Column(String(30), nullable=False, default="membership", server_default="membership")
    # Non-secret reference to an explicitly authorized operational bootstrap.
    bootstrap_authorization_id = Column(String(128), nullable=True)
    token_hash = Column(String(64), nullable=False)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    consumed_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    delivery_status = Column(String(20), nullable=False, default="pending", server_default="pending")
    delivery_attempts = Column(Integer, nullable=False, default=0, server_default="0")
    last_delivery_at = Column(DateTime(timezone=True), nullable=True)


Index(
    "uq_invitations_pending_email_ci",
    OrganizationInvitation.organization_id,
    EmailKey(OrganizationInvitation.email),
    unique=True,
    postgresql_where=OrganizationInvitation.status == "pending",
    sqlite_where=OrganizationInvitation.status == "pending",
)

Index(
    "uq_invitations_pending_bootstrap", OrganizationInvitation.organization_id,
    unique=True,
    postgresql_where=(OrganizationInvitation.purpose == "bootstrap") & (OrganizationInvitation.status == "pending"),
    sqlite_where=(OrganizationInvitation.purpose == "bootstrap") & (OrganizationInvitation.status == "pending"),
)
