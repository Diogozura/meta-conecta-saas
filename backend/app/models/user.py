"""
Modelos internos de domínio relacionados a usuário.

Diferente de app/schemas (contrato público da API), este modelo representa
o usuário já resolvido internamente — é o que trafega entre dependencies,
services e repositories depois da autenticação.
"""
from enum import StrEnum

from pydantic import BaseModel


class AccessLevel(StrEnum):
    ADMINISTRADOR = "administrador"
    SUPERVISOR = "supervisor"
    ATENDENTE = "atendente"


class UserStatus(StrEnum):
    ATIVO = "ativo"
    INATIVO = "inativo"


class AuthenticatedUser(BaseModel):
    """
    Representa o usuário já autenticado e resolvido (Firebase Auth + Firestore).

    company_id é o campo mais importante deste modelo: é ele que todo
    endpoint autenticado vai repassar para os services/repositories.
    """

    id: str  # id do documento em users/{id}
    firebase_uid: str
    company_id: str
    name: str
    email: str
    role: str
    access_level: AccessLevel
    sector: str | None = None
    status: UserStatus

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.ATIVO
