from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class ManagedChangeRequest(Base):
    __tablename__ = "managed_change_requests"

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    requester = relationship("User",foreign_keys=[requester_id],)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)

    change_type = Column(String(100), nullable=False)
    change_mode = Column(String(50), default="Normal")
    priority = Column(String(50), default="Medium")

    status = Column(String(100), default="Pending Approval")

    expected_downtime_minutes = Column(Integer, default=0)
    rollback_complexity = Column(String(50), default="Medium")
    security_sensitivity = Column(String(50), default="Medium")

    business_justification = Column(Text, nullable=True)

    planned_start = Column(String(100), nullable=True)
    planned_end = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    affected_systems = relationship(
        "ManagedChangeAffectedSystem",
        back_populates="change_request",
        cascade="all, delete-orphan",
    )

    assessments = relationship(
        "ManagedImpactAssessment",
        back_populates="change_request",
        cascade="all, delete-orphan",
    )

    approvals = relationship(
        "ChangeApproval",
        back_populates="change_request",
        cascade="all, delete-orphan",
    )

    status_history = relationship(
        "ChangeStatusHistory",
        back_populates="change_request",
        cascade="all, delete-orphan",
    )

    audit_logs = relationship(
        "AuditLog",
        back_populates="change_request",
        cascade="all, delete-orphan",
    )


class ManagedChangeAffectedSystem(Base):
    __tablename__ = "managed_change_affected_systems"

    id = Column(Integer, primary_key=True, index=True)

    change_request_id = Column(
        Integer,
        ForeignKey("managed_change_requests.id"),
        nullable=False,
    )

    system_id = Column(Integer, ForeignKey("it_systems.id"), nullable=False)

    impact_role = Column(String(50), default="Direct")

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="affected_systems",
    )


class ManagedImpactAssessment(Base):
    __tablename__ = "managed_impact_assessments"

    id = Column(Integer, primary_key=True, index=True)

    change_request_id = Column(
        Integer,
        ForeignKey("managed_change_requests.id"),
        nullable=False,
    )

    risk_level = Column(String(50), nullable=False)
    impact_score = Column(Integer, nullable=False)
    decision_recommendation = Column(String(255), nullable=False)

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

    created_at = Column(DateTime, default=datetime.utcnow)

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="assessments",
    )


class ChangeStatusHistory(Base):
    __tablename__ = "change_status_history"

    id = Column(Integer, primary_key=True, index=True)

    change_request_id = Column(
        Integer,
        ForeignKey("managed_change_requests.id"),
        nullable=False,
    )

    old_status = Column(String(100), nullable=True)
    new_status = Column(String(100), nullable=False)

    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    comment = Column(Text, nullable=True)

    changed_at = Column(DateTime, default=datetime.utcnow)

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="status_history",
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    change_request_id = Column(
        Integer,
        ForeignKey("managed_change_requests.id"),
        nullable=True,
    )

    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    action = Column(String(255), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=True)

    details = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="audit_logs",
    )

class ChangeApproval(Base):
    __tablename__ = "change_approvals"

    id = Column(Integer, primary_key=True, index=True)

    change_request_id = Column(
        Integer,
        ForeignKey("managed_change_requests.id"),
        nullable=False,
    )

    approver_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    approval_level = Column(String(100), default="Manager Review")
    decision = Column(String(100), default="Pending")
    comments = Column(Text, nullable=True)

    decided_at = Column(DateTime, default=datetime.utcnow)

    change_request = relationship(
        "ManagedChangeRequest",
        back_populates="approvals",
    )