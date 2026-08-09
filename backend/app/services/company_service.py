"""
Service de empresas.

Regra de negócio central: criar uma empresa SEMPRE cria, no mesmo
fluxo, o primeiro usuário Administrador dela (o `client` da empresa) —
nunca deve existir empresa sem nenhum usuário capaz de gerenciá-la.
"""
from datetime import UTC, datetime
from uuid import uuid4

from firebase_admin import auth as firebase_auth_sdk

from app.core.logging import get_logger
from app.core.security import encrypt_value
from app.models.company import CompanyStatus, MetaConnectionStatus
from app.models.user import AccessLevel, UserStatus
from app.repositories.company_repository import CompanyRepository
from app.repositories.user_repository import UserRepository
from app.schemas.company_schema import (
    AIConfigUpdate,
    CompanyCreate,
    CompanyUpdate,
    MetaConnectionConnect,
    PlanUpdate,
    WhatsAppNumberCreate,
    WhatsAppNumberUpdate,
)
from app.utils.exceptions import ConflictError
from app.utils.validators import normalize_cnpj

logger = get_logger(__name__)


class CompanyService:
    def __init__(self, company_repository: CompanyRepository, user_repository: UserRepository):
        self.company_repository = company_repository
        self.user_repository = user_repository

    # --- criação -------------------------------------------------------------

    def create_company_with_admin(self, payload: CompanyCreate, created_by: str) -> tuple[dict, str]:
        if self.company_repository.find_by_cnpj(payload.cnpj):
            raise ConflictError("Já existe uma empresa cadastrada com este CNPJ.")
        if self.company_repository.find_by_client_email(payload.client.email):
            raise ConflictError("Já existe uma empresa cadastrada com este e-mail de responsável.")

        whatsapp_entries = [
            {"id": str(uuid4()), "number": w.number, "label": w.label, "active": w.active}
            for w in payload.whatsapp
        ]

        company = self.company_repository.create(
            {
                "companyName": payload.company_name,
                "cnpj": payload.cnpj,
                "client": {"name": payload.client.name, "email": payload.client.email},
                "sector": payload.sector,
                "whatsapp": whatsapp_entries,
                "metaConnection": {
                    "status": MetaConnectionStatus.INACTIVE.value,
                    "phoneNumberId": "",
                    "businessAccountId": "",
                    "lastSync": None,
                },
                "tags": payload.tags,
                "ai": {
                    "enabled": payload.ai.enabled,
                    "assistantId": payload.ai.assistant_id,
                    "model": payload.ai.model,
                    "prompt": payload.ai.prompt,
                    "temperature": payload.ai.temperature,
                },
                "plan": {
                    "name": payload.plan.name,
                    "expiresAt": payload.plan.expires_at,
                    "messagesLimit": payload.plan.messages_limit,
                },
                "usage": {
                    "messagesThisMonth": 0,
                    "tokensThisMonth": 0,
                    "lastMessageAt": None,
                },
            },
            created_by=created_by,
        )

        # Cria a conta do responsável (client) no Firebase Auth, como primeiro
        # administrador da empresa. Sem senha definida aqui: recebe um link
        # para criar a própria senha (fluxo de convite, não de senha temporária).
        #
        # Tudo daqui pra baixo está num try/except com rollback: se qualquer
        # etapa falhar depois que a empresa já foi gravada no Firestore, a
        # empresa é desfeita — nunca deve sobrar uma empresa sem nenhum
        # usuário capaz de gerenciá-la (ver docstring do módulo).
        try:
            firebase_user = firebase_auth_sdk.create_user(
                email=payload.client.email,
                display_name=payload.client.name,
                email_verified=False,
            )

            self.user_repository.create(
                company_id=company["id"],
                data={
                    "firebaseUid": firebase_user.uid,
                    "name": payload.client.name,
                    "email": payload.client.email,
                    "role": "Administrador",
                    "accessLevel": AccessLevel.ADMINISTRADOR.value,
                    "sector": None,
                    "status": UserStatus.ATIVO.value,
                },
            )

            invite_link = firebase_auth_sdk.generate_password_reset_link(payload.client.email)
        except firebase_auth_sdk.EmailAlreadyExistsError as exc:
            self.company_repository.rollback_delete(company["id"])
            raise ConflictError(
                "Este e-mail já está em uso no Firebase Auth (pode já pertencer a outra empresa)."
            ) from exc
        except Exception:
            self.company_repository.rollback_delete(company["id"])
            raise

        logger.info("Empresa criada: %s (responsável: %s)", company["id"], payload.client.email)
        return company, invite_link

    # --- leitura / listagem ----------------------------------------------------

    def get_company(self, company_id: str) -> dict:
        return self.company_repository.get_by_id_or_raise(company_id)

    def list_companies(
        self,
        limit: int = 50,
        cursor: str | None = None,
        status: str | None = None,
        meta_status: str | None = None,
        ai_enabled: bool | None = None,
        plan_name: str | None = None,
        q: str | None = None,
        search_by: str | None = None,
    ) -> list[dict]:
        """
        Empresas com status "deleted" (soft delete) nunca aparecem numa
        listagem sem filtro explícito de status — não há "filtro de lixeira"
        pedido no spec, então a única forma de vê-las é passar
        `status=deleted` explicitamente (ex: uma tela de auditoria futura).
        """
        if q:
            if search_by == "email":
                results = self.company_repository.search_by_client_email(q, limit=limit)
            elif search_by == "cnpj":
                results = self.company_repository.search_by_cnpj(normalize_cnpj(q), limit=limit)
            elif search_by == "tag":
                results = self.company_repository.search_by_tag(q, limit=limit)
            else:
                results = self.company_repository.search_by_name_prefix(q, limit=limit)

            if status is not None:
                return [c for c in results if c.get("status") == status]
            return [c for c in results if c.get("status") != CompanyStatus.DELETED.value]

        extra_filters: list[tuple[str, str, object]] = []
        if status is not None:
            extra_filters.append(("status", "==", status))
        else:
            extra_filters.append(("status", "!=", CompanyStatus.DELETED.value))
        if meta_status is not None:
            extra_filters.append(("metaConnection.status", "==", meta_status))
        if ai_enabled is not None:
            extra_filters.append(("ai.enabled", "==", ai_enabled))
        if plan_name is not None:
            extra_filters.append(("plan.name", "==", plan_name))

        return self.company_repository.list(limit=limit, cursor=cursor, extra_filters=extra_filters)

    # --- edição de dados gerais --------------------------------------------

    def update_company(self, company_id: str, payload: CompanyUpdate) -> dict:
        # exclude_unset (não exclude_none!): um campo enviado como null deve
        # ser gravado como null (ex: "limpar" um campo opcional) — só campos
        # que o cliente nem sequer enviou devem ficar de fora do update.
        data = payload.model_dump(exclude_unset=True)

        if "cnpj" in data:
            existing = self.company_repository.find_by_cnpj(data["cnpj"])
            if existing and existing["id"] != company_id:
                raise ConflictError("Já existe uma empresa cadastrada com este CNPJ.")

        if "client" in data:
            existing = self.company_repository.find_by_client_email(data["client"]["email"])
            if existing and existing["id"] != company_id:
                raise ConflictError("Já existe uma empresa cadastrada com este e-mail de responsável.")

        field_map = {"company_name": "companyName"}
        firestore_data = {field_map.get(k, k): v for k, v in data.items()}
        return self.company_repository.update(company_id, firestore_data)

    # --- WhatsApp -----------------------------------------------------------

    def add_whatsapp_number(self, company_id: str, payload: WhatsAppNumberCreate) -> dict:
        entry = {"id": str(uuid4()), "number": payload.number, "label": payload.label, "active": payload.active}
        return self.company_repository.add_whatsapp_number(company_id, entry)

    def update_whatsapp_number(self, company_id: str, whatsapp_id: str, payload: WhatsAppNumberUpdate) -> dict:
        changes = payload.model_dump(exclude_none=True)
        return self.company_repository.update_whatsapp_number(company_id, whatsapp_id, changes)

    def remove_whatsapp_number(self, company_id: str, whatsapp_id: str) -> dict:
        company = self.company_repository.get_by_id_or_raise(company_id)
        if len(company.get("whatsapp", [])) <= 1:
            raise ConflictError("A empresa deve manter ao menos um número de WhatsApp.")
        return self.company_repository.remove_whatsapp_number(company_id, whatsapp_id)

    # --- Meta / WhatsApp Cloud API -------------------------------------------

    def connect_meta(self, company_id: str, payload: MetaConnectionConnect) -> dict:
        encrypted_token = encrypt_value(payload.access_token)
        return self.company_repository.update(
            company_id,
            {
                "metaConnection": {
                    "status": MetaConnectionStatus.CONNECTED.value,
                    "phoneNumberId": payload.phone_number_id,
                    "businessAccountId": payload.business_account_id,
                    "accessToken": encrypted_token,
                    "lastSync": datetime.now(UTC),
                }
            },
        )

    def disconnect_meta(self, company_id: str) -> dict:
        return self.company_repository.update(
            company_id,
            {
                "metaConnection": {
                    "status": MetaConnectionStatus.INACTIVE.value,
                    "phoneNumberId": "",
                    "businessAccountId": "",
                    "accessToken": "",
                    "lastSync": None,
                }
            },
        )

    # --- IA -------------------------------------------------------------------

    def update_ai_config(self, company_id: str, payload: AIConfigUpdate) -> dict:
        # exclude_unset: ver comentário em update_company — sem isso, limpar
        # o prompt/modelo/assistant_id (enviando null) era silenciosamente
        # ignorado e o valor antigo continuava salvo.
        changes = payload.model_dump(exclude_unset=True)
        field_map = {"assistant_id": "assistantId"}
        data = {f"ai.{field_map.get(field, field)}": value for field, value in changes.items()}
        return self.company_repository.update(company_id, data)

    # --- Plano ------------------------------------------------------------------

    def update_plan(self, company_id: str, payload: PlanUpdate) -> dict:
        # exclude_unset: ver comentário em update_company — sem isso, limpar
        # a validade/limite de mensagens (enviando null) era silenciosamente
        # ignorado e o valor antigo continuava salvo.
        changes = payload.model_dump(exclude_unset=True)
        field_map = {"expires_at": "expiresAt", "messages_limit": "messagesLimit"}
        data = {f"plan.{field_map.get(field, field)}": value for field, value in changes.items()}
        return self.company_repository.update(company_id, data)

    # --- status / soft delete ----------------------------------------------------

    def activate(self, company_id: str) -> dict:
        return self.company_repository.set_status(company_id, CompanyStatus.ACTIVE.value)

    def deactivate(self, company_id: str) -> dict:
        return self.company_repository.set_status(company_id, CompanyStatus.INACTIVE.value)

    def soft_delete(self, company_id: str) -> dict:
        return self.company_repository.set_status(company_id, CompanyStatus.DELETED.value)

    def restore(self, company_id: str) -> dict:
        return self.company_repository.set_status(company_id, CompanyStatus.ACTIVE.value)
