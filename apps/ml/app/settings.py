"""Strongly-typed settings loaded from environment at startup."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the BullFin-AI ML engine.

    Each value is validated at import time; a missing or malformed env var
    will crash the process with a readable error rather than cause a mystery
    failure later.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        # Empty env vars (e.g. `RISK_FREE_RATE=`) should fall back to the
        # field's default instead of trying to coerce "" into float/URL types.
        env_ignore_empty=True,
    )

    env: Literal["development", "test", "production"] = "development"
    port: int = 5000
    log_level: Literal["debug", "info", "warning", "error"] = "info"

    # Market data
    default_benchmark: str = "SPY"
    risk_free_rate: float | None = Field(
        default=None,
        description=(
            "Override for the annualized risk-free rate (decimal, e.g. 0.045). "
            "When left unset the engine fetches the 10Y Treasury yield from yfinance."
        ),
    )

    # Caching (optional — falls back to in-process LRU if REDIS_URL is empty)
    redis_url: str | None = None

    # Observability
    sentry_dsn: str | None = None

    @property
    def is_prod(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
