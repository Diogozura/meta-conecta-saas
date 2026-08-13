"""Tipos compartilhados pelos provedores de IA."""
from typing import TypedDict


class HistoryMessage(TypedDict):
    """
    Uma mensagem do histórico da conversa.

    `role` usa o vocabulário nativo do Gemini ('user'/'model') — mesma
    convenção já usada no sistema legado (`web/src/lib/aiAgentTypes.ts`).
    Cada provedor mapeia pro seu próprio formato de rede internamente.
    """

    role: str  # "user" | "model"
    text: str
