"""Domain errors that FastAPI's exception handler maps to HTTP responses."""

from __future__ import annotations


class AppError(Exception):
    """Base class for domain errors with a stable machine-readable code."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class BadRequestError(AppError):
    status_code = 400
    code = "BAD_REQUEST"


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class UpstreamError(AppError):
    """Used when yfinance or any upstream data provider fails."""

    status_code = 502
    code = "UPSTREAM_ERROR"


class InsufficientDataError(AppError):
    """Thrown when we can't gather enough price history to compute metrics."""

    status_code = 422
    code = "INSUFFICIENT_DATA"
