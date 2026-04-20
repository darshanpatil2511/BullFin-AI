"""Historical price fetching (yfinance) with an in-process TTL cache.

yfinance is slow (seconds per ticker). Intraday EOD prices do not change,
so we memoize downloads by (symbol-tuple, start, end) for 15 minutes. In
production we'd swap this for Redis via settings.redis_url; for now the
in-process cache keeps dev snappy without any extra infra.
"""

from __future__ import annotations

import time
from datetime import date, timedelta
from threading import Lock
from typing import cast

import pandas as pd
import yfinance as yf

from app.exceptions import InsufficientDataError, UpstreamError
from app.logger import get_logger
from app.settings import get_settings

logger = get_logger(__name__)

_CACHE: dict[tuple[tuple[str, ...], str, str], tuple[float, pd.DataFrame]] = {}
_CACHE_TTL_SECONDS = 15 * 60
_CACHE_LOCK = Lock()


def _cache_key(symbols: list[str], start: date, end: date) -> tuple[tuple[str, ...], str, str]:
    return (tuple(sorted(symbols)), start.isoformat(), end.isoformat())


def _is_fresh(entry_time: float) -> bool:
    return (time.time() - entry_time) < _CACHE_TTL_SECONDS


def fetch_close_prices(symbols: list[str], start: date, end: date | None = None) -> pd.DataFrame:
    """Return a DataFrame of adjusted close prices indexed by date, columns are symbols.

    Raises:
        InsufficientDataError: if fewer than 5 trading days of data are returned.
        UpstreamError: on any network/yfinance failure.
    """
    if not symbols:
        raise InsufficientDataError("No symbols provided.")

    end = end or date.today()
    if start >= end:
        raise InsufficientDataError("Start date must be before end date.")

    key = _cache_key(symbols, start, end)
    with _CACHE_LOCK:
        cached = _CACHE.get(key)
        if cached and _is_fresh(cached[0]):
            return cached[1].copy()

    try:
        raw = yf.download(
            tickers=" ".join(symbols),
            start=start,
            end=end + timedelta(days=1),
            progress=False,
            auto_adjust=True,
            threads=True,
        )
    except Exception as exc:  # yfinance surfaces many network errors
        logger.error("yfinance_download_failed", error=str(exc), symbols=symbols)
        raise UpstreamError("Could not reach the market data provider.") from exc

    if raw is None or raw.empty:
        raise InsufficientDataError("No price data returned for requested symbols.")

    # yfinance returns a MultiIndex columns frame when multiple tickers are requested
    # and a single-level frame otherwise. Normalize to columns=symbols.
    if isinstance(raw.columns, pd.MultiIndex):
        if "Close" not in raw.columns.get_level_values(0):
            raise InsufficientDataError("yfinance response missing Close column.")
        close = cast(pd.DataFrame, raw["Close"])
    else:
        close = raw[["Close"]].rename(columns={"Close": symbols[0]})

    # Drop any column that came back fully NaN (invalid ticker).
    close = close.dropna(axis=1, how="all")
    if close.shape[1] == 0:
        raise InsufficientDataError("All provided symbols returned no price data.")

    missing = set(symbols) - set(close.columns)
    if missing:
        logger.warning("prices_missing_symbols", missing=sorted(missing))

    # Forward-fill market holidays or single-day gaps so math stays continuous.
    close = close.ffill().dropna(how="any")

    if len(close) < 5:
        raise InsufficientDataError(
            "Not enough trading days in the requested range.",
            details={"days_returned": len(close)},
        )

    with _CACHE_LOCK:
        _CACHE[key] = (time.time(), close.copy())

    return close


def fetch_risk_free_rate() -> float:
    """Return the current 10Y Treasury yield as an annualized decimal.

    Falls back to 0.04 (4%) if the fetch fails — a reasonable recent average
    that keeps downstream math stable even when the network is down.
    """
    override = get_settings().risk_free_rate
    if override is not None:
        return override
    try:
        # ^TNX reports the 10Y yield as a percent (e.g. 4.21 → 4.21%).
        data = yf.Ticker("^TNX").history(period="5d")
        if data.empty:
            raise RuntimeError("empty TNX")
        return float(data["Close"].iloc[-1]) / 100.0
    except Exception as exc:
        logger.warning("risk_free_rate_fallback", error=str(exc))
        return 0.04


def fetch_sector(symbol: str) -> str | None:
    """Best-effort sector lookup for a single ticker."""
    try:
        info = yf.Ticker(symbol).info
        return info.get("sector") or info.get("industry")
    except Exception:
        return None
