"""
Router do pipeline de WhatsApp -> IA -> resposta, pra empresas do CRM novo.

`require_platform_admin` aqui não representa uma ação administrativa de
verdade — é reaproveitado só como o "boundary" de chamada confiável: o
único chamador legítimo desta rota é o próprio webhook do Next.js
(`web/src/app/api/webhook/route.ts`), autenticado com o mesmo par de
segredo já usado pelas rotas de `/api/empresas` (`BACKEND_ADMIN_KEY` <->
`PLATFORM_ADMIN_API_KEY`) — nunca alcançável pela internet pública.
"""
from fastapi import APIRouter, BackgroundTasks, Depends

from app.auth.dependencies import require_platform_admin
from app.database.firestore import get_firestore_client
from app.repositories.company_repository import CompanyRepository
from app.repositories.message_repository import MessageRepository
from app.schemas.message_schema import InboundMessageForward
from app.services.message_orchestrator_service import MessageOrchestratorService
from app.services.message_service import MessageService

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


def _get_orchestrator() -> MessageOrchestratorService:
    db = get_firestore_client()
    return MessageOrchestratorService(CompanyRepository(db), MessageService(MessageRepository(db)))


@router.post(
    "/inbound-message",
    status_code=202,
    dependencies=[Depends(require_platform_admin)],
)
async def receive_inbound_message(
    payload: InboundMessageForward,
    background_tasks: BackgroundTasks,
    orchestrator: MessageOrchestratorService = Depends(_get_orchestrator),
):
    """
    Recebe uma mensagem encaminhada pelo webhook do Next.js, persiste
    rápido e agenda a geração/envio da resposta da IA em segundo plano —
    responde 202 sem esperar a IA nem o envio pra WhatsApp terminarem.
    """
    result = orchestrator.receive_inbound(payload)
    background_tasks.add_task(
        orchestrator.run_ai_reply,
        result["company"]["id"],
        payload.from_number,
        result["history"],
        payload.text,
    )
    return {"status": "accepted"}
