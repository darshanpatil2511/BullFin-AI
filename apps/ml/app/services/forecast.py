"""Per-stock price forecasts.

Approach:
  - Fetch up to `lookback_years` of adjusted close prices from yfinance.
  - Estimate annualized drift (mu) and volatility (sigma) from log returns.
  - Simulate forward price paths using Geometric Brownian Motion:
        S_t = S_{t-1} * exp((mu - 0.5*sigma^2) * dt + sigma * sqrt(dt) * Z)
  - Report the 10th / 50th / 90th percentile cone.

GBM is the finance-textbook baseline — honest, fast, and produces the
fan-chart visual recruiters recognize. It is intentionally not an LSTM or
Prophet fit: price prediction at multi-year horizons is fundamentally
uncertain, and a confidence cone communicates that better than a single
line chart ever could.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
import yfinance as yf

from app.exceptions import InsufficientDataError, UpstreamError
from app.logger import get_logger
from app.models import (
    ForecastResponse,
    NewsItem,
    PricePoint,
    StockForecast,
)

logger = get_logger(__name__)

TRADING_DAYS = 252
RNG = np.random.default_rng(seed=7)


def compute_forecast(
    symbols: list[str],
    *,
    horizon_days: int,
    lookback_years: int,
    simulations: int,
    include_news: bool,
) -> ForecastResponse:
    symbols = sorted({s.upper() for s in symbols if s})
    if not symbols:
        raise InsufficientDataError("No symbols provided.")

    today = date.today()
    forecasts: list[StockForecast] = []

    for symbol in symbols:
        try:
            forecasts.append(
                _forecast_one(
                    symbol,
                    today=today,
                    horizon_days=horizon_days,
                    lookback_years=lookback_years,
                    simulations=simulations,
                    include_news=include_news,
                ),
            )
        except InsufficientDataError as exc:
            logger.warning(
                "forecast_skipping_symbol",
                symbol=symbol,
                reason=exc.message,
            )
            # Skip this stock rather than failing the whole request — the
            # frontend will just render the remaining cards.
            continue
        except Exception as exc:  # noqa: BLE001
            logger.error("forecast_error", symbol=symbol, error=str(exc))
            continue

    if not forecasts:
        raise InsufficientDataError(
            "Could not build a forecast for any of the requested symbols.",
        )

    return ForecastResponse(
        as_of=today,
        horizon_days=horizon_days,
        lookback_years=lookback_years,
        forecasts=forecasts,
    )


# --------------------------------------------------------------------------- #
# Per-stock forecast
# --------------------------------------------------------------------------- #
def _forecast_one(
    symbol: str,
    *,
    today: date,
    horizon_days: int,
    lookback_years: int,
    simulations: int,
    include_news: bool,
) -> StockForecast:
    ticker = yf.Ticker(symbol)
    start = today - timedelta(days=365 * lookback_years + 30)

    try:
        hist = ticker.history(start=start.isoformat(), auto_adjust=True)
    except Exception as exc:  # noqa: BLE001
        raise UpstreamError(f"Failed to fetch history for {symbol}") from exc

    if hist is None or hist.empty:
        raise InsufficientDataError(f"No history returned for {symbol}.")
    close = hist["Close"].dropna()
    if len(close) < 30:
        raise InsufficientDataError(
            f"{symbol} has only {len(close)} trading days — need at least 30.",
        )

    current_price = float(close.iloc[-1])

    # --- Fit drift / vol on the lookback window ---
    log_returns = np.log(close / close.shift(1)).dropna()
    mu = float(log_returns.mean()) * TRADING_DAYS  # annualized drift
    sigma = float(log_returns.std(ddof=1)) * np.sqrt(TRADING_DAYS)  # annualized vol

    # --- Summary stats ---
    days_of_data = len(close)
    years = days_of_data / TRADING_DAYS
    total_growth = float(close.iloc[-1] / close.iloc[0])
    cagr = total_growth ** (1 / years) - 1 if years > 0 and total_growth > 0 else 0.0
    sharpe = mu / sigma if sigma > 0 else 0.0
    one_year_change = None
    if len(close) > TRADING_DAYS:
        past = float(close.iloc[-TRADING_DAYS - 1])
        if past > 0:
            one_year_change = (current_price / past) - 1

    # --- GBM simulation ---
    dt = 1.0 / TRADING_DAYS
    drift = (mu - 0.5 * sigma**2) * dt
    diffusion = sigma * np.sqrt(dt)
    shocks = RNG.normal(loc=drift, scale=diffusion, size=(simulations, horizon_days))
    # Cumulative log returns → price paths.
    log_paths = np.cumsum(shocks, axis=1)
    paths = current_price * np.exp(log_paths)

    # Downsample the forecast so we return ~60 points regardless of horizon.
    target_points = 60
    step = max(1, horizon_days // target_points)
    idxs = np.unique(
        np.concatenate([np.arange(0, horizon_days, step), [horizon_days - 1]])
    ).astype(int)
    sampled = paths[:, idxs]

    p10 = np.percentile(sampled, 10, axis=0).tolist()
    p50 = np.percentile(sampled, 50, axis=0).tolist()
    p90 = np.percentile(sampled, 90, axis=0).tolist()

    forecast_dates = [today + timedelta(days=int(i) + 1) for i in idxs]

    final_values = paths[:, -1]
    projected_median = float(np.median(final_values))
    projected_low = float(np.percentile(final_values, 10))
    projected_high = float(np.percentile(final_values, 90))
    prob_above = float(np.mean(final_values > current_price))

    # --- History (downsampled) ---
    hist_step = max(1, len(close) // 200)
    sampled_hist = close.iloc[::hist_step]
    history = [
        PricePoint(date=idx.date(), price=float(val))
        for idx, val in sampled_hist.items()
    ]

    # --- Metadata + news ---
    company_name: str | None = None
    sector: str | None = None
    currency: str | None = None
    news: list[NewsItem] = []
    try:
        info = ticker.info
        if isinstance(info, dict):
            company_name = info.get("longName") or info.get("shortName")
            sector = info.get("sector") or info.get("industry")
            currency = info.get("currency")
    except Exception:  # noqa: BLE001
        pass

    if include_news:
        news = _fetch_news(ticker, symbol)

    return StockForecast(
        symbol=symbol,
        company_name=company_name,
        sector=sector,
        currency=currency,
        current_price=current_price,
        one_year_change_pct=one_year_change,
        cagr=cagr,
        volatility=sigma,
        sharpe=sharpe,
        history=history,
        forecast_dates=forecast_dates,
        forecast_p10=p10,
        forecast_p50=p50,
        forecast_p90=p90,
        projected_median_price=projected_median,
        projected_range_low=projected_low,
        projected_range_high=projected_high,
        probability_above_current=prob_above,
        news=news,
    )


# --------------------------------------------------------------------------- #
# News helper
# --------------------------------------------------------------------------- #
def _fetch_news(ticker: yf.Ticker, symbol: str) -> list[NewsItem]:
    try:
        raw = ticker.news or []
    except Exception as exc:  # noqa: BLE001
        logger.warning("news_fetch_failed", symbol=symbol, error=str(exc))
        return []

    items: list[NewsItem] = []
    for entry in raw[:5]:
        if not isinstance(entry, dict):
            continue
        # yfinance has two shapes in the wild: flat and nested under "content".
        content = entry.get("content") if isinstance(entry.get("content"), dict) else entry
        title = content.get("title") or entry.get("title")
        if not title:
            continue
        link = _extract_news_url(entry, content)
        if not link:
            continue
        publisher = _extract_publisher(entry, content)
        published_at = _extract_published_at(entry, content)
        items.append(
            NewsItem(
                title=str(title).strip(),
                publisher=publisher,
                url=link,
                published_at=published_at,
            ),
        )
    return items


def _extract_news_url(entry: dict, content: dict) -> str | None:
    for candidate in (
        entry.get("link"),
        content.get("canonicalUrl", {}).get("url") if isinstance(content.get("canonicalUrl"), dict) else None,
        content.get("clickThroughUrl", {}).get("url") if isinstance(content.get("clickThroughUrl"), dict) else None,
        content.get("link"),
    ):
        if isinstance(candidate, str) and candidate.startswith(("http://", "https://")):
            return candidate
    return None


def _extract_publisher(entry: dict, content: dict) -> str | None:
    for candidate in (
        entry.get("publisher"),
        content.get("provider", {}).get("displayName") if isinstance(content.get("provider"), dict) else None,
        content.get("publisher"),
    ):
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return None


def _extract_published_at(entry: dict, content: dict) -> str | None:
    timestamp = entry.get("providerPublishTime")
    if isinstance(timestamp, (int, float)) and timestamp > 0:
        return datetime.fromtimestamp(float(timestamp), tz=timezone.utc).isoformat()
    pub_date = content.get("pubDate") or content.get("displayTime")
    if isinstance(pub_date, str) and pub_date:
        return pub_date
    return None
