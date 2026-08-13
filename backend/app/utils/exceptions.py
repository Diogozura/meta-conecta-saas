"""
Exceções customizadas do domínio.

São capturadas centralmente pelos exception handlers em main.py e
convertidas em respostas HTTP consistentes, sem espalhar try/except
de detalhes HTTP pelos services e repositories.
"""


class AppError(Exception):
    """Exceção base de todas as exceções de domínio da aplicação."""

    status_code: int = 500
    default_message: str = "Erro interno inesperado."

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = 404
    default_message = "Recurso não encontrado."


class ForbiddenError(AppError):
    status_code = 403
    default_message = "Você não tem permissão para acessar este recurso."


class UnauthorizedError(AppError):
    status_code = 401
    default_message = "Autenticação necessária ou token inválido."


class ValidationAppError(AppError):
    status_code = 422
    default_message = "Dados inválidos."


class ConflictError(AppError):
    status_code = 409
    default_message = "Conflito: o recurso já existe ou está em um estado inválido."


class MissingCompanyContextError(AppError):
    """
    Levantada sempre que uma operação tentaria ocorrer sem um company_id
    resolvido no contexto da requisição. Isso nunca deveria acontecer em
    rotas autenticadas — é uma rede de segurança contra bugs de isolamento
    multi-tenant.
    """

    status_code = 500
    default_message = "Contexto de empresa (company_id) não resolvido para esta requisição."


class DecryptionError(AppError):
    status_code = 500
    default_message = "Falha ao descriptografar valor sensível."


class UnsupportedProviderError(AppError):
    status_code = 422
    default_message = "Provedor de IA não suportado."


class MetaSendError(AppError):
    """Falha ao chamar a WhatsApp Cloud API (Graph API) pra enviar mensagem."""

    status_code = 502
    default_message = "Falha ao enviar mensagem via WhatsApp Cloud API."


class AIProviderError(AppError):
    """Falha ao chamar a API do provedor de IA (OpenAI/Anthropic/Gemini)."""

    status_code = 502
    default_message = "Falha ao gerar resposta com o provedor de IA."
