"""
Configuração central da aplicação.

Todas as variáveis sensíveis vêm de variáveis de ambiente (.env em dev,
Secret Manager / variáveis de ambiente do serviço em produção).
Nunca commitar segredos reais — usar .env.example como referência.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "WhatsApp SaaS Backend"
    ENVIRONMENT: str = "development"  # development | staging | production
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- CORS ---
    # Em produção, restrinja para os domínios reais do frontend.
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # --- Firebase / Firestore ---
    FIREBASE_PROJECT_ID: str
    # Credencial do service account via variáveis de ambiente (Vercel e
    # qualquer ambiente sem filesystem persistente) — mesmos nomes usados
    # em web/.env.example, dá pra copiar os mesmos valores.
    FIREBASE_CLIENT_EMAIL: str | None = None
    FIREBASE_PRIVATE_KEY: str | None = None
    # Alternativa para dev local: caminho para o JSON de credenciais do
    # service account. Se nenhuma credencial acima for informada, cai para
    # Application Default Credentials (só funciona em GCP).
    GOOGLE_APPLICATION_CREDENTIALS: str | None = None
    # O projeto usa um banco Firestore NOMEADO (não o "(default)") — o
    # mesmo banco já usado pelo app web/ (ver web/src/lib/firebase-admin.ts,
    # getFirestore(app, 'zybot-data')). Precisa bater com o nome real do
    # banco no Console do Firebase, não necessariamente com FIREBASE_PROJECT_ID.
    FIRESTORE_DATABASE_ID: str = "zybot-data"

    # --- Segurança / Criptografia ---
    # Chave Fernet (32 bytes url-safe base64) usada para criptografar
    # access_token do WhatsApp e api_key dos agentes de IA.
    ENCRYPTION_KEY: str

    # --- Meta / WhatsApp Cloud API ---
    META_APP_SECRET: str  # usado para validar assinatura X-Hub-Signature-256 do webhook
    META_WEBHOOK_VERIFY_TOKEN: str  # usado na verificação GET do webhook
    META_GRAPH_API_VERSION: str = "v20.0"

    # --- Logging ---
    LOG_LEVEL: str = "INFO"

    # --- Admin de plataforma ---
    # Chave usada para proteger operações que ainda não pertencem a
    # nenhuma empresa (ex: criar uma nova empresa). Enviada no header
    # "X-Platform-Admin-Key". Em produção, substitua por um mecanismo mais
    # robusto (ex: usuários de plataforma com seus próprios papéis) — este
    # é um ponto de partida simples e explícito.
    PLATFORM_ADMIN_API_KEY: str


@lru_cache
def get_settings() -> Settings:
    """
    Settings é carregado uma única vez e reutilizado (cache) durante
    todo o ciclo de vida do processo.
    """
    return Settings()
