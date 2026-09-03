from datetime import datetime
from typing import Literal, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class TokenOutput(BaseModel):
    access_token: str
    token_type: str


class UserRegistrationInput(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True
    )

    full_name: str = Field(
        min_length=2,
        max_length=255,
    )
    email: str = Field(
        min_length=5,
        max_length=255,
    )
    password: str = Field(
        min_length=8,
        max_length=128,
    )
    job_title: Optional[str] = Field(
        default=None,
        max_length=255,
    )

    @field_validator("email")
    @classmethod
    def normalize_email(
        cls,
        value: str,
    ) -> str:
        normalized = value.strip().lower()
        email_domain = (
            normalized.rsplit("@", 1)[-1]
            if "@" in normalized
            else ""
        )

        if (
            "@" not in normalized
            or "." not in email_domain
        ):
            raise ValueError(
                "Enter a valid email address."
            )

        return normalized


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
    is_active: Literal[
        "active",
        "inactive",
    ]
    created_at: datetime


class RoleOptionOutput(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    name: str
    description: Optional[str] = None


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
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=1)


class UserAdministrationAuditPageOutput(
    BaseModel
):
    items: list[
        UserAdministrationAuditOutput
    ]
    total: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=1)
