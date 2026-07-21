from datetime import datetime 
from pydantic import BaseModel
from typing import Optional, List


class OrganizationOutput(BaseModel):
    id: int
    name: str
    industry: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleOutput(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class DepartmentOutput(BaseModel):
    id: int
    organization_id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserOutput(BaseModel):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    role_id: int
    full_name: str
    email: str
    job_title: Optional[str] = None
    is_active: Optional[str] = None

    class Config:
        from_attributes = True


class ITServiceOutput(BaseModel):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    name: str
    description: Optional[str] = None
    business_criticality: str

    class Config:
        from_attributes = True


class ITSystemOutput(BaseModel):
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

    class Config:
        from_attributes = True


class SystemDependencyOutput(BaseModel):
    id: int
    source_system_id: int
    target_system_id: int
    dependency_type: str
    impact_level: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class IncidentOutput(BaseModel):
    id: int
    system_id: int
    title: str
    description: Optional[str] = None
    severity: str
    status: str
    occurred_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RiskRuleOutput(BaseModel):
    id: int
    name: str
    condition_type: str
    condition_value: str
    score: int
    description: Optional[str] = None
    is_active: str

    class Config:
        from_attributes = True


class SystemImpactProfileOutput(BaseModel):
    system_id: int
    system_name: str
    criticality: str
    department_name: Optional[str] = None
    service_name: Optional[str] = None
    owner_name: Optional[str] = None
    outgoing_dependencies: List[str]
    incoming_dependencies: List[str]
    previous_incidents: List[str]
    impact_summary: str


class DepartmentCreate(BaseModel):
    organization_id: int = 1
    name: str
    description: Optional[str] = None


class ITSystemCreate(BaseModel):
    organization_id: int = 1
    department_id: Optional[int] = None
    service_id: Optional[int] = None
    owner_id: Optional[int] = None

    name: str
    description: Optional[str] = None
    system_type: Optional[str] = None
    environment: str = "Production"
    criticality: str = "Medium"
    status: str = "Active"


class SystemDependencyCreate(BaseModel):
    source_system_id: int
    target_system_id: int
    dependency_type: str
    impact_level: str = "Medium"
    description: Optional[str] = None



class IncidentCreate(BaseModel):
    system_id: int
    title: str
    description: Optional[str] = None
    severity: str = "Medium"
    status: str = "Resolved"
    occurred_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


class RiskRuleCreate(BaseModel):
    name: str
    condition_type: str
    condition_value: str
    score: int
    description: Optional[str] = None
    is_active: str = "active"


class RiskRuleUpdate(BaseModel):
    name: Optional[str] = None
    condition_type: Optional[str] = None
    condition_value: Optional[str] = None
    score: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[str] = None