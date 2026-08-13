"""
Repositório de mensagens de WhatsApp.

Diferente de `CompanyRepository`, herda de `BaseRepository` — mensagens são
uma coleção raiz normal, sempre escopada por `company_id` (ver docstring de
`base_repository.py`).

Nota sobre índice composto do Firestore: `list_thread` combina um filtro de
igualdade extra (`customerPhone`) com `order_by("timestamp")` — assim como
os filtros de `CompanyRepository.list`, isso exige um índice composto no
Firestore. Não há `firestore.indexes.json` neste repositório; o Firestore
gera um link pra criar o índice no primeiro erro em produção.
"""
from __future__ import annotations

from typing import Any

from app.repositories.base_repository import BaseRepository


class MessageRepository(BaseRepository):
    collection_name = "messages"

    def list_thread(self, company_id: str, customer_phone: str, limit: int = 20) -> list[dict[str, Any]]:
        """Histórico de uma conversa (ambas as direções), em ordem cronológica."""
        return self.list(
            company_id,
            limit=limit,
            order_by="timestamp",
            direction="ASCENDING",
            extra_filters=[("customerPhone", "==", customer_phone)],
        )

    def list_recent(self, company_id: str, limit: int = 50, cursor: str | None = None) -> list[dict[str, Any]]:
        return self.list(company_id, limit=limit, cursor=cursor, order_by="timestamp", direction="DESCENDING")
