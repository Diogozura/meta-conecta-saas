"""Modelos internos de domínio relacionados a mensagens de WhatsApp."""
from enum import StrEnum


class MessageDirection(StrEnum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"
