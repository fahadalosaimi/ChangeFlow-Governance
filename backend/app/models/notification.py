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


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    organization_id = Column(
        Integer,
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    recipient_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    actor_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=True,
    )

    change_request_id = Column(
        Integer,
        ForeignKey("managed_change_requests.id"),
        nullable=True,
        index=True,
    )

    notification_type = Column(
        String(100),
        nullable=False,
        index=True,
    )

    title = Column(
        String(255),
        nullable=False,
    )

    message = Column(
        Text,
        nullable=False,
    )

    is_read = Column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    read_at = Column(
        DateTime,
        nullable=True,
    )

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
