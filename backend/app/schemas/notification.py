from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    items: list[NotificationOutput]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=1)


class NotificationUnreadCountOutput(BaseModel):
    unread_count: int = Field(ge=0)


class NotificationReadAllOutput(BaseModel):
    updated_count: int = Field(ge=0)
