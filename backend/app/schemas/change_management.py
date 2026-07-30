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


class ManagedChangeRevision(BaseModel):
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

    revision_comment: str

class ManagedAssessmentOutput(BaseModel):
    risk_level: str
    impact_score: int
    decision_recommendation: str

    directly_affected_systems: List[str]
    indirectly_affected_systems: List[str]
    affected_departments: List[str]
    system_owners: List[str]
    previous_incidents: List[str]

    risk_factors: List[str]
    recommendations: List[str]
    rollback_plan: List[str]
    testing_checklist: List[str]

    ai_explanation: str


class ManagedChangeOutput(BaseModel):
    id: int

    requester_id: Optional[int] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None

    title: str
    description: str

    change_type: str
    change_mode: str
    priority: str
    status: str

    expected_downtime_minutes: int
    rollback_complexity: str
    security_sensitivity: str

    business_justification: Optional[str] = None
    planned_start: Optional[str] = None
    planned_end: Optional[str] = None

    created_at: str
    updated_at: str

    affected_system_ids: List[int]
    latest_assessment: Optional[ManagedAssessmentOutput] = None


class ManagedChangePageOutput(BaseModel):
    items: List[ManagedChangeOutput]

    total: int
    page: int
    page_size: int
    total_pages: int



class ChangeWorkQueueOverview(BaseModel):
    pending_review: int
    critical_pending: int
    high_pending: int
    awaiting_requester: int

