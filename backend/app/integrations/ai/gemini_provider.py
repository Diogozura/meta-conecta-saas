"""
Integração com o Google Gemini (generateContent API).

Porta de `web/src/lib/aiProviderGemini.ts`, sem o loop de function-calling
— só geração de texto de uma vez, agora com `temperature` (o legado nunca
enviava esse campo).
"""
import httpx

from app.core.logging import get_logger
from app.integrations.ai.base import HistoryMessage
from app.utils.exceptions import AIProviderError

logger = get_logger(__name__)


async def generate_reply(
    api_key: str,
    model: str,
    system_prompt: str,
    history: list[HistoryMessage],
    current_message: str,
    temperature: float,
) -> str:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    contents = [{"role": item["role"], "parts": [{"text": item["text"]}]} for item in history]
    contents.append({"role": "user", "parts": [{"text": current_message}]})

    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"temperature": temperature},
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload)

    if response.is_error:
        detail = response.text
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        logger.error("Falha ao chamar Gemini: %s", detail)
        raise AIProviderError(detail)

    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    partes = candidates[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in partes).strip()
