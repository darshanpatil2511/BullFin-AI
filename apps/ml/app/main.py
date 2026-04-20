"""FastAPI application factory for the BullFin-AI ML engine."""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import AppError
from app.logger import configure_logging, get_logger
from app.routers import advanced, health, metrics
from app.settings import get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    log = get_logger("app.startup")
    log.info("ml_engine_starting", env=get_settings().env, port=get_settings().port)
    yield
    log.info("ml_engine_stopped")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="BullFin-AI ML Engine",
        description=(
            "Quant microservice powering portfolio metrics, efficient frontier, "
            "Monte Carlo, and backtesting for BullFin-AI."
        ),
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # ---- Exception handlers ----
    log = get_logger("app.errors")

    @app.exception_handler(AppError)
    async def _app_error(_req: Request, exc: AppError) -> JSONResponse:
        log.warning("app_error", code=exc.code, status=exc.status_code, msg=exc.message)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "ok": False,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    **({"details": exc.details} if exc.details else {}),
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def _validation(_req: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=400,
            content={
                "ok": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request failed validation.",
                    "details": {"issues": exc.errors()},
                },
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(_req: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "ok": False,
                "error": {"code": "HTTP_ERROR", "message": str(exc.detail)},
            },
        )

    @app.exception_handler(Exception)
    async def _unhandled(_req: Request, exc: Exception) -> JSONResponse:
        log.error("unhandled_exception", error=str(exc), type=type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={
                "ok": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Internal server error"
                    if settings.is_prod
                    else f"{type(exc).__name__}: {exc}",
                },
            },
        )

    # ---- Routers ----
    app.include_router(health.router)
    app.include_router(metrics.router)
    app.include_router(advanced.router)

    return app


app = create_app()
