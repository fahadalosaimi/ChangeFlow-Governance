from datetime import datetime
from typing import Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class ORMOutput(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )


class OrganizationOutput(ORMOutput):
    id: int
    name: str
    industry: Optional[str] = None
    description: Optional[str] = None


class RoleOutput(ORMOutput):
    id: int
    name: str
    description: Optional[str] = None


class DepartmentOutput(ORMOutput):
    id: int
    organization_id: int
    name: str
    description: Optional[str] = None


class UserOutput(ORMOutput):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    role_id: int
    full_name: str
    email: str
    job_title: Optional[str] = None
    is_active: Optional[str] = None


class ITServiceOutput(ORMOutput):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    business_criticality: str


class ITSystemOutput(ORMOutput):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    service_id: Optional[int] = None
    owner_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    system_type: Optional[str] = None
    environment: str
    criticality: str
    status: str


class SystemDependencyOutput(ORMOutput):
    id: int
    source_system_id: int
    target_system_id: int
    dependency_type: str
    impact_level: str
    description: Optional[str] = None


class IncidentOutput(ORMOutput):
    id: int
    system_id: int
    title: str
    description: Optional[str] = None
    severity: str
    status: str
    occurred_at: datetime
    resolved_at: Optional[datetime] = None


class RiskRuleOutput(ORMOutput):
    id: int
    name: str
    condition_type: str
    condition_value: str
    score: int = Field(ge=0, le=100)
    description: Optional[str] = None
    is_active: str


class SystemImpactProfileOutput(BaseModel):
    system_id: int
    system_name: str
    criticality: str
    department_name: Optional[str] = None
    service_name: Optional[str] = None
    owner_name: Optional[str] = None
    outgoing_dependencies: list[str]
    incoming_dependencies: list[str]
    previous_incidents: list[str]
    impact_summary: str


class DepartmentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Kept for frontend compatibility. The route enforces
    # the authenticated user's organization.
    organization_id: Optional[int] = Field(
        default=None,
        ge=1,
    )
    name: str = Field(
        min_length=2,
        max_length=255,
    )
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def normalize_name(
        cls,
        value: str,
    ) -> str:
        return value.strip()


class ITSystemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # Kept for frontend compatibility. The route enforces
    # the authenticated user's organization.
    organization_id: Optional[int] = Field(
        default=None,
        ge=1,
    )
    department_id: Optional[int] = Field(
        default=None,
        ge=1,
    )
    service_id: Optional[int] = Field(
        default=None,
        ge=1,
    )
    owner_id: Optional[int] = Field(
        default=None,
        ge=1,
    )
    name: str = Field(
        min_length=2,
        max_length=255,
    )
    description: Optional[str] = None
    system_type: Optional[str] = Field(
        default=None,
        max_length=100,
    )
    environment: str = Field(
        default="Production",
        min_length=2,
        max_length=50,
    )
    criticality: Literal[
        "Low",
        "Medium",
        "High",
        "Critical",
    ] = "Medium"
    status: str = Field(
        default="Active",
        min_length=2,
        max_length=50,
    )

    @field_validator("name")
    @classmethod
    def normalize_system_name(
        cls,
        value: str,
    ) -> str:
        return value.strip()


class SystemDependencyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_system_id: int = Field(ge=1)
    target_system_id: int = Field(ge=1)
    dependency_type: str = Field(
        min_length=2,
        max_length=100,
    )
    impact_level: Literal[
        "Low",
        "Medium",
        "High",
        "Critical",
    ] = "Medium"
    description: Optional[str] = None

    @model_validator(mode="after")
    def prevent_self_dependency(self):
        if (
            self.source_system_id
            == self.target_system_id
        ):
            raise ValueError(
                "A configuration item cannot "
                "depend on itself."
            )

        return self


class IncidentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    system_id: int = Field(ge=1)
    title: str = Field(
        min_length=3,
        max_length=255,
    )
    description: Optional[str] = None
    severity: Literal[
        "Low",
        "Medium",
        "High",
        "Critical",
    ] = "Medium"
    status: str = Field(
        default="Resolved",
        min_length=2,
        max_length=50,
    )
    occurred_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_incident_window(self):
        if (
            self.occurred_at is not None
            and self.resolved_at is not None
            and self.resolved_at < self.occurred_at
        ):
            raise ValueError(
                "Resolved date cannot be earlier "
                "than incident date."
            )

        return self


class RiskRuleCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=255,
    )
    condition_type: str = Field(
        min_length=2,
        max_length=100,
    )
    condition_value: str = Field(
        min_length=1,
        max_length=100,
    )
    score: int = Field(ge=0, le=100)
    description: Optional[str] = None
    is_active: Literal[
        "active",
        "inactive",
    ] = "active"


class RiskRuleUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=255,
    )
    condition_type: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=100,
    )
    condition_value: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )
    score: Optional[int] = Field(
        default=None,
        ge=0,
        le=100,
    )
    description: Optional[str] = None
    is_active: Optional[
        Literal["active", "inactive"]
    ] = None
