"""
Router de empresas (contas de clientes).

- A maior parte das rotas é o CRM administrativo do SaaS: protegidas por
  `require_platform_admin`, usadas para cadastrar/gerenciar todas as
  empresas-cliente. `company_id` vem sempre do path, nunca de um filtro
  aberto sem autenticação.
- `/companies/me*` é auto-atendimento do próprio tenant (usuário
  autenticado via Firebase, resolvido por `get_current_company`) — mantido
  antes de `/companies/{company_id}` na ordem de declaração para não ser
  capturado como path param.
"""
from typing import Literal

from fastapi import APIRouter, Depends, Header, Query

from app.auth.dependencies import get_current_company, require_platform_admin, require_role
from app.database.firestore import get_firestore_client
from app.models.company import CompanyStatus, MetaConnectionStatus
from app.models.user import AccessLevel
from app.repositories.company_repository import CompanyRepository
from app.repositories.user_repository import UserRepository
from app.schemas.company_schema import (
    AIConfigUpdate,
    CompanyCreate,
    CompanyCreateResponse,
    CompanyListItem,
    CompanyListResponse,
    CompanyResponse,
    CompanyUpdate,
    MetaConnectionConnect,
    PlanUpdate,
    TenantCompanyStatusUpdate,
    WhatsAppNumberCreate,
    WhatsAppNumberUpdate,
)
from app.schemas.user_schema import (
    UserCreate,
    UserCreateResponse,
    UserResponse,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.company_service import CompanyService
from app.services.user_service import UserService

router = APIRouter(prefix="/companies", tags=["companies"])


def _get_service() -> CompanyService:
    db = get_firestore_client()
    return CompanyService(CompanyRepository(db), UserRepository(db))


def _get_user_service() -> UserService:
    return UserService(UserRepository(get_firestore_client()))


# --- criação ---------------------------------------------------------------


@router.post(
    "",
    response_model=CompanyCreateResponse,
    dependencies=[Depends(require_platform_admin)],
    status_code=201,
)
async def create_company(
    payload: CompanyCreate,
    x_platform_admin_name: str | None = Header(default=None),
    service: CompanyService = Depends(_get_service),
):
    """Cria uma nova empresa e seu primeiro usuário Administrador (o responsável/client)."""
    company, invite_link = service.create_company_with_admin(payload, created_by=x_platform_admin_name or "admin")
    return CompanyCreateResponse(company=CompanyResponse(**_to_response_dict(company)), admin_invite_link=invite_link)


# --- auto-atendimento do tenant ---------------------------------------------


@router.get("/me", response_model=CompanyResponse)
async def get_my_company(
    company_id: str = Depends(get_current_company),
    service: CompanyService = Depends(_get_service),
):
    """Retorna os dados da empresa do usuário autenticado."""
    company = service.get_company(company_id)
    return CompanyResponse(**_to_response_dict(company))


@router.put("/me", response_model=CompanyResponse)
async def update_my_company(
    payload: CompanyUpdate,
    user=Depends(require_role([AccessLevel.ADMINISTRADOR])),
    service: CompanyService = Depends(_get_service),
):
    company = service.update_company(user.company_id, payload)
    return CompanyResponse(**_to_response_dict(company))


@router.patch("/me/status", response_model=CompanyResponse)
async def update_my_company_status(
    payload: TenantCompanyStatusUpdate,
    user=Depends(require_role([AccessLevel.ADMINISTRADOR])),
    service: CompanyService = Depends(_get_service),
):
    """O tenant só pode se ativar/desativar — soft delete/restore são exclusivos do admin de plataforma."""
    if payload.status == CompanyStatus.ACTIVE:
        company = service.activate(user.company_id)
    else:
        company = service.deactivate(user.company_id)
    return CompanyResponse(**_to_response_dict(company))


# --- CRM administrativo -------------------------------------------------------


@router.get("", response_model=CompanyListResponse, dependencies=[Depends(require_platform_admin)])
async def list_companies(
    limit: int = Query(default=50, le=200),
    cursor: str | None = Query(default=None),
    status: CompanyStatus | None = Query(default=None),
    meta_status: MetaConnectionStatus | None = Query(default=None),
    ai_enabled: bool | None = Query(default=None),
    plan_name: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Termo de busca."),
    search_by: Literal["name", "email", "cnpj", "tag"] | None = Query(
        default=None, description="Campo de busca usado junto de `q` (padrão: name)."
    ),
    service: CompanyService = Depends(_get_service),
):
    companies = service.list_companies(
        limit=limit,
        cursor=cursor,
        status=status.value if status else None,
        meta_status=meta_status.value if meta_status else None,
        ai_enabled=ai_enabled,
        plan_name=plan_name,
        q=q,
        search_by=search_by,
    )
    items = [CompanyListItem(**_to_list_item(c)) for c in companies]
    next_cursor = companies[-1]["id"] if len(companies) == limit else None
    return CompanyListResponse(items=items, next_cursor=next_cursor)


@router.get("/{company_id}", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def get_company(company_id: str, service: CompanyService = Depends(_get_service)):
    company = service.get_company(company_id)
    return CompanyResponse(**_to_response_dict(company))


@router.put("/{company_id}", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def update_company(company_id: str, payload: CompanyUpdate, service: CompanyService = Depends(_get_service)):
    company = service.update_company(company_id, payload)
    return CompanyResponse(**_to_response_dict(company))


@router.patch("/{company_id}/activate", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def activate_company(company_id: str, service: CompanyService = Depends(_get_service)):
    company = service.activate(company_id)
    return CompanyResponse(**_to_response_dict(company))


@router.patch("/{company_id}/deactivate", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def deactivate_company(company_id: str, service: CompanyService = Depends(_get_service)):
    company = service.deactivate(company_id)
    return CompanyResponse(**_to_response_dict(company))


@router.delete("/{company_id}", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def delete_company(company_id: str, service: CompanyService = Depends(_get_service)):
    """Soft delete — status vira 'deleted'. Nunca remove o documento do Firestore."""
    company = service.soft_delete(company_id)
    return CompanyResponse(**_to_response_dict(company))


@router.patch("/{company_id}/restore", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def restore_company(company_id: str, service: CompanyService = Depends(_get_service)):
    company = service.restore(company_id)
    return CompanyResponse(**_to_response_dict(company))


# --- WhatsApp -----------------------------------------------------------------


@router.post(
    "/{company_id}/whatsapp", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)], status_code=201
)
async def add_whatsapp_number(
    company_id: str, payload: WhatsAppNumberCreate, service: CompanyService = Depends(_get_service)
):
    company = service.add_whatsapp_number(company_id, payload)
    return CompanyResponse(**_to_response_dict(company))


@router.put(
    "/{company_id}/whatsapp/{whatsapp_id}", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)]
)
async def update_whatsapp_number(
    company_id: str, whatsapp_id: str, payload: WhatsAppNumberUpdate, service: CompanyService = Depends(_get_service)
):
    company = service.update_whatsapp_number(company_id, whatsapp_id, payload)
    return CompanyResponse(**_to_response_dict(company))


@router.delete(
    "/{company_id}/whatsapp/{whatsapp_id}", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)]
)
async def remove_whatsapp_number(company_id: str, whatsapp_id: str, service: CompanyService = Depends(_get_service)):
    company = service.remove_whatsapp_number(company_id, whatsapp_id)
    return CompanyResponse(**_to_response_dict(company))


# --- Meta / WhatsApp Cloud API -----------------------------------------------


@router.post(
    "/{company_id}/meta/connect", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)]
)
async def connect_meta(company_id: str, payload: MetaConnectionConnect, service: CompanyService = Depends(_get_service)):
    company = service.connect_meta(company_id, payload)
    return CompanyResponse(**_to_response_dict(company))


