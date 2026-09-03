from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ManagedChangeRequest(Base):
    __tablename__ = "managed_change_requests"
    __table_args__ = (
        CheckConstraint(
            "expected_downtime_minutes >= 0",
            name="ck_managed_changes_nonnegative_downtime",
        ),
        CheckConstraint(
            (
                "planned_start IS NULL OR "
                "planned_end IS NULL OR "
                "planned_end >= planned_start"
            ),
            name="ck_managed_changes_planned_window",
        ),
        CheckConstraint(
            (
                "status IN ("
                "'Pending Approval', "
                "'Needs More Information', "
                "'Approved', "
                "'Rejected', "
                "'In Progress', "
                "'Implemented', "
                "'Failed', "
                "'Rolled Back', "
                "'Closed'"
                ")"
            ),
            name="ck_managed_changes_status",
        ),
        Index(
            "ix_managed_changes_organization_status_created",
            "organization_id",
            "status",
            "created_at",
        ),
        Index(
            "ix_managed_changes_requester_created",
            "requester_id",
            "created_at",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
    )
    requester_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    requester = relationship(
        "User",
        foreign_keys=[requester_id],
    )

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    change_type = Column(String(100), nullable=False)
    change_mode = Column(
        String(50),
        default="Normal",
        nullable=False,
    )
    priority = Column(
        String(50),
        default="Medium",
        nullable=False,
    )
    status = Column(
        String(100),
        default="Pending Approval",
        nullable=False,
    )
    expected_downtime_minutes = Column(
        Integer,
        default=0,
        nullable=False,
    )
    rollback_complexity = Column(
        String(50),
        default="Medium",
        nullable=False,
    )
    security_sensitivity = Column(
        String(50),
        default="Medium",
        nullable=False,
    )
    business_justification = Column(
        Text,
        nullable=True,
    )

    # Planned timestamps are organization-local values supplied by the user.
    planned_start = Column(DateTime, nullable=True)
    planned_end = Column(DateTime, nullable=True)

    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
    updated_at = Column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )

    affected_systems = relationship(
        "ManagedChangeAffectedSystem",
        back_populates="change_request",
        cascade="all, delete-orphan",
    )
    assessments = relationship(
        "ManagedImpactAssessment",
        back_populates="change_request",
        cascade="all, delete-orphan",
        order_by="ManagedImpactAssessment.id",
    )
    approvals = relationship(
        "ChangeApproval",
        back_populates="change_request",
        cascade="all, delete-orphan",
        order_by="ChangeApproval.id",
    )
    status_history = relationship(
        "ChangeStatusHistory",
        back_populates="change_request",
        cascade="all, delete-orphan",
        order_by="ChangeStatusHistory.id",
    )
    audit_logs = relationship(
        "AuditLog",
        back_populates="change_request",
        cascade="all, delete-orphan",
        order_by="AuditLog.id",
    )


class ManagedChangeAffectedSystem(Base):
    __tablename__ = "managed_change_affected_systems"
    __table_args__ = (
        UniqueConstraint(
            "change_request_id",
            "system_id",
            name="uq_change_affected_system",
        ),
        Index(
            "ix_change_affected_system_change_id",
            "change_request_id",
        ),
        Index(
            "ix_change_affected_system_system_id",
            "system_id",
        ),
    )

    id = Column(Integer, primary_key=True)
    change_request_id = Column(
        Integer,
        ForeignKey(
            "managed_change_requests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    system_id = Column(
        Integer,
        ForeignKey("it_systems.id"),
        nullable=False,
    )
    impact_role = Column(
        String(50),
        default="Direct",
        nullable=False,
    )

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="affected_systems",
    )


class ManagedImpactAssessment(Base):
    __tablename__ = "managed_impact_assessments"
    __table_args__ = (
        CheckConstraint(
            "impact_score >= 0 AND impact_score <= 100",
            name="ck_managed_assessments_impact_score",
        ),
        Index(
            "ix_managed_assessments_change_created",
            "change_request_id",
            "created_at",
        ),
    )

    id = Column(Integer, primary_key=True)
    change_request_id = Column(
        Integer,
        ForeignKey(
            "managed_change_requests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    risk_level = Column(String(50), nullable=False)
    impact_score = Column(Integer, nullable=False)
    decision_recommendation = Column(
        String(255),
        nullable=False,
    )
    directly_affected_systems = Column(Text, nullable=True)
    indirectly_affected_systems = Column(Text, nullable=True)
    affected_departments = Column(Text, nullable=True)
    system_owners = Column(Text, nullable=True)
    previous_incidents = Column(Text, nullable=True)
    risk_factors = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    rollback_plan = Column(Text, nullable=True)
    testing_checklist = Column(Text, nullable=True)
    ai_explanation = Column(Text, nullable=False)
    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="assessments",
    )


class ChangeStatusHistory(Base):
    __tablename__ = "change_status_history"
    __table_args__ = (
        Index(
            "ix_change_status_history_change_changed",
            "change_request_id",
            "changed_at",
        ),
        Index(
            "ix_change_status_history_changed_by",
            "changed_by",
        ),
    )

    id = Column(Integer, primary_key=True)
    change_request_id = Column(
        Integer,
        ForeignKey(
            "managed_change_requests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    old_status = Column(String(100), nullable=True)
    new_status = Column(String(100), nullable=False)
    changed_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    comment = Column(Text, nullable=True)
    changed_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="status_history",
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index(
            "ix_audit_logs_change_created",
            "change_request_id",
            "created_at",
        ),
        Index(
            "ix_audit_logs_actor_id",
            "actor_id",
        ),
        Index(
            "ix_audit_logs_entity",
            "entity_type",
            "entity_id",
        ),
    )

    id = Column(Integer, primary_key=True)
    change_request_id = Column(
        Integer,
        ForeignKey(
            "managed_change_requests.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )
    actor_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    action = Column(String(255), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="audit_logs",
    )


class ChangeApproval(Base):
    __tablename__ = "change_approvals"
    __table_args__ = (
        Index(
            "ix_change_approvals_change_decided",
            "change_request_id",
            "decided_at",
        ),
        Index(
            "ix_change_approvals_approver_id",
            "approver_id",
        ),
    )

    id = Column(Integer, primary_key=True)
    change_request_id = Column(
        Integer,
        ForeignKey(
            "managed_change_requests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )
    approver_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    approval_level = Column(
        String(100),
        default="Manager Review",
        nullable=False,
    )
    decision = Column(
        String(100),
        default="Pending",
        nullable=False,
    )
    comments = Column(Text, nullable=True)
    decided_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="approvals",
    )
