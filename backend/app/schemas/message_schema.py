"""Schemas (DTOs) do módulo de mensagens de WhatsApp — contrato público da API."""
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.message import MessageDirection


class InboundMessageForward(BaseModel):
    """
    Corpo enviado pelo webhook do Next.js (`web/src/app/api/webhook/route.ts`)
    quando uma mensagem chega pra um WABA que não pertence ao sistema legado
    — ver `app.repositories.company_repository.find_by_waba_id`.
    """

    waba_id: str = Field(min_length=1)
    from_number: str = Field(min_length=1, alias="from")
    message_id: str = Field(min_length=1)
    text: str = Field(min_length=1)
    timestamp: int
    contact_name: str | None = None

    model_config = {"populate_by_name": True}


class MessageResponse(BaseModel):
    id: str
    company_id: str
    from_number: str | None = None
    to_number: str | None = None
    customer_phone: str
    contact_name: str | None = None
    text: str
    timestamp: int
    direction: MessageDirection
    created_at: datetime


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    next_cursor: str | None = None
