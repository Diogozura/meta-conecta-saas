"""
Orquestra o pipeline "mensagem recebida -> resposta da IA -> envio de volta"
pra empresas cadastradas no CRM novo (`companies`).

Só cobre `purpose: "mensagem"` (texto), sem chamada de ferramentas — ver
`arquitetura-backend-whatsapp-saas.md` e o plano desta etapa pros cortes de
escopo (sem agenda, sem handoff pra humano, sem imagem/áudio).
"""
import time

from app.core.logging import get_logger
from app.core.security import decrypt_value
from app.integrations.ai.base import HistoryMessage
from app.integrations.ai.factory import get_provider
from app.integrations.meta.client import send_text_message
from app.models.message import MessageDirection
from app.repositories.company_repository import CompanyRepository
from app.schemas.message_schema import InboundMessageForward
from app.services.message_service import MessageService
from app.utils.exceptions import NotFoundError

logger = get_logger(__name__)


class MessageOrchestratorService:
    def __init__(self, company_repository: CompanyRepository, message_service: MessageService):
        self.company_repository = company_repository
        self.message_service = message_service

    def receive_inbound(self, payload: InboundMessageForward) -> dict:
        """
        Parte síncrona, rodada ANTES do 202 pro chamador: acha a empresa,
        busca o histórico da conversa (antes de salvar a mensagem atual —
        pra ela não aparecer duplicada dentro do próprio histórico) e
        persiste a mensagem recebida.
        """
        company = self.company_repository.find_by_waba_id(payload.waba_id)
        if company is None:
            raise NotFoundError(f"Nenhuma empresa encontrada para o WABA '{payload.waba_id}'.")

        history_raw = self.message_service.list_thread(company["id"], payload.from_number)
        history: list[HistoryMessage] = [
            {
                "role": "model" if m.get("direction") == MessageDirection.OUTBOUND.value else "user",
                "text": m.get("text", ""),
            }
            for m in history_raw
        ]

        self.message_service.save_inbound(
            company["id"],
            payload.message_id,
            payload.from_number,
            payload.text,
            payload.timestamp,
            payload.contact_name,
        )

        return {"company": company, "history": history}

    async def run_ai_reply(
        self,
        company_id: str,
        customer_phone: str,
        history: list[HistoryMessage],
        current_message: str,
    ) -> None:
        """
        Job de fundo (FastAPI BackgroundTasks): gera a resposta da IA e
        envia de volta pro cliente. Nunca propaga exceção — só loga —
        porque roda depois da resposta HTTP já ter sido enviada.
        """
        try:
            company = self.company_repository.get_by_id(company_id)
            if company is None:
                logger.warning("Empresa '%s' não encontrada ao processar resposta de IA.", company_id)
                return

            ai_config = next(
                (c for c in company.get("ai", []) if c.get("purpose") == "mensagem" and c.get("enabled")),
                None,
            )
            if ai_config is None:
                logger.info("Empresa '%s' sem config de IA habilitada para 'mensagem' — ignorando.", company_id)
                return

            meta = company.get("metaConnection", {})
            if meta.get("status") != "connected" or not meta.get("accessToken"):
                logger.warning("Empresa '%s' com IA habilitada mas Meta não conectada — ignorando.", company_id)
                return

            api_key = decrypt_value(ai_config["apiKey"])
            access_token = decrypt_value(meta["accessToken"])

            generate_reply = get_provider(ai_config["provider"])
            reply_text = await generate_reply(
                api_key,
                ai_config.get("model", ""),
                ai_config.get("prompt") or "",
                history,
                current_message,
                ai_config.get("temperature", 0.7),
            )

            if not reply_text:
                logger.info("IA da empresa '%s' não gerou texto de resposta — nada enviado.", company_id)
                return

            message_id = await send_text_message(meta["phoneNumberId"], access_token, customer_phone, reply_text)
            if message_id:
                self.message_service.save_outbound(company_id, message_id, customer_phone, reply_text, int(time.time()))
        except Exception:
            logger.exception("Erro ao processar resposta de IA para empresa '%s'.", company_id)
