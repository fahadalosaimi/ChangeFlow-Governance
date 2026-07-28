from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class TokenOutput(BaseModel):
    access_token: str
    token_type: str


class UserRegistrationInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    job_title: Optional[str] = Field(
        default=None,
        max_length=255,
    )


class CurrentUserOutput(BaseModel):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    full_name: str
    email: str
    job_title: Optional[str] = None
    role_name: str
    department_name: Optional[str] = None


class AdminUserOutput(BaseModel):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    full_name: str
    email: str
    job_title: Optional[str] = None
    role_name: str
    department_name: Optional[str] = None
    is_active: str
    created_at: datetime


class RoleOptionOutput(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class AdminUserUpdate(BaseModel):
    role_name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=100,
    )

    is_active: Optional[
        Literal["active", "inactive"]
    ] = None


class UserAdministrationAuditOutput(BaseModel):
    id: int

    action: str

    actor_id: int
    actor_name: str

    target_user_id: int
    target_user_name: str
    target_user_email: str

    old_role: Optional[str] = None
    new_role: Optional[str] = None

    old_status: Optional[str] = None
    new_status: Optional[str] = None

    details: Optional[str] = None
    created_at: datetime

class AdminUserPageOutput(BaseModel):
    items: list[AdminUserOutput]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserAdministrationAuditPageOutput(BaseModel):
    items: list[UserAdministrationAuditOutput]
    total: int
    page: int
    page_size: int
    total_pages: int