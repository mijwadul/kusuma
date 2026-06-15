from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

# System Kusuma Roles: gm (General Manager), finance (Finance Staff), admin (Admin/HR), field (Field Staff)
# Legacy roles (helper, checker) supported for backward compatibility during migration
UserRole = Literal["gm", "finance", "admin", "field", "helper", "checker"]


class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    role: UserRole = "field"
    is_admin: Optional[bool] = False  # True for GM
    is_superuser: Optional[bool] = False  # Superuser flag
    is_active: Optional[bool] = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    employee_id: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    password: Optional[str] = None
    password_change_required: Optional[bool] = None


class User(UserBase):
    id: int
    last_login: Optional[datetime]
    password_change_required: bool = False
    created_at: datetime
    updated_at: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    email: Optional[str] = None