@router.post(
    "/{company_id}/meta/disconnect", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)]
)
async def disconnect_meta(company_id: str, service: CompanyService = Depends(_get_service)):
    company = service.disconnect_meta(company_id)
    return CompanyResponse(**_to_response_dict(company))


# --- IA -------------------------------------------------------------------------


@router.put("/{company_id}/ai", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def update_ai_config(company_id: str, payload: AIConfigUpdate, service: CompanyService = Depends(_get_service)):
    company = service.update_ai_config(company_id, payload)
    return CompanyResponse(**_to_response_dict(company))


# --- Plano ------------------------------------------------------------------------


@router.put("/{company_id}/plan", response_model=CompanyResponse, dependencies=[Depends(require_platform_admin)])
async def update_plan(company_id: str, payload: PlanUpdate, service: CompanyService = Depends(_get_service)):
    company = service.update_plan(company_id, payload)
    return CompanyResponse(**_to_response_dict(company))


# --- Usuários da empresa (visão do admin de plataforma) -----------------------
#
# Diferente de /users (users_router.py), que é auto-atendimento — o próprio
# usuário autenticado só vê/gerencia os usuários da SUA empresa via
# get_current_company — aqui o admin de plataforma pode ver/gerenciar os
# usuários de QUALQUER empresa, com company_id vindo do path. Reaproveita o
# mesmo UserService/UserRepository; a diferença é só de onde o company_id
# vem (path + chave de admin, em vez de token do usuário).


@router.get(
    "/{company_id}/users", response_model=list[UserResponse], dependencies=[Depends(require_platform_admin)]
)
async def list_company_users(
    company_id: str,
    limit: int = Query(default=50, le=200),
    cursor: str | None = Query(default=None),
    service: UserService = Depends(_get_user_service),
):
    users = service.list_users(company_id, limit=limit, cursor=cursor)
    return [UserResponse(**_to_user_response_dict(u)) for u in users]


@router.post(
    "/{company_id}/users",
    response_model=UserCreateResponse,
    status_code=201,
    dependencies=[Depends(require_platform_admin)],
)
async def create_company_user(company_id: str, payload: UserCreate, service: UserService = Depends(_get_user_service)):
    user, invite_link = service.create_user(company_id, payload)
    return UserCreateResponse(user=UserResponse(**_to_user_response_dict(user)), invite_link=invite_link)


@router.put(
    "/{company_id}/users/{user_id}", response_model=UserResponse, dependencies=[Depends(require_platform_admin)]
)
async def update_company_user(
    company_id: str, user_id: str, payload: UserUpdate, service: UserService = Depends(_get_user_service)
):
    updated = service.update_user(company_id, user_id, payload)
    return UserResponse(**_to_user_response_dict(updated))


@router.patch(
    "/{company_id}/users/{user_id}/status",
    response_model=UserResponse,
    dependencies=[Depends(require_platform_admin)],
)
async def update_company_user_status(
    company_id: str, user_id: str, payload: UserStatusUpdate, service: UserService = Depends(_get_user_service)
):
    updated = service.update_status(company_id, user_id, payload)
    return UserResponse(**_to_user_response_dict(updated))


@router.delete(
    "/{company_id}/users/{user_id}", status_code=204, dependencies=[Depends(require_platform_admin)]
)
async def delete_company_user(company_id: str, user_id: str, service: UserService = Depends(_get_user_service)):
    service.delete_user(company_id, user_id)


# --- tradução Firestore (camelCase) -> schema (snake_case) --------------------


def _to_response_dict(company: dict) -> dict:
    meta = company.get("metaConnection", {})
    ai = company.get("ai", {})
    plan = company.get("plan", {})
    usage = company.get("usage", {})
    return {
        "id": company["id"],
        "company_name": company["companyName"],
        "cnpj": company["cnpj"],
        "client": company["client"],
        "sector": company["sector"],
        "whatsapp": company.get("whatsapp", []),
        "meta_connection": {
            # Nunca lê "accessToken" aqui — defesa em profundidade além do
            # schema de resposta já não ter esse campo.
            "status": meta.get("status", MetaConnectionStatus.INACTIVE.value),
            "phone_number_id": meta.get("phoneNumberId", ""),
            "business_account_id": meta.get("businessAccountId", ""),
            "last_sync": meta.get("lastSync"),
        },
        "tags": company.get("tags", []),
        "ai": {
            "enabled": ai.get("enabled", False),
            "assistant_id": ai.get("assistantId"),
            "model": ai.get("model"),
            "prompt": ai.get("prompt"),
            "temperature": ai.get("temperature", 0.7),
        },
        "plan": {
            "name": plan.get("name"),
            "expires_at": plan.get("expiresAt"),
            "messages_limit": plan.get("messagesLimit"),
        },
        "usage": {
            "messages_this_month": usage.get("messagesThisMonth", 0),
            "tokens_this_month": usage.get("tokensThisMonth", 0),
            "last_message_at": usage.get("lastMessageAt"),
        },
        "status": company["status"],
        "created_at": company["createdAt"],
        "updated_at": company["updatedAt"],
        "created_by": company.get("createdBy", "admin"),
    }


def _to_list_item(company: dict) -> dict:
    client = company.get("client", {})
    plan = company.get("plan", {})
    ai = company.get("ai", {})
    meta = company.get("metaConnection", {})
    return {
        "id": company["id"],
        "company_name": company["companyName"],
        "client_name": client.get("name", ""),
        "client_email": client.get("email", ""),
        "sector": company["sector"],
        "plan_name": plan.get("name", ""),
        "whatsapp_count": len(company.get("whatsapp", [])),
        "ai_enabled": ai.get("enabled", False),
        "meta_connection_status": meta.get("status", MetaConnectionStatus.INACTIVE.value),
        "status": company["status"],
        "created_at": company["createdAt"],
    }


def _to_user_response_dict(user: dict) -> dict:
    return {
        "id": user["id"],
        "company_id": user["companyId"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "access_level": user["accessLevel"],
        "sector": user.get("sector"),
        "status": user["status"],
        "created_at": user["createdAt"],
    }
