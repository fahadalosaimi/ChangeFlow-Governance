from pydantic import BaseModel
from typing import List, Optional


class ChangeRequestInput(BaseModel):
    title: str
    description: str
    change_type: str
    related_systems: List[str]
    planned_date: Optional[str] = None
    expected_downtime: Optional[str] = None
    business_justification: Optional[str] = None
    implementation_time: Optional[str] = "outside_working_hours"
    rollback_complexity: Optional[str] = "moderate"
    security_sensitivity: Optional[str] = "medium"


class ChangeAnalysisOutput(BaseModel):
    risk_level: str
    impact_score: int
    risk_factors: List[str]
    affected_systems: List[str]
    affected_departments: List[str]
    recommendations: List[str]
    rollback_plan: List[str]
    testing_checklist: List[str]
    management_summary: str
    technical_summary: str
    ai_explanation: str


class ImpactReportOutput(BaseModel):
    report_title: str
    change_title: str
    risk_level: str
    impact_score: int
    decision_recommendation: str
    decision_reason: str
    executive_summary: str
    technical_summary: str
    ai_explanation: str
    risk_factors: List[str]
    affected_systems: List[str]
    affected_departments: List[str]
    recommendations: List[str]
    rollback_plan: List[str]
    testing_checklist: List[str]
    final_note: str


class ChangeRequestCreate(ChangeRequestInput):
    pass


class ChangeRequestDB(BaseModel):
    id: int
    title: str
    description: str
    change_type: str
    related_systems: str
    planned_date: Optional[str] = None
    expected_downtime: Optional[str] = None
    business_justification: Optional[str] = None
    risk_level: Optional[str] = None
    impact_score: Optional[int] = None

    class Config:
        from_attributes = True