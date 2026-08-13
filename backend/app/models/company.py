"""
Modelos internos de domínio relacionados a empresas (contas de clientes).

Assim como em app/models/user.py, estes enums representam vocabulário interno
do domínio — não o contrato público da API (isso fica em app/schemas).
"""
from enum import StrEnum


class CompanyStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    DELETED = "deleted"  # soft delete — nunca removido do Firestore


class MetaConnectionStatus(StrEnum):
    INACTIVE = "inactive"
    CONNECTED = "connected"


class AIProvider(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


class AIPurpose(StrEnum):
    MENSAGEM = "mensagem"
    IMAGEM = "imagem"
    AUDIO = "audio"
    OUTRO = "outro"
