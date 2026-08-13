"""
Integração com a OpenAI (Chat Completions API).

Porta de `web/src/lib/aiProviderOpenAI.ts`, sem o loop de function-calling
(ferramentas de agenda) — só geração de texto de uma vez. Diferente do
legado, aqui `temperature` é enviado (a config de IA já tem esse campo,
então vale usá-lo).
"""
import httpx

from app.core.logging import get_logger
from app.integrations.ai.base import HistoryMessage
from app.utils.exceptions import AIProviderError

logger = get_logger(__name__)

_URL = "https://api.openai.com/v1/chat/completions"


async def generate_reply(
    api_key: str,
    model: str,
    system_prompt: str,
    history: list[HistoryMessage],
    current_message: str,
    temperature: float,
) -> str:
    messages = [{"role": "system", "content": system_prompt}]
    for item in history:
        role = "assistant" if item["role"] == "model" else "user"
        messages.append({"role": role, "content": item["text"]})
    messages.append({"role": "user", "content": current_message})

    payload = {"model": model, "temperature": temperature, "messages": messages}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            _URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload,
        )

    if response.is_error:
        detail = response.text
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        logger.error("Falha ao chamar OpenAI: %s", detail)
        raise AIProviderError(detail)

    data = response.json()
    return (data["choices"][0]["message"].get("content") or "").strip()
