"""Service de mensagens — persistência pura, sem conhecimento de Meta/IA."""
from app.models.message import MessageDirection
from app.repositories.message_repository import MessageRepository


class MessageService:
    def __init__(self, message_repository: MessageRepository):
        self.message_repository = message_repository

    def save_inbound(
        self,
        company_id: str,
        waba_message_id: str,
        from_number: str,
        text: str,
        timestamp: int,
        contact_name: str | None,
    ) -> dict:
        return self.message_repository.create(
            company_id,
            {
                "from": from_number,
                "to": None,
                "customerPhone": from_number,
                "contactName": contact_name,
                "text": text,
                "timestamp": timestamp,
                "direction": MessageDirection.INBOUND.value,
            },
            doc_id=waba_message_id,
        )

    def save_outbound(
        self,
        company_id: str,
        waba_message_id: str,
        to_number: str,
        text: str,
        timestamp: int,
    ) -> dict:
        return self.message_repository.create(
            company_id,
            {
                "from": None,
                "to": to_number,
                "customerPhone": to_number,
                "contactName": None,
                "text": text,
                "timestamp": timestamp,
                "direction": MessageDirection.OUTBOUND.value,
            },
            doc_id=waba_message_id,
        )

    def list_thread(self, company_id: str, customer_phone: str, limit: int = 20) -> list[dict]:
        return self.message_repository.list_thread(company_id, customer_phone, limit=limit)

    def list_company_messages(self, company_id: str, limit: int = 50, cursor: str | None = None) -> list[dict]:
        return self.message_repository.list_recent(company_id, limit=limit, cursor=cursor)
