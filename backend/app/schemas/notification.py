from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class NotificationOutput(BaseModel):
    id: int
    organization_id: int
    recipient_id: int

    actor_id: Optional[int] = None
    actor_name: str

    change_request_id: Optional[int] = None

    notification_type: str
    title: str
    message: str

    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationPageOutput(BaseModel):
    items: List[NotificationOutput]
    total: int
    page: int
    page_size: int
    total_pages: int


class NotificationUnreadCountOutput(BaseModel):
    unread_count: int


class NotificationReadAllOutput(BaseModel):
    updated_count: int
