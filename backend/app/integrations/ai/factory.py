"""Despacho pro provedor de IA correto, a partir do valor salvo em `ai[].provider`."""
from typing import Awaitable, Callable

from app.integrations.ai import anthropic_provider, gemini_provider, openai_provider
from app.integrations.ai.base import HistoryMessage
from app.utils.exceptions import UnsupportedProviderError

GenerateReplyFn = Callable[[str, str, str, list[HistoryMessage], str, float], Awaitable[str]]

_PROVIDERS: dict[str, GenerateReplyFn] = {
    "openai": openai_provider.generate_reply,
    "anthropic": anthropic_provider.generate_reply,
    "gemini": gemini_provider.generate_reply,
}


def get_provider(provider_name: str) -> GenerateReplyFn:
    provider = _PROVIDERS.get(provider_name)
    if provider is None:
        raise UnsupportedProviderError(f"Provedor de IA '{provider_name}' não suportado.")
    return provider
