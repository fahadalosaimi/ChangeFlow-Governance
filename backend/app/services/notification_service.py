from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.foundation import Role, User
from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    organization_id: int,
    recipient_id: Optional[int],
    actor_id: Optional[int],
    change_request_id: Optional[int],
    notification_type: str,
    title: str,
    message: str,
) -> Optional[Notification]:
    if recipient_id is None:
        return None

    # Do not generate a notification for the actor's own action.
    if actor_id is not None and recipient_id == actor_id:
        return None

    notification = Notification(
        organization_id=organization_id,
        recipient_id=recipient_id,
        actor_id=actor_id,
        change_request_id=change_request_id,
        notification_type=notification_type,
        title=title,
        message=message,
        is_read=False,
    )

    db.add(notification)
    return notification


def notify_change_managers(
    db: Session,
    *,
    organization_id: int,
    actor_id: Optional[int],
    change_request_id: int,
    notification_type: str,
    title: str,
    message: str,
) -> int:
    managers = (
        db.query(User)
        .join(
            Role,
            User.role_id == Role.id,
        )
        .filter(
            User.organization_id == organization_id,
            Role.name == "Change Manager",
            func.lower(User.is_active) == "active",
        )
        .all()
    )

    created_count = 0

    for manager in managers:
        notification = create_notification(
            db,
            organization_id=organization_id,
            recipient_id=manager.id,
            actor_id=actor_id,
            change_request_id=change_request_id,
            notification_type=notification_type,
            title=title,
            message=message,
        )

        if notification is not None:
            created_count += 1

    return created_count


def notify_requester(
    db: Session,
    *,
    organization_id: int,
    requester_id: Optional[int],
    actor_id: Optional[int],
    change_request_id: int,
    notification_type: str,
    title: str,
    message: str,
) -> bool:
    notification = create_notification(
        db,
        organization_id=organization_id,
        recipient_id=requester_id,
        actor_id=actor_id,
        change_request_id=change_request_id,
        notification_type=notification_type,
        title=title,
        message=message,
    )

    return notification is not None
