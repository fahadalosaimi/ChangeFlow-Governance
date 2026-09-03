from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import (
    BaseModel,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)


TitleText = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=3,
        max_length=255,
    ),
]

DescriptionText = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=10,
    ),
]


class ManagedChangeBase(BaseModel):
    title: TitleText
    description: DescriptionText
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
    priority: Literal[
        "Low",
        "Medium",
        "High",
        "Critical",
    ] = "Medium"
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
    business_justification: Optional[str] = Field(
        default=None,
        max_length=8000,
    )
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None

    @field_validator("affected_system_ids")
    @classmethod
    def validate_affected_system_ids(
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

    @model_validator(mode="after")
    def validate_planned_window(self):
        if (
            self.planned_start is not None
            and self.planned_end is not None
            and self.planned_end < self.planned_start
        ):
            raise ValueError(
                "Planned end cannot be earlier "
                "than planned start."
            )

        if self.business_justification is not None:
            normalized = (
                self.business_justification.strip()
            )
            self.business_justification = (
                normalized or None
            )

        return self


class ManagedChangeCreate(ManagedChangeBase):
    pass


class ApprovalDecisionCreate(BaseModel):
    approval_level: str = Field(
        default="Manager Review",
        min_length=2,
        max_length=100,
    )
    decision: Literal[
        "Approved",
        "Rejected",
        "Needs More Information",
    ]
    comments: Optional[str] = Field(
        default=None,
        max_length=4000,
    )

    @model_validator(mode="after")
    def require_decision_comments(self):
        comments = (
            self.comments.strip()
            if self.comments
            else ""
        )

        if (
            self.decision
            in {
                "Rejected",
                "Needs More Information",
            }
            and not comments
        ):
            raise ValueError(
                "Comments are required when "
                "rejecting a change or requesting "
                "more information."
            )

        self.comments = comments or None
        return self


class ManagedChangeRevision(ManagedChangeBase):
    revision_comment: str = Field(
        min_length=3,
        max_length=4000,
    )


class ManagedAssessmentOutput(BaseModel):
    risk_level: str
    impact_score: int = Field(ge=0, le=100)
    decision_recommendation: str
    directly_affected_systems: list[str]
    indirectly_affected_systems: list[str]
    affected_departments: list[str]
    system_owners: list[str]
    previous_incidents: list[str]
    risk_factors: list[str]
    recommendations: list[str]
    rollback_plan: list[str]
    testing_checklist: list[str]
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
    planned_start: Optional[datetime] = None
    planned_end: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    affected_system_ids: list[int]
    latest_assessment: Optional[
        ManagedAssessmentOutput
    ] = None


class ManagedChangePageOutput(BaseModel):
    items: list[ManagedChangeOutput]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=1)


class ChangeWorkQueueOverview(BaseModel):
    pending_review: int = Field(ge=0)
    critical_pending: int = Field(ge=0)
    high_pending: int = Field(ge=0)
    awaiting_requester: int = Field(ge=0)
