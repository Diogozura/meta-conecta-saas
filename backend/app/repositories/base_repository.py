"""
Repositório base genérico para coleções raiz escopadas por empresa.

REGRA DE OURO deste arquivo: nenhum método aqui permite ler, listar,
atualizar ou apagar um documento sem informar company_id, e todo
documento retornado é conferido contra esse company_id antes de ser
entregue para cima (services). Isso é o que garante, em código, que uma
empresa nunca acesse dado de outra — independente de qualquer outra
camada de segurança (Firestore Rules) que exista por trás.

Se algum dia você sentir vontade de adicionar um `get_by_id_sem_empresa()`
aqui "só para um caso especial"... não faça isso neste arquivo. Casos
especiais de fato (como find_by_uid do UserRepository) devem ficar
isolados e comentados no repositório específico, nunca aqui na base.
"""
from datetime import UTC, datetime
from typing import Any, Generic, TypeVar
from uuid import uuid4

from google.cloud.firestore import Client as FirestoreClient
from google.cloud.firestore import Query

from app.utils.exceptions import NotFoundError

T = TypeVar("T")


class BaseRepository(Generic[T]):
    collection_name: str

    def __init__(self, db: FirestoreClient):
        self.db = db

    def _collection(self):
        return self.db.collection(self.collection_name)

    def _belongs_to_company(self, data: dict[str, Any], company_id: str) -> bool:
        return data.get("companyId") == company_id

    def get_by_id(self, company_id: str, doc_id: str) -> dict[str, Any] | None:
        """Retorna o documento apenas se ele pertencer à empresa informada."""
        snapshot = self._collection().document(doc_id).get()
        if not snapshot.exists:
            return None

        data = snapshot.to_dict() or {}
        if not self._belongs_to_company(data, company_id):
            # Não vaza a existência do documento de outra empresa: trata
            # como "não encontrado", igual a um ID inexistente.
            return None

        return {"id": snapshot.id, **data}

    def get_by_id_or_raise(self, company_id: str, doc_id: str) -> dict[str, Any]:
        result = self.get_by_id(company_id, doc_id)
        if result is None:
            raise NotFoundError(f"Documento '{doc_id}' não encontrado em '{self.collection_name}'.")
        return result

    def list(
        self,
        company_id: str,
        limit: int = 50,
        cursor: str | None = None,
        order_by: str = "createdAt",
        direction: str = "DESCENDING",
        extra_filters: list[tuple[str, str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """
        Lista documentos da empresa, sempre com .where("companyId", "==", ...)
        como primeiro filtro aplicado — nunca opcional.
        """
        query = self._collection().where("companyId", "==", company_id)

        for field, op, value in extra_filters or []:
            query = query.where(field, op, value)

        firestore_direction = Query.DESCENDING if direction == "DESCENDING" else Query.ASCENDING
        query = query.order_by(order_by, direction=firestore_direction).limit(limit)

        if cursor:
            cursor_snapshot = self._collection().document(cursor).get()
            if cursor_snapshot.exists:
                query = query.start_after(cursor_snapshot)

        return [{"id": doc.id, **(doc.to_dict() or {})} for doc in query.stream()]

    def create(self, company_id: str, data: dict[str, Any], doc_id: str | None = None) -> dict[str, Any]:
        # createdAt/updatedAt SEMPRE carimbados aqui, nunca deixados a cargo
        # do chamador: list() faz order_by("createdAt"), e o Firestore
        # exclui silenciosamente da consulta qualquer documento sem esse
        # campo — esquecer de passá-lo não gera erro nenhum, só um
        # documento que nunca aparece em nenhuma listagem.
        doc_id = doc_id or str(uuid4())
        now = datetime.now(UTC)
        payload = {**data, "companyId": company_id, "createdAt": now, "updatedAt": now}
        self._collection().document(doc_id).set(payload)
        return {"id": doc_id, **payload}

    def update(self, company_id: str, doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
        # get_by_id_or_raise já garante que o documento pertence à empresa
        # antes de qualquer escrita ser permitida.
        self.get_by_id_or_raise(company_id, doc_id)
        safe_data = {k: v for k, v in data.items() if k != "companyId"}
        safe_data["updatedAt"] = datetime.now(UTC)
        self._collection().document(doc_id).update(safe_data)
        return self.get_by_id_or_raise(company_id, doc_id)

    def delete(self, company_id: str, doc_id: str) -> None:
        self.get_by_id_or_raise(company_id, doc_id)
        self._collection().document(doc_id).delete()
