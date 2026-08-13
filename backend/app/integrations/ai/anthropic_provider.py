"""
Integração com a Anthropic (Messages API).

Porta de `web/src/lib/aiProviderAnthropic.ts`, sem o loop de function-calling
— só geração de texto de uma vez, agora com `temperature` (o legado nunca
enviava esse campo).
"""
import httpx

from app.core.logging import get_logger
from app.integrations.ai.base import HistoryMessage
from app.utils.exceptions import AIProviderError

logger = get_logger(__name__)

_URL = "https://api.anthropic.com/v1/messages"
_ANTHROPIC_VERSION = "2023-06-01"


async def generate_reply(
    api_key: str,
    model: str,
    system_prompt: str,
    history: list[HistoryMessage],
    current_message: str,
    temperature: float,
) -> str:
    messages = []
    for item in history:
        role = "assistant" if item["role"] == "model" else "user"
        messages.append({"role": role, "content": item["text"]})
    messages.append({"role": "user", "content": current_message})

    payload = {
        "model": model,
        "max_tokens": 2048,
        "temperature": temperature,
        "system": system_prompt,
        "messages": messages,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            _URL,
            headers={
                "x-api-key": api_key,
                "anthropic-version": _ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
            json=payload,
        )

    if response.is_error:
        detail = response.text
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        logger.error("Falha ao chamar Anthropic: %s", detail)
        raise AIProviderError(detail)

    data = response.json()
    textos = [bloco.get("text", "") for bloco in data.get("content", []) if bloco.get("type") == "text"]
    return "\n".join(textos).strip()
