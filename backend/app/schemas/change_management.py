from typing import List, Optional

from pydantic import BaseModel


class ManagedChangeCreate(BaseModel):
    title: str
    description: str

    change_type: str
    change_mode: str = "Normal"
    priority: str = "Medium"

    affected_system_ids: List[int]

    expected_downtime_minutes: int = 0
    rollback_complexity: str = "Medium"
    security_sensitivity: str = "Medium"

    business_justification: Optional[str] = None
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None


class ChangeStatusUpdate(BaseModel):
    new_status: str
    comment: Optional[str] = None


class ApprovalDecisionCreate(BaseModel):
    approval_level: str = "Manager Review"
    decision: str
    comments: Optional[str] = None