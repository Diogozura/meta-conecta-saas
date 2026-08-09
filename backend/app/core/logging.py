"""
Configuração de logging estruturado.

Em produção, cada log inclui company_id (quando disponível no contexto da
requisição) para facilitar troubleshooting por tenant sem misturar dados
de empresas diferentes nos logs.
"""
import logging
import sys

from app.core.config import get_settings


def setup_logging() -> None:
    settings = get_settings()

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(settings.LOG_LEVEL)
    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # Bibliotecas de terceiros costumam ser muito verbosas — reduzimos o ruído.
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
