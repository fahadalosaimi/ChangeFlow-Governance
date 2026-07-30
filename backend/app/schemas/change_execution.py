from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ChangeImplementationStart(BaseModel):
    start_notes: Optional[str] = None


class ChangeImplementationComplete(BaseModel):
    completion_summary: str = Field(
        min_length=3,
    )
    validation_results: str = Field(
        min_length=3,
    )


class ChangeImplementationFailure(BaseModel):
    failure_summary: str = Field(
        min_length=3,
    )


class ChangeImplementationRollback(BaseModel):
    rollback_reason: str = Field(
        min_length=3,
    )


class PostImplementationReviewCreate(BaseModel):
    pir_result: str
    pir_summary: str = Field(
        min_length=3,
    )
    follow_up_actions: Optional[str] = None


class ChangeImplementationOutput(BaseModel):
    id: int
    change_request_id: int

    coordinator_id: Optional[int] = None
    coordinator_name: str

    implementation_status: str

    start_notes: Optional[str] = None
    actual_start: Optional[datetime] = None

    completion_summary: Optional[str] = None
    validation_results: Optional[str] = None
    actual_end: Optional[datetime] = None

    failure_summary: Optional[str] = None

    rollback_performed: bool
    rollback_reason: Optional[str] = None

    pir_result: Optional[str] = None
    pir_summary: Optional[str] = None
    follow_up_actions: Optional[str] = None
    pir_completed_at: Optional[datetime] = None

    created_at: datetime
    updated_at: datetime


class DeliveryQueueOverview(BaseModel):
    approved_ready: int
    in_progress: int
    pending_pir: int
    failed: int
