from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.email_key import EmailKey


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint(
            "length(slug) BETWEEN 3 AND 100 AND slug = lower(slug) "
            "AND slug = trim(slug)", name="ck_organizations_slug",
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    industry = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )

    departments = relationship(
        "Department",
        back_populates="organization",
    )
    users = relationship(
        "User",
        back_populates="organization",
        foreign_keys="User.organization_id",
    )
    systems = relationship(
        "ITSystem",
        back_populates="organization",
    )
    services = relationship(
        "ITService",
        back_populates="organization",
    )


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_roles_org_id"),
        UniqueConstraint("organization_id", "name", name="uq_roles_org_name"),
        UniqueConstraint("organization_id", "legacy_source_role_id", name="uq_roles_org_legacy_source"),
        CheckConstraint(
            "organization_id IS NOT NULL OR legacy_source_role_id IS NULL",
            name="ck_roles_legacy_source",
        ),
        Index("ix_roles_organization_id", "organization_id"),
    )

    id = Column(Integer, primary_key=True)
    # NULL is reserved for preserved legacy definitions, never tenant access.
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    legacy_source_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    name = Column(
        String(100),
        nullable=False,
    )
    description = Column(Text, nullable=True)

    users = relationship(
        "User",
        back_populates="role",
        primaryjoin="Role.id == User.role_id",
        foreign_keys="User.role_id",
    )


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_departments_org_id"),
        UniqueConstraint(
            "organization_id",
            "name",
            name="uq_departments_organization_name",
        ),
        Index(
            "ix_departments_organization_id",
            "organization_id",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    organization = relationship(
        "Organization",
        back_populates="departments",
    )
    users = relationship(
        "User",
        back_populates="department",
        primaryjoin="Department.id == User.department_id",
        foreign_keys="User.department_id",
    )
    systems = relationship(
        "ITSystem",
        back_populates="department",
        primaryjoin="Department.id == ITSystem.department_id",
        foreign_keys="ITSystem.department_id",
    )
    services = relationship(
        "ITService",
        back_populates="department",
        primaryjoin="Department.id == ITService.department_id",
        foreign_keys="ITService.department_id",
    )


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_users_org_id"),
        ForeignKeyConstraint(
            ["organization_id", "role_id"], ["roles.organization_id", "roles.id"],
            name="fk_users_tenant_role",
        ),
        ForeignKeyConstraint(
            ["organization_id", "department_id"], ["departments.organization_id", "departments.id"],
            name="fk_users_tenant_department",
        ),
        CheckConstraint(
            "membership_source IN ('legacy', 'invitation', 'bootstrap')",
            name="ck_users_membership_source",
        ),
        CheckConstraint(
            "membership_source = 'legacy' OR is_active = 'inactive' OR "
            "(membership_confirmed_at IS NOT NULL AND email_verified_at IS NOT NULL "
            "AND password_hash IS NOT NULL AND length(password_hash) > 0)",
            name="ck_users_membership_activation",
        ),
        CheckConstraint(
            "is_active IN ('active', 'inactive')",
            name="ck_users_is_active",
        ),
        Index(
            "ix_users_organization_id",
            "organization_id",
        ),
        Index(
            "ix_users_department_id",
            "department_id",
        ),
        Index(
            "ix_users_role_id",
            "role_id",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
    )
    department_id = Column(
        Integer,
        ForeignKey(
            "departments.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    role_id = Column(
        Integer,
        ForeignKey("roles.id"),
        nullable=False,
    )

    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    # Existing rows are explicitly backfilled as legacy; new rows fail closed.
    membership_source = Column(String(20), nullable=False, default="invitation", server_default="invitation")
    membership_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    # Some CMDB owners are directory identities and do not sign in.
    password_hash = Column(String(255), nullable=True)
    job_title = Column(String(255), nullable=True)
    is_active = Column(
        String(20),
        default="active",
        nullable=False,
    )
    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )

    organization = relationship(
        "Organization",
        back_populates="users",
        foreign_keys=[organization_id],
    )
    department = relationship(
        "Department",
        back_populates="users",
        primaryjoin="User.department_id == Department.id",
        foreign_keys=[department_id],
    )
    role = relationship(
        "Role",
        back_populates="users",
        primaryjoin="User.role_id == Role.id",
        foreign_keys=[role_id],
    )
    owned_systems = relationship(
        "ITSystem",
        back_populates="owner",
        primaryjoin="User.id == ITSystem.owner_id",
        foreign_keys="ITSystem.owner_id",
    )


class ITService(Base):
    __tablename__ = "it_services"
    __table_args__ = (
        UniqueConstraint("organization_id", "id", name="uq_it_services_org_id"),
        ForeignKeyConstraint(
            ["organization_id", "department_id"], ["departments.organization_id", "departments.id"],
            name="fk_it_services_tenant_department",
        ),
        UniqueConstraint(
            "organization_id",
            "name",
            name="uq_it_services_organization_name",
        ),
        Index(
            "ix_it_services_organization_id",
            "organization_id",
        ),
        Index(
            "ix_it_services_department_id",
            "department_id",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
    )
    department_id = Column(
        Integer,
        ForeignKey(
            "departments.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    business_criticality = Column(
        String(50),
        default="Medium",
        nullable=False,
    )

    organization = relationship(
        "Organization",
        back_populates="services",
    )
    department = relationship(
        "Department",
        back_populates="services",
        primaryjoin="ITService.department_id == Department.id",
        foreign_keys=[department_id],
    )
    systems = relationship(
        "ITSystem",
        back_populates="service",
        primaryjoin="ITService.id == ITSystem.service_id",
        foreign_keys="ITSystem.service_id",
    )


class ITSystem(Base):
    __tablename__ = "it_systems"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "department_id"], ["departments.organization_id", "departments.id"],
            name="fk_it_systems_tenant_department",
        ),
        ForeignKeyConstraint(
            ["organization_id", "service_id"], ["it_services.organization_id", "it_services.id"],
            name="fk_it_systems_tenant_service",
        ),
        ForeignKeyConstraint(
            ["organization_id", "owner_id"], ["users.organization_id", "users.id"],
            name="fk_it_systems_tenant_owner",
        ),
        UniqueConstraint(
            "organization_id",
            "name",
            name="uq_it_systems_organization_name",
        ),
        Index(
            "ix_it_systems_organization_id",
            "organization_id",
        ),
        Index(
            "ix_it_systems_department_id",
            "department_id",
        ),
        Index(
            "ix_it_systems_service_id",
            "service_id",
        ),
        Index(
            "ix_it_systems_owner_id",
            "owner_id",
        ),
        Index(
            "ix_it_systems_criticality_status",
            "criticality",
            "status",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
    )
    department_id = Column(
        Integer,
        ForeignKey(
            "departments.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    service_id = Column(
        Integer,
        ForeignKey(
            "it_services.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    owner_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    system_type = Column(String(100), nullable=True)
    environment = Column(
        String(50),
        default="Production",
        nullable=False,
    )
    criticality = Column(
        String(50),
        default="Medium",
        nullable=False,
    )
    status = Column(
        String(50),
        default="Active",
        nullable=False,
    )
    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )

    organization = relationship(
        "Organization",
        back_populates="systems",
    )
    department = relationship(
        "Department",
        back_populates="systems",
        primaryjoin="ITSystem.department_id == Department.id",
        foreign_keys=[department_id],
    )
    service = relationship(
        "ITService",
        back_populates="systems",
        primaryjoin="ITSystem.service_id == ITService.id",
        foreign_keys=[service_id],
    )
    owner = relationship(
        "User",
        back_populates="owned_systems",
        primaryjoin="ITSystem.owner_id == User.id",
        foreign_keys=[owner_id],
    )
    outgoing_dependencies = relationship(
        "SystemDependency",
        foreign_keys="SystemDependency.source_system_id",
        back_populates="source_system",
    )
    incoming_dependencies = relationship(
        "SystemDependency",
        foreign_keys="SystemDependency.target_system_id",
        back_populates="target_system",
    )


class SystemDependency(Base):
    __tablename__ = "system_dependencies"
    __table_args__ = (
        UniqueConstraint(
            "source_system_id",
            "target_system_id",
            name="uq_system_dependencies_source_target",
        ),
        CheckConstraint(
            "source_system_id <> target_system_id",
            name="ck_system_dependencies_not_self",
        ),
        Index(
            "ix_system_dependencies_source_system_id",
            "source_system_id",
        ),
        Index(
            "ix_system_dependencies_target_system_id",
            "target_system_id",
        ),
    )

    id = Column(Integer, primary_key=True)
    source_system_id = Column(
        Integer,
        ForeignKey("it_systems.id"),
        nullable=False,
    )
    target_system_id = Column(
        Integer,
        ForeignKey("it_systems.id"),
        nullable=False,
    )
    dependency_type = Column(
        String(100),
        nullable=False,
    )
    impact_level = Column(
        String(50),
        default="Medium",
        nullable=False,
    )
    description = Column(Text, nullable=True)

    source_system = relationship(
        "ITSystem",
        foreign_keys=[source_system_id],
        back_populates="outgoing_dependencies",
    )
    target_system = relationship(
        "ITSystem",
        foreign_keys=[target_system_id],
        back_populates="incoming_dependencies",
    )


class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = (
        CheckConstraint(
            (
                "resolved_at IS NULL OR "
                "occurred_at IS NULL OR "
                "resolved_at >= occurred_at"
            ),
            name="ck_incidents_resolution_window",
        ),
        Index(
            "ix_incidents_system_occurred_at",
            "system_id",
            "occurred_at",
        ),
    )

    id = Column(Integer, primary_key=True)
    system_id = Column(
        Integer,
        ForeignKey("it_systems.id"),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    severity = Column(
        String(50),
        default="Medium",
        nullable=False,
    )
    status = Column(
        String(50),
        default="Resolved",
        nullable=False,
    )
    occurred_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
    resolved_at = Column(DateTime, nullable=True)


class RiskRule(Base):
    __tablename__ = "risk_rules"
    __table_args__ = (
        UniqueConstraint(
            "name",
            name="uq_risk_rules_name",
        ),
        CheckConstraint(
            "score >= 0 AND score <= 100",
            name="ck_risk_rules_score_range",
        ),
        CheckConstraint(
            "is_active IN ('active', 'inactive')",
            name="ck_risk_rules_is_active",
        ),
        Index(
            "ix_risk_rules_active_condition",
            "is_active",
            "condition_type",
            "condition_value",
        ),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    condition_type = Column(
        String(100),
        nullable=False,
    )
    condition_value = Column(
        String(100),
        nullable=False,
    )
    score = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(
        String(20),
        default="active",
        nullable=False,
    )


class UserAdministrationAudit(Base):
    __tablename__ = "user_administration_audit_logs"
    __table_args__ = (
        Index(
            "ix_user_admin_audit_actor_id",
            "actor_id",
        ),
        Index(
            "ix_user_admin_audit_target_user_id",
            "target_user_id",
        ),
        Index(
            "ix_user_admin_audit_created_at",
            "created_at",
        ),
    )

    id = Column(Integer, primary_key=True)
    actor_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )
    target_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )
    action = Column(String(100), nullable=False)
    old_role = Column(String(100), nullable=True)
    new_role = Column(String(100), nullable=True)
    old_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )


# The same database expression is used by preflight and the enforce migration.
# PostgreSQL is authoritative for Unicode lower() semantics and concurrency.
Index("uq_users_org_email_ci", User.organization_id, EmailKey(User.email), unique=True)
