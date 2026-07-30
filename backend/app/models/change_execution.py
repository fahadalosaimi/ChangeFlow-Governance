from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class ChangeImplementation(Base):
    __tablename__ = "change_implementations"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    change_request_id = Column(
        Integer,
        ForeignKey("managed_change_requests.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    coordinator_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    implementation_status = Column(
        String(100),
        default="Not Started",
        nullable=False,
        index=True,
    )

    start_notes = Column(
        Text,
        nullable=True,
    )

    actual_start = Column(
        DateTime,
        nullable=True,
    )

    completion_summary = Column(
        Text,
        nullable=True,
    )

    validation_results = Column(
        Text,
        nullable=True,
    )

    actual_end = Column(
        DateTime,
        nullable=True,
    )

    failure_summary = Column(
        Text,
        nullable=True,
    )

    rollback_performed = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    rollback_reason = Column(
        Text,
        nullable=True,
    )

    pir_result = Column(
        String(100),
        nullable=True,
    )

    pir_summary = Column(
        Text,
        nullable=True,
    )

    follow_up_actions = Column(
        Text,
        nullable=True,
    )

    pir_completed_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    change_request = relationship(
        "ManagedChangeRequest",
        foreign_keys=[change_request_id],
    )

    coordinator = relationship(
        "User",
        foreign_keys=[coordinator_id],
    )
