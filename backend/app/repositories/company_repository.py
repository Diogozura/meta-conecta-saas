"""
Repositório de empresas.

Diferente dos demais repositórios, este NÃO herda de BaseRepository:
`companies` é a própria unidade de tenant, então não faz sentido filtrar
por company_id aqui. Em compensação, todo acesso a este repositório deve
vir apenas de rotas protegidas por `require_platform_admin` (criação,
listagem, edição administrativa) ou já autenticadas com o `company_id` do
próprio usuário (leitura/atualização da própria empresa, via /companies/me)
— nunca de uma listagem aberta para qualquer tenant.

Notas sobre índices compostos do Firestore relevantes a este módulo:
- Qualquer filtro de igualdade (status, metaConnection.status, ai.enabled,
  plan.name) combinado com `order_by("createdAt")` exige um índice composto
  (`campo ASC/DESC, createdAt DESC`). O Firestore cria automaticamente um
  link para gerar o índice no primeiro erro em produção — não há
  `firestore.indexes.json` neste repositório para configurar isso
  antecipadamente.
- `tags` usa `array_contains`, que não pode ser combinado com outro
  `array_contains` na mesma query — por isso a busca por tag é sempre
  single-valued (um filtro de tag por vez), assim como os demais campos de
  busca (nome/email/cnpj/tag nunca são combinados na mesma consulta).
- Busca por prefixo de nome (`companyName >= termo`) exige que o primeiro
  `order_by` seja `companyName` (regra do Firestore para filtros de
  desigualdade/range) — por isso `search_by_name_prefix` ordena por nome,
  não por `createdAt`, diferente das demais listagens.
"""
# Necessário porque a classe define um método chamado `list`, que sombreia o
# builtin `list` nas anotações de tipo dos métodos declarados depois dele —
# import futuro adia a avaliação das anotações (viram strings, não são
# resolvidas em tempo de definição da classe).
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from google.cloud.firestore import Client as FirestoreClient
from google.cloud.firestore import Query

from app.models.company import CompanyStatus
from app.utils.exceptions import NotFoundError


