from datetime import datetime
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator


def invitation_email(value: str) -> str:
    value = value.strip(" ")
    if (not value or len(value) > 255 or value.count("@") != 1
            or any(character.isspace() or ord(character) < 32 for character in value)):
        raise ValueError("Invalid email.")
    local, domain = value.split("@")
    if not local or "." not in domain or domain.startswith(".") or domain.endswith("."):
        raise ValueError("Invalid email.")
    return value


class InvitationCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    email: str
    role_id: int = Field(gt=0, strict=True)
    department_id: int | None = Field(default=None, gt=0, strict=True)
    purpose: Literal["membership", "directory_activation"] = "membership"
    target_user_id: int | None = Field(default=None, gt=0, strict=True)

    _email = field_validator("email")(invitation_email)

    @model_validator(mode="after")
    def validate_target(self):
        if (self.purpose == "directory_activation") != (self.target_user_id is not None):
            raise ValueError("Invalid directory target.")
        return self


class InvitationOutput(BaseModel):
    id: int
    organization_id: int
    email: str
    role_id: int
    department_id: int | None
    purpose: str
    target_user_id: int | None
    status: str
    created_at: datetime
    expires_at: datetime
    delivery_status: str
    delivery_attempts: int
    last_delivery_at: datetime | None


class InvitationAcceptance(BaseModel):
    model_config = ConfigDict(extra="forbid")
    token: SecretStr
    password: SecretStr
    full_name: str | None = Field(default=None, min_length=2, max_length=255)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value):
        if re.fullmatch(r"[A-Za-z0-9_-]{43}", value.get_secret_value()) is None:
            raise ValueError("Invalid invitation.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value):
        raw = value.get_secret_value()
        if len(raw) < 8 or len(raw.encode("utf-8")) > 72:
            raise ValueError("Invalid membership password.")
        return value

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value):
        if value is not None and len(value.strip()) < 2:
            raise ValueError("Invalid member name.")
        return value.strip() if value is not None else None


class MembershipActivated(BaseModel):
    user_id: int
    organization_id: int
    status: Literal["activated"] = "activated"
