"""
Entrypoint da aplicação.

Responsabilidades deste arquivo, e só delas:
- criar a instância do FastAPI
- registrar middlewares globais (CORS; auth/tenant serão registrados aqui
  também nas próximas etapas)
- registrar exception handlers centralizados
- registrar routers (nas próximas etapas: companies, users, whatsapp,
  conversations, messages, ai_agents, workflows, auth, webhooks)
- expor rota de health check
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.database.firestore import init_firebase
from app.utils.exceptions import AppError

settings = get_settings()
setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: inicializa Firebase Admin / Firestore uma única vez.
    init_firebase()
    logger.info("Aplicação iniciada. Ambiente=%s", settings.ENVIRONMENT)
    yield
    # Shutdown: nada a liberar explicitamente por enquanto.
    logger.info("Aplicação finalizada.")


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    """
    Converte qualquer AppError (e subclasses: NotFoundError, ForbiddenError,
    UnauthorizedError, etc.) em uma resposta HTTP consistente, sem expor
    detalhes internos de implementação.
    """
    logger.warning("AppError: %s | path=%s", exc.message, request.url.path)
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Rede de segurança final — nunca vaza stack trace para o cliente."""
    logger.exception("Erro não tratado | path=%s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Erro interno inesperado."})


@app.get("/health", tags=["infra"])
async def health_check() -> dict:
    return {"status": "ok", "environment": settings.ENVIRONMENT}


# --- Registro de routers -------------------------------------------------
from app.api.routers import auth_router, companies_router, users_router  # noqa: E402

app.include_router(auth_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(companies_router.router, prefix=settings.API_V1_PREFIX)
app.include_router(users_router.router, prefix=settings.API_V1_PREFIX)

# Serão adicionados progressivamente nas próximas etapas do desenvolvimento:
#
# from app.api.routers import whatsapp_router, conversations_router
# app.include_router(whatsapp_router.router, prefix=settings.API_V1_PREFIX)
# ...
