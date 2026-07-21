from typing import Optional

from pydantic import BaseModel

from app.models.foundation import User

class TokenOutput(BaseModel):
    access_token: str
    token_type: str


class CurrentUserOutput(BaseModel):
    id: int
    organization_id: int
    department_id: Optional[int] = None
    full_name: str
    email: str
    job_title: Optional[str] = None
    role_name: str
    department_name: Optional[str] = None