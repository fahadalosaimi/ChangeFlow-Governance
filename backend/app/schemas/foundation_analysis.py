from pydantic import BaseModel, Field
from typing import List


class FoundationImpactAnalysisInput(BaseModel):
    title: str
    description: str
    change_type: str
    change_mode: str = "Normal"
    affected_system_ids: List[int]
    expected_downtime_minutes: int = 0
    rollback_complexity: str = "Medium"
    security_sensitivity: str = "Medium"


class FoundationImpactAnalysisOutput(BaseModel):
    title: str
    risk_level: str
    impact_score: int
    decision_recommendation: str

    directly_affected_systems: List[str] = Field(default_factory=list)
    indirectly_affected_systems: List[str] = Field(default_factory=list)
    affected_departments: List[str] = Field(default_factory=list)
    system_owners: List[str] = Field(default_factory=list)
    previous_incidents: List[str] = Field(default_factory=list)

    risk_factors: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    rollback_plan: List[str] = Field(default_factory=list)
    testing_checklist: List[str] = Field(default_factory=list)

    ai_explanation: str