from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class ChangeImplementation(Base):
    __tablename__ = "change_implementations"
    __table_args__ = (
        CheckConstraint(
            (
                "implementation_status IN ("
                "'Not Started', "
                "'In Progress', "
                "'Implemented', "
                "'Failed', "
                "'Rolled Back', "
                "'Closed'"
                ")"
            ),
            name="ck_change_implementations_status",
        ),
        CheckConstraint(
            (
                "pir_result IS NULL OR "
                "pir_result IN ("
                "'Successful', "
                "'Successful with Issues', "
                "'Unsuccessful'"
                ")"
            ),
            name="ck_change_implementations_pir_result",
        ),
        Index(
            "ix_change_implementations_status_updated",
            "implementation_status",
            "updated_at",
        ),
        Index(
            "ix_change_implementations_coordinator_id",
            "coordinator_id",
        ),
    )

    id = Column(
        Integer,
        primary_key=True,
    )
    change_request_id = Column(
        Integer,
        ForeignKey(
            "managed_change_requests.id",
            ondelete="CASCADE",
        ),
        nullable=False,
        unique=True,
        index=True,
    )
    coordinator_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    implementation_status = Column(
        String(100),
        default="Not Started",
        nullable=False,
    )
    start_notes = Column(Text, nullable=True)
    actual_start = Column(DateTime, nullable=True)
    completion_summary = Column(Text, nullable=True)
    validation_results = Column(Text, nullable=True)
    actual_end = Column(DateTime, nullable=True)
    failure_summary = Column(Text, nullable=True)
    rollback_performed = Column(
        Boolean,
        default=False,
        nullable=False,
    )
    rollback_reason = Column(Text, nullable=True)
    pir_result = Column(String(100), nullable=True)
    pir_summary = Column(Text, nullable=True)
    follow_up_actions = Column(Text, nullable=True)
    pir_completed_at = Column(DateTime, nullable=True)
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

    change_request = relationship(
        "ManagedChangeRequest",
        foreign_keys=[change_request_id],
    )
    coordinator = relationship(
        "User",
        foreign_keys=[coordinator_id],
    )
