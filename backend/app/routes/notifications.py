from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.foundation import User
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationOutput,
    NotificationPageOutput,
    NotificationReadAllOutput,
    NotificationUnreadCountOutput,
)
from app.services.auth_service import get_current_user


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


def build_notification_response(
    notification: Notification,
) -> dict:
    actor_name = "System"

    if notification.actor:
        actor_name = notification.actor.full_name

    return {
        "id": notification.id,
        "organization_id": notification.organization_id,
        "recipient_id": notification.recipient_id,
        "actor_id": notification.actor_id,
        "actor_name": actor_name,
        "change_request_id": notification.change_request_id,
        "notification_type": notification.notification_type,
        "title": notification.title,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
        "read_at": notification.read_at,
    }


@router.get(
    "/unread-count",
    response_model=NotificationUnreadCountOutput,
)
def get_unread_notification_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    unread_count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.organization_id
            == current_user.organization_id,
            Notification.is_read.is_(False),
        )
        .count()
    )

    return {
        "unread_count": unread_count,
    }


@router.get(
    "/paged",
    response_model=NotificationPageOutput,
)
def get_notifications_paged(
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    unread_only: bool = Query(
        default=False,
    ),
    notification_type: str | None = Query(
        default=None,
    ),
    search: str | None = Query(
        default=None,
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Notification)
        .options(
            joinedload(Notification.actor),
        )
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.organization_id
            == current_user.organization_id,
        )
    )

    if unread_only:
        query = query.filter(
            Notification.is_read.is_(False)
        )

    if (
        notification_type
        and notification_type.strip()
    ):
        query = query.filter(
            Notification.notification_type
            == notification_type.strip()
        )

    if search and search.strip():
        search_value = (
            f"%{search.strip().lower()}%"
        )

        query = query.filter(
            or_(
                func.lower(
                    Notification.title
                ).like(search_value),
                func.lower(
                    Notification.message
                ).like(search_value),
            )
        )

    total = query.count()

    notifications = (
        query
        .order_by(
            Notification.created_at.desc(),
            Notification.id.desc(),
        )
        .offset(
            (page - 1) * page_size
        )
        .limit(page_size)
        .all()
    )

    total_pages = max(
        1,
        (
            total
            + page_size
            - 1
        ) // page_size,
    )

    return {
        "items": [
            build_notification_response(notification)
            for notification in notifications
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.patch(
    "/read-all",
    response_model=NotificationReadAllOutput,
)
def mark_all_notifications_as_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    read_at = datetime.utcnow()

    updated_count = (
        db.query(Notification)
        .filter(
            Notification.recipient_id == current_user.id,
            Notification.organization_id
            == current_user.organization_id,
            Notification.is_read.is_(False),
        )
        .update(
            {
                Notification.is_read: True,
                Notification.read_at: read_at,
            },
            synchronize_session=False,
        )
    )

    db.commit()

    return {
        "updated_count": updated_count,
    }


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationOutput,
)
def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notification = (
        db.query(Notification)
        .options(
            joinedload(Notification.actor),
        )
        .filter(
            Notification.id == notification_id,
            Notification.recipient_id == current_user.id,
            Notification.organization_id
            == current_user.organization_id,
        )
        .first()
    )

    if not notification:
        raise HTTPException(
            status_code=404,
            detail=(
                "Notification not found or access "
                "is not permitted."
            ),
        )

    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)

    return build_notification_response(
        notification
    )
