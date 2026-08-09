"""
Inicialização única (singleton) do Firebase Admin SDK e do client do
Firestore. Todo o resto do sistema (repositories, auth) importa
get_firestore_client() / get_firebase_app() daqui — nunca inicializa
o SDK em mais de um lugar.
"""
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore import Client as FirestoreClient

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_firebase_app: firebase_admin.App | None = None
_firestore_client: FirestoreClient | None = None


def init_firebase() -> firebase_admin.App:
    """
    Inicializa o Firebase Admin SDK uma única vez.

    - Se GOOGLE_APPLICATION_CREDENTIALS estiver definido no settings, usa
      o arquivo de service account apontado.
    - Caso contrário, usa Application Default Credentials (recomendado em
      produção rodando em Cloud Run / GKE / Compute com service account
      anexado ao ambiente).
    """
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    settings = get_settings()

    if settings.GOOGLE_APPLICATION_CREDENTIALS:
        cred = credentials.Certificate(settings.GOOGLE_APPLICATION_CREDENTIALS)
        _firebase_app = firebase_admin.initialize_app(
            cred, options={"projectId": settings.FIREBASE_PROJECT_ID}
        )
        logger.info("Firebase Admin SDK inicializado com service account JSON.")
    else:
        _firebase_app = firebase_admin.initialize_app(
            options={"projectId": settings.FIREBASE_PROJECT_ID}
        )
        logger.info("Firebase Admin SDK inicializado com Application Default Credentials.")

    return _firebase_app


def get_firestore_client() -> FirestoreClient:
    """Retorna o client do Firestore, inicializando o Firebase se necessário."""
    global _firestore_client

    if _firestore_client is None:
        init_firebase()
        settings = get_settings()
        _firestore_client = firestore.client(database_id=settings.FIRESTORE_DATABASE_ID)
        logger.info("Client do Firestore criado (database_id=%s).", settings.FIRESTORE_DATABASE_ID)

    return _firestore_client
