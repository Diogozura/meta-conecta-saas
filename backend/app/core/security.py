"""
Criptografia simétrica de campos sensíveis (access_token do WhatsApp,
api_key dos agentes de IA) antes de gravar no Firestore.

Usa Fernet (criptografia simétrica autenticada). A chave vem de
settings.ENCRYPTION_KEY (variável de ambiente / Secret Manager).

Em produção, considere usar Cloud KMS / AWS KMS para envelope encryption
em vez de uma chave estática — este módulo pode ser trocado sem afetar
o resto do sistema, pois expõe apenas encrypt()/decrypt().
"""
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.utils.exceptions import DecryptionError


def _get_fernet() -> Fernet:
    settings = get_settings()
    return Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_value(plain_text: str) -> str:
    """Criptografa uma string e retorna o token cifrado (str)."""
    fernet = _get_fernet()
    return fernet.encrypt(plain_text.encode()).decode()


def decrypt_value(cipher_text: str) -> str:
    """Descriptografa um token gerado por encrypt_value()."""
    fernet = _get_fernet()
    try:
        return fernet.decrypt(cipher_text.encode()).decode()
    except InvalidToken as exc:
        raise DecryptionError("Falha ao descriptografar valor: token inválido ou chave incorreta.") from exc


def generate_encryption_key() -> str:
    """
    Utilitário para gerar uma nova chave Fernet (usar uma vez para popular
    ENCRYPTION_KEY no .env). Não é chamado em runtime da aplicação.
    """
    return Fernet.generate_key().decode()
