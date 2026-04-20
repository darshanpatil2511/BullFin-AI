"""Pydantic schemas shared between the API gateway and the ML engine.

Field names mirror packages/shared/src/metrics.ts so serialization is
symmetrical; if you change one, change the other.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ============================================================
# Requests
# ============================================================

_CamelCaseConfig = ConfigDict(populate_by_name=True, extra="ignore")


def _snake_to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(w.capitalize() for w in tail)


class HoldingInput(BaseModel):
    """One lot in a user's portfolio."""

    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    symbol: str = Field(min_length=1, max_length=12)
    shares: float = Field(gt=0)
    purchase_price: float = Field(ge=0)
    purchase_date: date
    sector: str | None = None
    notes: str | None = None


class MetricsRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    holdings: list[HoldingInput] = Field(min_length=1, max_length=500)
    benchmark: str = "SPY"
    risk_free_rate: float | None = None


class EfficientFrontierRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    symbols: list[str] = Field(min_length=2, max_length=30)
    points: int = Field(default=30, ge=5, le=100)
    risk_free_rate: float | None = None
    # How many years of historical prices to use when estimating the
    # frontier. Shorter = more reactive, longer = smoother.
    lookback_years: int = Field(default=3, ge=1, le=15)


class MonteCarloRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    holdings: list[HoldingInput] = Field(min_length=1, max_length=100)
    # Fractional years allowed so the caller can simulate horizons measured
    # in weeks or months (the UI exposes a unit selector). 0.05 years ≈ 13 days,
    # enough for a shortest-meaningful simulation.
    years: float = Field(default=10.0, ge=0.05, le=50.0)
    simulations: int = Field(default=5000, ge=100, le=20000)
    annual_contribution: float = Field(default=0.0, ge=0.0)


class ForecastRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    symbols: list[str] = Field(min_length=1, max_length=25)
    # Forward-looking window. 5 = 1 week, 252 = 1 year, 1260 = 5 years.
    horizon_days: int = Field(default=252, ge=5, le=1260)
    # How many years of history to fit the drift/volatility on. Capped at
    # whatever yfinance actually returns.
    lookback_years: int = Field(default=5, ge=1, le=15)
    # Fewer simulations per stock so a 12-stock forecast stays snappy.
    simulations: int = Field(default=1000, ge=200, le=5000)
    include_news: bool = True


class BacktestRequest(BaseModel):
    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        extra="ignore",
    )

    symbols: list[str] = Field(min_length=1, max_length=30)
    weights: list[float] | None = None
    start_date: date
    end_date: date | None = None
    benchmark: str = "SPY"


# ============================================================
# Responses
# ============================================================

RiskLabel = Literal["Conservative", "Moderate", "Balanced", "Aggressive", "Speculative"]


class _CamelOut(BaseModel):
    """Responses are serialized in camelCase so the TS client can drop them in."""

    model_config = ConfigDict(
        alias_generator=_snake_to_camel,
        populate_by_name=True,
        extra="ignore",
        json_schema_extra={"description": "camelCase response"},
    )


class PortfolioMetrics(_CamelOut):
    cagr: float
    volatility: float
    sharpe: float
    sortino: float
    beta: float | None
    alpha: float | None
    max_drawdown: float
    value_at_risk95: float
    diversification_index: float
    total_value: float
    total_cost: float
    total_return: float
    total_return_amount: float
    as_of_date: date


class ShareMetric(_CamelOut):
    symbol: str
    shares: float
    purchase_price: float
    current_price: float
    current_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    sector: str | None
    weight: float
    returns_by_period: dict[str, float]


class SectorExposure(_CamelOut):
    sector: str
    weight: float
    value: float


class BenchmarkComparison(_CamelOut):
    symbol: str
    portfolio_cumulative: list[dict[str, float | str]]
    benchmark_cumulative: list[dict[str, float | str]]


class MetricsResponse(_CamelOut):
    portfolio: PortfolioMetrics
    holdings: list[ShareMetric]
    sector_exposure: list[SectorExposure]
    benchmark: BenchmarkComparison | None
    risk_score: int
    risk_label: RiskLabel


class FrontierPoint(_CamelOut):
    expected_return: float
    volatility: float
    sharpe: float
    weights: dict[str, float]


class EfficientFrontierResponse(_CamelOut):
    frontier: list[FrontierPoint]
    max_sharpe: FrontierPoint
    min_volatility: FrontierPoint


class MonteCarloResponse(_CamelOut):
    # percentiles[<key>][i] corresponds to day `sampled_days[i]` from today.
    percentiles: dict[str, list[float]]  # keys "p10", "p50", "p90"
    sampled_days: list[int]  # day index of each sample (0 = today)
    horizon_days: int  # total horizon in trading days (~252 per year)
    median_final_value: float
    probability_above_initial: float
    years: float


class PricePoint(_CamelOut):
    date: date
    price: float


class NewsItem(_CamelOut):
    title: str
    publisher: str | None
    url: str
    published_at: str | None  # ISO timestamp


class StockForecast(_CamelOut):
    symbol: str
    company_name: str | None
    sector: str | None
    currency: str | None
    # Most recent close returned by yfinance.
    current_price: float
    # Year-over-year change computed from yfinance history.
    one_year_change_pct: float | None
    # Summary stats fit on the lookback window.
    cagr: float
    volatility: float
    sharpe: float
    # Downsampled history (~200 points) + forecast cone.
    history: list[PricePoint]
    forecast_dates: list[date]
    forecast_p10: list[float]
    forecast_p50: list[float]
    forecast_p90: list[float]
    # Projected median value at the final horizon day.
    projected_median_price: float
    projected_range_low: float
    projected_range_high: float
    # Probability the median path ends above today's price.
    probability_above_current: float
    news: list[NewsItem]


class ForecastResponse(_CamelOut):
    as_of: date
    horizon_days: int
    lookback_years: int
    forecasts: list[StockForecast]


class BacktestResponse(_CamelOut):
    portfolio_cumulative: list[dict[str, float | str]]
    benchmark_cumulative: list[dict[str, float | str]]
    total_return: float
    benchmark_total_return: float
    annualized_return: float
    annualized_volatility: float
    sharpe: float
    max_drawdown: float
