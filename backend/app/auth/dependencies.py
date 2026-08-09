"""
Dependencies de autenticação e resolução de tenant (empresa).

Este é o ponto central de segurança multi-tenant do sistema: TODO endpoint
que manipula dado de empresa deve depender, direta ou indiretamente, de
get_current_company() — e nunca aceitar company_id vindo do corpo da
requisição ou de query params enviados pelo cliente.

Fluxo:
  Authorization: Bearer <firebase_id_token>
        │
        ▼
  verify_id_token()               → obtém uid do Firebase
        │
        ▼
  UserRepository.find_by_firebase_uid(uid)   → única query sem company_id
        │
        ▼
  AuthenticatedUser (com company_id resolvido)
        │
        ▼
  get_current_company() → retorna apenas o company_id, para uso direto
  require_role([...])   → exige um nível de acesso mínimo
"""
from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.firebase_auth import verify_id_token
from app.core.config import get_settings
from app.database.firestore import get_firestore_client
from app.models.user import AccessLevel, AuthenticatedUser, UserStatus
from app.repositories.user_repository import UserRepository
from app.utils.exceptions import ForbiddenError, UnauthorizedError

_bearer_scheme = HTTPBearer(auto_error=False)


def _get_user_repository() -> UserRepository:
    return UserRepository(get_firestore_client())


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    user_repository: UserRepository = Depends(_get_user_repository),
) -> AuthenticatedUser:
    """
    Dependency principal de autenticação. Usada em toda rota protegida via:

        user: AuthenticatedUser = Depends(get_current_user)
    """
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Cabeçalho Authorization com Bearer token é obrigatório.")

    decoded_token = verify_id_token(credentials.credentials)
    firebase_uid = decoded_token["uid"]

    user_doc = user_repository.find_by_firebase_uid(firebase_uid)
    if user_doc is None:
        raise UnauthorizedError(
            "Usuário autenticado no Firebase, porém sem cadastro em nenhuma empresa."
        )

    user = AuthenticatedUser(
        id=user_doc["id"],
        firebase_uid=firebase_uid,
        company_id=user_doc["companyId"],
        name=user_doc["name"],
        email=user_doc["email"],
        role=user_doc.get("role", ""),
        access_level=AccessLevel(user_doc["accessLevel"]),
        sector=user_doc.get("sector"),
        status=UserStatus(user_doc.get("status", UserStatus.INATIVO)),
    )

    if not user.is_active:
        raise ForbiddenError("Usuário inativo. Contate o administrador da sua empresa.")

    return user


async def get_current_company(
    user: AuthenticatedUser = Depends(get_current_user),
) -> str:
    """
    Atalho para rotas/services que só precisam do company_id, sem o
    restante do perfil do usuário.
    """
    return user.company_id


def require_role(allowed_roles: list[AccessLevel]):
    """
    Factory de dependency para restringir uma rota a determinados níveis
    de acesso. Uso:

        @router.post("/companies")
        async def create_company(
            user: AuthenticatedUser = Depends(require_role([AccessLevel.ADMINISTRADOR])),
        ):
            ...
    """

    async def dependency(
        user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if user.access_level not in allowed_roles:
            raise ForbiddenError(
                f"Ação restrita a: {', '.join(r.value for r in allowed_roles)}."
            )
        return user

    return dependency


async def require_platform_admin(
    x_platform_admin_key: str | None = Header(default=None),
) -> None:
    """
    Protege operações que ainda não têm company_id conhecido (ex: criar
    uma nova empresa). Não confunda com require_role() — este é um nível
    acima do tenant, para uso exclusivo da equipe que opera o SaaS.
    """
    settings = get_settings()
    if not x_platform_admin_key or x_platform_admin_key != settings.PLATFORM_ADMIN_API_KEY:
        raise UnauthorizedError("Chave de administrador de plataforma inválida ou ausente.")
