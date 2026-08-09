"""
Service de usuários (dentro de uma empresa já existente).

Toda operação aqui recebe company_id explicitamente vindo do usuário
autenticado que está fazendo a chamada (nunca do corpo da requisição) —
ver app/api/routers/users_router.py.
"""
from firebase_admin import auth as firebase_auth_sdk

from app.core.logging import get_logger
from app.repositories.user_repository import UserRepository
from app.schemas.user_schema import UserCreate, UserStatusUpdate, UserUpdate
from app.utils.exceptions import ConflictError

logger = get_logger(__name__)


class UserService:
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    def create_user(self, company_id: str, payload: UserCreate) -> tuple[dict, str]:
        if self.user_repository.find_by_email_in_company(company_id, payload.email):
            raise ConflictError("Já existe um usuário com este e-mail nesta empresa.")

        try:
            firebase_user = firebase_auth_sdk.create_user(
                email=payload.email,
                display_name=payload.name,
                email_verified=False,
            )
        except firebase_auth_sdk.EmailAlreadyExistsError as exc:
            # find_by_email_in_company só checa unicidade DENTRO desta empresa —
            # o Firebase Auth exige e-mail único no projeto inteiro, então esse
            # e-mail pode já pertencer a um usuário de outra empresa.
            raise ConflictError(
                "Este e-mail já está em uso no Firebase Auth (pode já pertencer a outra empresa)."
            ) from exc

        user = self.user_repository.create(
            company_id=company_id,
            data={
                "firebaseUid": firebase_user.uid,
                "name": payload.name,
                "email": payload.email,
                "role": payload.role,
                "accessLevel": payload.access_level.value,
                "sector": payload.sector,
                "status": "ativo",
            },
        )

        invite_link = firebase_auth_sdk.generate_password_reset_link(payload.email)

        logger.info("Usuário criado: %s (empresa: %s)", user["id"], company_id)
        return user, invite_link

    def list_users(self, company_id: str, limit: int = 50, cursor: str | None = None) -> list[dict]:
        return self.user_repository.list(company_id, limit=limit, cursor=cursor)

    def get_user(self, company_id: str, user_id: str) -> dict:
        return self.user_repository.get_by_id_or_raise(company_id, user_id)

    def update_user(
        self, company_id: str, user_id: str, payload: UserUpdate, acting_user_id: str | None = None
    ) -> dict:
        # Autoatendimento: ninguém pode alterar o próprio nível de acesso —
        # senão um Supervisor (que já tem permissão pra chamar este endpoint)
        # poderia se autopromover a Administrador. Só o admin de plataforma
        # pode mudar nível de acesso de qualquer usuário, via /companies/{id}/users.
        if acting_user_id is not None and user_id == acting_user_id and payload.access_level is not None:
            raise ConflictError("Você não pode alterar o próprio nível de acesso.")

        data = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
        field_map = {"access_level": "accessLevel"}
        data = {field_map.get(k, k): (v.value if hasattr(v, "value") else v) for k, v in data.items()}
        return self.user_repository.update(company_id, user_id, data)

    def update_status(
        self, company_id: str, user_id: str, payload: UserStatusUpdate, acting_user_id: str | None = None
    ) -> dict:
        # Autoatendimento: ninguém pode se autodesativar (travaria a própria
        # conta fora do sistema, sem ninguém na empresa pra reverter — só o
        # admin de plataforma teria como destravar). Vale só pra este fluxo
        # de autoatendimento; o admin de plataforma pode desativar qualquer
        # usuário de qualquer empresa via /companies/{id}/users.
        if acting_user_id is not None and user_id == acting_user_id and payload.status.value == "inativo":
            raise ConflictError("Você não pode desativar a própria conta.")
        return self.user_repository.update(company_id, user_id, {"status": payload.status.value})

    def delete_user(self, company_id: str, user_id: str, acting_user_id: str | None = None) -> None:
        if acting_user_id is not None and user_id == acting_user_id:
            raise ConflictError("Você não pode remover a própria conta.")
        user = self.user_repository.get_by_id_or_raise(company_id, user_id)
        self.user_repository.delete(company_id, user_id)
        # Também desativa a conta no Firebase Auth, para impedir login
        # mesmo que o token ainda não tenha expirado.
        try:
            firebase_auth_sdk.update_user(user["firebaseUid"], disabled=True)
        except Exception:
            logger.warning("Não foi possível desabilitar o usuário %s no Firebase Auth.", user_id)
