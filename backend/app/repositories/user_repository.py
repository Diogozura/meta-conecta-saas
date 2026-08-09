"""
Repositório de usuários.

Contém a ÚNICA query do sistema que busca um documento sem um company_id
já conhecido: find_by_firebase_uid(). Isso é intencional e inevitável —
é exatamente essa consulta que descobre a qual empresa um usuário
autenticado pertence, logo depois da validação do token do Firebase.
Nenhum outro repositório deve replicar esse padrão.
"""
from typing import Any

from app.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository):
    collection_name = "users"

    def find_by_firebase_uid(self, firebase_uid: str) -> dict[str, Any] | None:
        """
        Exceção documentada ao padrão "sempre exigir company_id":
        neste ponto do fluxo o company_id ainda não é conhecido — é
        justamente isso que esta consulta resolve. Usada apenas pela
        camada de auth (app/auth/dependencies.py), nunca por services
        de negócio.
        """
        query = self._collection().where("firebaseUid", "==", firebase_uid).limit(1)
        results = list(query.stream())
        if not results:
            return None
        doc = results[0]
        return {"id": doc.id, **(doc.to_dict() or {})}

    def find_by_email_in_company(self, company_id: str, email: str) -> dict[str, Any] | None:
        """Usado para evitar e-mails duplicados dentro da mesma empresa."""
        query = (
            self._collection()
            .where("companyId", "==", company_id)
            .where("email", "==", email)
            .limit(1)
        )
        results = list(query.stream())
        if not results:
            return None
        doc = results[0]
        return {"id": doc.id, **(doc.to_dict() or {})}
