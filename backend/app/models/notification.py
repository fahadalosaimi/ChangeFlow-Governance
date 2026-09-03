from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
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


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index(
            "ix_notifications_recipient_read_created",
            "recipient_id",
            "is_read",
            "created_at",
        ),
        Index(
            "ix_notifications_recipient_type_created",
            "recipient_id",
            "notification_type",
            "created_at",
        ),
        Index(
            "ix_notifications_organization_created",
            "organization_id",
            "created_at",
        ),
    )

    id = Column(Integer, primary_key=True)
    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
    )
    recipient_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
    )
    actor_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )
    change_request_id = Column(
        Integer,
        ForeignKey(
            "managed_change_requests.id",
            ondelete="CASCADE",
        ),
        nullable=True,
        index=True,
    )
    notification_type = Column(
        String(100),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(
        Boolean,
        default=False,
        nullable=False,
    )
    created_at = Column(
        DateTime,
        default=utc_now,
        nullable=False,
    )
    read_at = Column(DateTime, nullable=True)

    recipient = relationship(
        "User",
        foreign_keys=[recipient_id],
    )
    actor = relationship(
        "User",
        foreign_keys=[actor_id],
    )
    change_request = relationship(
        "ManagedChangeRequest",
        foreign_keys=[change_request_id],
    )
