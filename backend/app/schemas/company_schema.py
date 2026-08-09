"""Schemas (DTOs) do módulo de empresas (contas de clientes) — contrato público da API."""
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.company import CompanyStatus, MetaConnectionStatus
from app.utils.validators import is_valid_cnpj, is_valid_whatsapp_number, normalize_cnpj


class ClientInfo(BaseModel):
    """Responsável pela empresa — também vira o primeiro usuário Administrador."""

    name: str = Field(min_length=1)
    email: EmailStr


# --- WhatsApp -------------------------------------------------------------


class WhatsAppNumberCreate(BaseModel):
    number: str
    label: str
    active: bool = True

    @field_validator("number")
    @classmethod
    def validate_number(cls, value: str) -> str:
        if not is_valid_whatsapp_number(value):
            raise ValueError("Número de WhatsApp inválido. Use o formato E.164 (ex: +5511999999999).")
        return value


class WhatsAppNumberUpdate(BaseModel):
    number: str | None = None
    label: str | None = None
    active: bool | None = None

    @field_validator("number")
    @classmethod
    def validate_number(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_whatsapp_number(value):
            raise ValueError("Número de WhatsApp inválido. Use o formato E.164 (ex: +5511999999999).")
        return value


class WhatsAppNumber(BaseModel):
    id: str
    number: str
    label: str
    active: bool


# --- Meta / WhatsApp Cloud API --------------------------------------------


class MetaConnectionInfo(BaseModel):
    """Vista de resposta — NUNCA inclui o access_token."""

    status: MetaConnectionStatus
    phone_number_id: str = ""
    business_account_id: str = ""
    last_sync: datetime | None = None


class MetaConnectionConnect(BaseModel):
    """Corpo da ação 'Conectar Meta'. access_token só é lido aqui, nunca devolvido."""

    phone_number_id: str
    business_account_id: str
    access_token: str


# --- IA ---------------------------------------------------------------------


class AIConfig(BaseModel):
    enabled: bool = False
    assistant_id: str | None = None
    model: str | None = None
    prompt: str | None = None
    temperature: float = 0.7

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, value: float) -> float:
        if not 0.0 <= value <= 1.0:
            raise ValueError("temperature deve estar entre 0.0 e 1.0.")
        return value


class AIConfigUpdate(BaseModel):
    enabled: bool | None = None
    assistant_id: str | None = None
    model: str | None = None
    prompt: str | None = None
    temperature: float | None = None

    @field_validator("temperature")
    @classmethod
    def validate_temperature(cls, value: float | None) -> float | None:
        if value is not None and not 0.0 <= value <= 1.0:
            raise ValueError("temperature deve estar entre 0.0 e 1.0.")
        return value


# --- Plano / Uso --------------------------------------------------------


class PlanInfo(BaseModel):
    name: str
    expires_at: datetime | None = None
    messages_limit: int | None = None


class PlanUpdate(BaseModel):
    name: str | None = None
    expires_at: datetime | None = None
    messages_limit: int | None = None


class UsageInfo(BaseModel):
    """Somente leitura nesta versão do módulo — sem schema de update."""

    messages_this_month: int = 0
    tokens_this_month: int = 0
    last_message_at: datetime | None = None


# --- Empresa (topo) -------------------------------------------------------


class CompanyCreate(BaseModel):
    company_name: str = Field(min_length=1)
    cnpj: str
    client: ClientInfo
    sector: str = Field(min_length=1)
    whatsapp: list[WhatsAppNumberCreate] = Field(min_length=1)
    tags: list[str] = []
    ai: AIConfig = AIConfig()
    plan: PlanInfo

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj(cls, value: str) -> str:
        if not is_valid_cnpj(value):
            raise ValueError("CNPJ inválido.")
        return normalize_cnpj(value)


class CompanyUpdate(BaseModel):
    company_name: str | None = Field(default=None, min_length=1)
    cnpj: str | None = None
    client: ClientInfo | None = None
    sector: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = None

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj(cls, value: str | None) -> str | None:
        if value is None:
            return value
        if not is_valid_cnpj(value):
            raise ValueError("CNPJ inválido.")
        return normalize_cnpj(value)


class CompanyResponse(BaseModel):
    id: str
    company_name: str
    cnpj: str
    client: ClientInfo
    sector: str
    whatsapp: list[WhatsAppNumber]
    meta_connection: MetaConnectionInfo
    tags: list[str]
    ai: AIConfig
    plan: PlanInfo
    usage: UsageInfo
    status: CompanyStatus
    created_at: datetime
    updated_at: datetime
    created_by: str


class CompanyListItem(BaseModel):
    id: str
    company_name: str
    client_name: str
    client_email: str
    sector: str
    plan_name: str
    whatsapp_count: int
    ai_enabled: bool
    meta_connection_status: MetaConnectionStatus
    status: CompanyStatus
    created_at: datetime


class CompanyListResponse(BaseModel):
    items: list[CompanyListItem]
    next_cursor: str | None = None


class CompanyCreateResponse(BaseModel):
    company: CompanyResponse
    admin_invite_link: str


class TenantCompanyStatusUpdate(BaseModel):
    """
    Auto-atendimento: o próprio tenant só pode se ativar/desativar — soft
    delete e restore continuam restritos ao admin de plataforma.
    """

    status: CompanyStatus

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: CompanyStatus) -> CompanyStatus:
        if value == CompanyStatus.DELETED:
            raise ValueError("Uma empresa não pode se auto-excluir. Contate o suporte.")
        return value
