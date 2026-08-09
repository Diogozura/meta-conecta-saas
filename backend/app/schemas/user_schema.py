"""
Schemas (DTOs) do módulo de autenticação e usuários — contrato público da API.
"""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models.user import AccessLevel, UserStatus


class AuthenticatedUserResponse(BaseModel):
    """Retornado por /auth/session e /auth/me."""

    id: str
    company_id: str
    name: str
    email: str
    role: str
    access_level: AccessLevel
    sector: str | None = None
    status: UserStatus

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    role: str = Field(min_length=1)  # cargo livre, ex: "Atendente de Vendas"
    access_level: AccessLevel
    sector: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    role: str | None = Field(default=None, min_length=1)
    access_level: AccessLevel | None = None
    sector: str | None = None


class UserStatusUpdate(BaseModel):
    status: UserStatus


class UserResponse(BaseModel):
    id: str
    company_id: str
    name: str
    email: str
    role: str
    access_level: AccessLevel
    sector: str | None = None
    status: UserStatus
    created_at: datetime


class UserCreateResponse(BaseModel):
    user: UserResponse
    invite_link: str

