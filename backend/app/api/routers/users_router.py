"""
Router de usuários.

Todas as rotas usam get_current_company / require_role — o company_id
NUNCA vem do corpo da requisição ou de query params.
"""
from fastapi import APIRouter, Depends, Query

from app.auth.dependencies import get_current_company, get_current_user, require_role
from app.database.firestore import get_firestore_client
from app.models.user import AccessLevel, AuthenticatedUser
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import (
    UserCreate,
    UserCreateResponse,
    UserResponse,
    UserStatusUpdate,
    UserUpdate,
)
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


def _get_service() -> UserService:
    return UserService(UserRepository(get_firestore_client()))


@router.post(
    "",
    response_model=UserCreateResponse,
    status_code=201,
    dependencies=[],
)
async def create_user(
    payload: UserCreate,
    user: AuthenticatedUser = Depends(require_role([AccessLevel.ADMINISTRADOR, AccessLevel.SUPERVISOR])),
    service: UserService = Depends(_get_service),
):
    """Convida um novo usuário para a empresa do administrador/supervisor autenticado."""
    created, invite_link = service.create_user(user.company_id, payload)
    return UserCreateResponse(user=UserResponse(**_to_response_dict(created)), invite_link=invite_link)


@router.get("", response_model=list[UserResponse])
async def list_users(
    limit: int = Query(default=50, le=200),
    cursor: str | None = Query(default=None),
    company_id: str = Depends(get_current_company),
    service: UserService = Depends(_get_service),
):
    users = service.list_users(company_id, limit=limit, cursor=cursor)
    return [UserResponse(**_to_response_dict(u)) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    company_id: str = Depends(get_current_company),
    service: UserService = Depends(_get_service),
):
    found = service.get_user(company_id, user_id)
    return UserResponse(**_to_response_dict(found))


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    user: AuthenticatedUser = Depends(require_role([AccessLevel.ADMINISTRADOR, AccessLevel.SUPERVISOR])),
    service: UserService = Depends(_get_service),
):
    updated = service.update_user(user.company_id, user_id, payload, acting_user_id=user.id)
    return UserResponse(**_to_response_dict(updated))


@router.patch("/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    user: AuthenticatedUser = Depends(require_role([AccessLevel.ADMINISTRADOR])),
    service: UserService = Depends(_get_service),
):
    updated = service.update_status(user.company_id, user_id, payload, acting_user_id=user.id)
    return UserResponse(**_to_response_dict(updated))


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    user: AuthenticatedUser = Depends(require_role([AccessLevel.ADMINISTRADOR])),
    service: UserService = Depends(_get_service),
):
    service.delete_user(user.company_id, user_id, acting_user_id=user.id)


def _to_response_dict(user: dict) -> dict:
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