class CompanyRepository:
    collection_name = "companies"

    def __init__(self, db: FirestoreClient):
        self.db = db

    def _collection(self):
        return self.db.collection(self.collection_name)

    @staticmethod
    def _to_dict(doc) -> dict[str, Any]:
        return {"id": doc.id, **(doc.to_dict() or {})}

    # --- leitura por chave única ------------------------------------------

    def find_by_cnpj(self, cnpj: str) -> dict[str, Any] | None:
        query = self._collection().where("cnpj", "==", cnpj).limit(1)
        results = list(query.stream())
        return self._to_dict(results[0]) if results else None

    def find_by_client_email(self, email: str) -> dict[str, Any] | None:
        """Usado para impedir e-mails de responsável duplicados entre empresas."""
        query = self._collection().where("client.email", "==", email).limit(1)
        results = list(query.stream())
        return self._to_dict(results[0]) if results else None

    def get_by_id(self, company_id: str) -> dict[str, Any] | None:
        snapshot = self._collection().document(company_id).get()
        if not snapshot.exists:
            return None
        return self._to_dict(snapshot)

    def get_by_id_or_raise(self, company_id: str) -> dict[str, Any]:
        result = self.get_by_id(company_id)
        if result is None:
            raise NotFoundError(f"Empresa '{company_id}' não encontrada.")
        return result

    # --- listagem / busca / filtros ----------------------------------------

    def list(
        self,
        limit: int = 50,
        cursor: str | None = None,
        order_by: str = "createdAt",
        direction: str = "DESCENDING",
        extra_filters: list[tuple[str, str, Any]] | None = None,
    ) -> list[dict[str, Any]]:
        """Lista empresas com filtros de igualdade opcionais. Sem escopo de company_id — vide docstring do módulo."""
        query = self._collection()

        for field, op, value in extra_filters or []:
            query = query.where(field, op, value)

        firestore_direction = Query.DESCENDING if direction == "DESCENDING" else Query.ASCENDING
        query = query.order_by(order_by, direction=firestore_direction).limit(limit)

        if cursor:
            cursor_snapshot = self._collection().document(cursor).get()
            if cursor_snapshot.exists:
                query = query.start_after(cursor_snapshot)

        return [self._to_dict(doc) for doc in query.stream()]

    def search_by_name_prefix(self, prefix: str, limit: int = 50) -> list[dict[str, Any]]:
        query = (
            self._collection()
            .order_by("companyName")
            .where("companyName", ">=", prefix)
            .where("companyName", "<=", prefix + "")
            .limit(limit)
        )
        return [self._to_dict(doc) for doc in query.stream()]

    def search_by_client_email(self, email: str, limit: int = 50) -> list[dict[str, Any]]:
        query = self._collection().where("client.email", "==", email).limit(limit)
        return [self._to_dict(doc) for doc in query.stream()]

    def search_by_cnpj(self, cnpj: str, limit: int = 50) -> list[dict[str, Any]]:
        query = self._collection().where("cnpj", "==", cnpj).limit(limit)
        return [self._to_dict(doc) for doc in query.stream()]

    def search_by_tag(self, tag: str, limit: int = 50) -> list[dict[str, Any]]:
        query = self._collection().where("tags", "array_contains", tag).limit(limit)
        return [self._to_dict(doc) for doc in query.stream()]

    # --- escrita -------------------------------------------------------------

    def create(self, data: dict[str, Any], created_by: str) -> dict[str, Any]:
        company_id = str(uuid4())
        now = datetime.now(UTC)
        payload = {
            **data,
            "status": CompanyStatus.ACTIVE.value,
            "createdAt": now,
            "updatedAt": now,
            "createdBy": created_by,
        }
        self._collection().document(company_id).set(payload)
        return {"id": company_id, **payload}

    def rollback_delete(self, company_id: str) -> None:
        """
        Remoção definitiva — uso EXCLUSIVO para desfazer uma criação de
        empresa que falhou no meio do fluxo (ex: erro ao criar o usuário
        Administrador logo em seguida), evitando uma empresa "órfã" sem
        nenhum usuário capaz de gerenciá-la. Nunca chamar isso a partir de
        uma rota da API — a regra "nunca excluir de verdade" continua valendo
        para toda operação alcançável pelo admin de plataforma; ver `update`
        com `status=deleted` para o soft delete real.
        """
        self._collection().document(company_id).delete()

    def update(self, company_id: str, data: dict[str, Any]) -> dict[str, Any]:
        self.get_by_id_or_raise(company_id)
        payload = {**data, "updatedAt": datetime.now(UTC)}
        self._collection().document(company_id).update(payload)
        return self.get_by_id_or_raise(company_id)

    def set_status(self, company_id: str, status: str) -> dict[str, Any]:
        return self.update(company_id, {"status": status})

    # --- números de WhatsApp (array embutido) --------------------------------

    def add_whatsapp_number(self, company_id: str, entry: dict[str, Any]) -> dict[str, Any]:
        company = self.get_by_id_or_raise(company_id)
        numbers = [*company.get("whatsapp", []), entry]
        return self.update(company_id, {"whatsapp": numbers})

    def update_whatsapp_number(self, company_id: str, whatsapp_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        company = self.get_by_id_or_raise(company_id)
        numbers = company.get("whatsapp", [])
        index = next((i for i, n in enumerate(numbers) if n.get("id") == whatsapp_id), None)
        if index is None:
            raise NotFoundError(f"Número de WhatsApp '{whatsapp_id}' não encontrado nesta empresa.")
        numbers[index] = {**numbers[index], **changes}
        return self.update(company_id, {"whatsapp": numbers})

    def remove_whatsapp_number(self, company_id: str, whatsapp_id: str) -> dict[str, Any]:
        company = self.get_by_id_or_raise(company_id)
        numbers = company.get("whatsapp", [])
        remaining = [n for n in numbers if n.get("id") != whatsapp_id]
        if len(remaining) == len(numbers):
            raise NotFoundError(f"Número de WhatsApp '{whatsapp_id}' não encontrado nesta empresa.")
        return self.update(company_id, {"whatsapp": remaining})
