"""
Wrapper fino sobre o Firebase Admin Auth.

Isola o resto do sistema da biblioteca firebase_admin — se um dia for
necessário trocar a estratégia de autenticação, só este arquivo muda.
"""
from firebase_admin import auth as firebase_auth_sdk

from app.core.logging import get_logger
from app.database.firestore import init_firebase
from app.utils.exceptions import UnauthorizedError

logger = get_logger(__name__)


def verify_id_token(id_token: str) -> dict:
    """
    Valida o token enviado pelo frontend no header Authorization.

    Aceita dois formatos, nessa ordem:
    1. Firebase ID Token puro (clientes que falam direto com este backend,
       conforme o desenho original — token renovado pelo Firebase client SDK).
    2. Session cookie do Firebase Admin SDK (usado pelo app web/, que mantém
       sessão via cookie httpOnly no Next.js e nunca expõe o ID Token puro a
       uma API route — o cookie de sessão é reenviado como Bearer token e
       validado aqui como fallback).

    Levanta UnauthorizedError (401) para qualquer token ausente, expirado,
    revogado ou inválido em ambos os formatos — nunca deixa uma exceção
    "crua" do SDK vazar para o restante da aplicação.
    """
    if not id_token:
        raise UnauthorizedError("Token de autenticação não informado.")

    init_firebase()

    try:
        return firebase_auth_sdk.verify_id_token(id_token, check_revoked=True)
    except firebase_auth_sdk.ExpiredIdTokenError as exc:
        raise UnauthorizedError("Token expirado. Faça login novamente.") from exc
    except firebase_auth_sdk.RevokedIdTokenError as exc:
        raise UnauthorizedError("Token revogado. Faça login novamente.") from exc
    except firebase_auth_sdk.InvalidIdTokenError:
        pass  # pode ser um session cookie — tenta o fallback abaixo.
    except Exception as exc:  # defesa final contra qualquer erro inesperado do SDK
        logger.warning("Falha inesperada ao validar ID token: %s", exc)
        raise UnauthorizedError("Não foi possível validar o token de autenticação.") from exc

    try:
        return firebase_auth_sdk.verify_session_cookie(id_token, check_revoked=True)
    except firebase_auth_sdk.ExpiredSessionCookieError as exc:
        raise UnauthorizedError("Sessão expirada. Faça login novamente.") from exc
    except firebase_auth_sdk.RevokedSessionCookieError as exc:
        raise UnauthorizedError("Sessão revogada. Faça login novamente.") from exc
    except firebase_auth_sdk.InvalidSessionCookieError as exc:
        raise UnauthorizedError("Token inválido.") from exc
    except Exception as exc:
        logger.warning("Falha inesperada ao validar session cookie: %s", exc)
        raise UnauthorizedError("Não foi possível validar o token de autenticação.") from exc
