from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


class FoundationImpactAnalysisInput(BaseModel):
    title: str = Field(
        min_length=3,
        max_length=255,
    )
    description: str = Field(
        min_length=10,
    )
    change_type: Literal[
        "database",
        "application",
        "network",
        "security",
        "documentation",
    ]
    change_mode: Literal[
        "Standard",
        "Normal",
        "Emergency",
    ] = "Normal"
    affected_system_ids: list[int] = Field(
        min_length=1,
    )
    expected_downtime_minutes: int = Field(
        default=0,
        ge=0,
        le=43200,
    )
    rollback_complexity: Literal[
        "Low",
        "Medium",
        "High",
    ] = "Medium"
    security_sensitivity: Literal[
        "Low",
        "Medium",
        "High",
    ] = "Medium"

    @field_validator("affected_system_ids")
    @classmethod
    def validate_system_ids(
        cls,
        values: list[int],
    ) -> list[int]:
        if any(value <= 0 for value in values):
            raise ValueError(
                "Affected system IDs must be positive."
            )

        if len(values) != len(set(values)):
            raise ValueError(
                "Affected system IDs must be unique."
            )

        return values


class FoundationImpactAnalysisOutput(BaseModel):
    title: str
    risk_level: str
    impact_score: int = Field(ge=0, le=100)
    decision_recommendation: str
    directly_affected_systems: list[str] = Field(
        default_factory=list
    )
    indirectly_affected_systems: list[str] = Field(
        default_factory=list
    )
    affected_departments: list[str] = Field(
        default_factory=list
    )
    system_owners: list[str] = Field(
        default_factory=list
    )
    previous_incidents: list[str] = Field(
        default_factory=list
    )
    risk_factors: list[str] = Field(
        default_factory=list
    )
    recommendations: list[str] = Field(
        default_factory=list
    )
    rollback_plan: list[str] = Field(
        default_factory=list
    )
    testing_checklist: list[str] = Field(
        default_factory=list
    )
    ai_explanation: str
