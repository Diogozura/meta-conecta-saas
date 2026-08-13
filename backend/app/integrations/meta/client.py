"""
Cliente da WhatsApp Cloud API (Graph API) — envio de mensagens de texto.

Porta fiel de `web/src/lib/meta.ts` (`sendTextMessage`), usada hoje pelo
sistema legado. Mesma URL, mesmos headers, mesmo corpo — só trocando fetch
por httpx.AsyncClient.
"""
import httpx

from app.core.config import get_settings
from app.core.logging import get_logger
from app.utils.exceptions import MetaSendError

logger = get_logger(__name__)


async def send_text_message(phone_number_id: str, access_token: str, to: str, text: str) -> str:
    """Envia uma mensagem de texto via WhatsApp Cloud API e retorna o ID da mensagem enviada."""
    settings = get_settings()
    url = f"https://graph.facebook.com/{settings.META_GRAPH_API_VERSION}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "text",
        "text": {"body": text, "preview_url": False},
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            url,
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {access_token}"},
            json=payload,
        )

    if response.is_error:
        detail = response.text
        try:
            detail = response.json().get("error", {}).get("message", detail)
        except Exception:
            pass
        logger.error("Falha ao enviar mensagem via WhatsApp Cloud API: %s", detail)
        raise MetaSendError(detail)

    data = response.json()
    message_id = (data.get("messages") or [{}])[0].get("id", "")
    return message_id
