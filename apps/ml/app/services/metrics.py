"""Core portfolio metrics: CAGR, volatility, Sharpe, Sortino, Beta, MDD, VaR, HHI.

Math notes:
  - Daily portfolio value is computed lot-by-lot so staggered purchases are
    handled correctly (a position's value is 0 before its purchase date).
  - All annualizations use 252 trading days.
  - Sharpe and Sortino subtract the 10Y Treasury yield (fetched via yfinance
    or overridden in settings) from the portfolio's annualized return.
  - Beta / alpha come from OLS regression of portfolio excess returns against
    benchmark excess returns (daily frequency).
"""

from __future__ import annotations

from datetime import date
from typing import Literal, cast

import numpy as np
import pandas as pd

from app.exceptions import InsufficientDataError
from app.logger import get_logger
from app.models import (
    BenchmarkComparison,
    HoldingInput,
    MetricsResponse,
    PortfolioMetrics,
    SectorExposure,
    ShareMetric,
)
from app.services.prices import fetch_close_prices, fetch_risk_free_rate, fetch_sector
from app.services.risk_score import compute_risk_score

logger = get_logger(__name__)

TRADING_DAYS = 252
PERIODS_DAYS: dict[str, int] = {
    "1W": 5,
    "1M": 21,
    "3M": 63,
    "6M": 126,
    "1Y": 252,
    "3Y": 756,
    "5Y": 1260,
}


def _build_value_frame(
    prices: pd.DataFrame,
    holdings: list[HoldingInput],
) -> pd.DataFrame:
    """Return a DataFrame with one column per holding giving its daily value.

    A holding's value is 0 on any date strictly before its purchase date, and
    shares * close_price from purchase date onward.
    """
    value = pd.DataFrame(0.0, index=prices.index, columns=[h.symbol for h in holdings])
    for h in holdings:
        if h.symbol not in prices.columns:
            continue
        pd_date = pd.Timestamp(h.purchase_date)
        mask = prices.index >= pd_date
        value.loc[mask, h.symbol] = prices.loc[mask, h.symbol] * h.shares
    return value


def _annualize_return(daily_returns: pd.Series) -> float:
    return float(daily_returns.mean() * TRADING_DAYS)


def _annualize_vol(daily_returns: pd.Series) -> float:
    return float(daily_returns.std(ddof=1) * np.sqrt(TRADING_DAYS))


def _cagr(daily_returns: pd.Series) -> float:
    if len(daily_returns) < 2:
        return 0.0
    total_growth = float((1 + daily_returns).prod())
    years = len(daily_returns) / TRADING_DAYS
    if years <= 0 or total_growth <= 0:
        return 0.0
    return total_growth ** (1 / years) - 1


def _sortino(daily_returns: pd.Series, risk_free_rate: float) -> float:
    """
    Sortino ratio using the canonical Target Downside Deviation (TDD):

        TDD = sqrt( (1/N) * sum_i( min(r_i - MAR, 0)^2 ) )

    Critically, N is the total number of observations (not just the count of
    below-target days), and non-negative deviations contribute zero to the
    sum — not omitted. Using std(ddof=1) on the filtered-negative subset
    (as an earlier version did) artificially shrinks the denominator and
    overstates Sortino, especially on portfolios with few down days.

    See: Sortino & Price (1994); Red Rock Capital, "Sortino: A 'Sharper'
    Ratio"; CFA Institute risk-adjusted performance readings.
    """
    if daily_returns.empty:
        return 0.0
    daily_rf = risk_free_rate / TRADING_DAYS
    shortfall = np.minimum(daily_returns.to_numpy() - daily_rf, 0.0)
    tdd_daily = float(np.sqrt(np.mean(shortfall**2)))
    if tdd_daily == 0.0:
        # No below-target days over the full window — return an absurdly
        # large but finite value the caller can clamp or label as "∞".
        return float("inf")
    tdd_annual = tdd_daily * np.sqrt(TRADING_DAYS)
    annual_ret = _annualize_return(daily_returns)
    return (annual_ret - risk_free_rate) / tdd_annual


def _max_drawdown(daily_returns: pd.Series) -> float:
    cum = (1 + daily_returns).cumprod()
    running_max = cum.cummax()
    drawdown = cum / running_max - 1
    return float(drawdown.min()) if not drawdown.empty else 0.0


def _value_at_risk(daily_returns: pd.Series, confidence: float = 0.95) -> float:
    if daily_returns.empty:
        return 0.0
    return float(np.quantile(daily_returns, 1 - confidence))


def _beta_and_alpha(
    portfolio_returns: pd.Series,
    benchmark_returns: pd.Series,
    risk_free_rate: float,
) -> tuple[float | None, float | None]:
    """OLS regression — returns (beta, alpha). Both None if the math degenerates."""
    aligned = pd.concat([portfolio_returns, benchmark_returns], axis=1, join="inner").dropna()
    if len(aligned) < 20:
        return None, None
    daily_rf = risk_free_rate / TRADING_DAYS
    port_excess = aligned.iloc[:, 0] - daily_rf
    bench_excess = aligned.iloc[:, 1] - daily_rf
    var = float(bench_excess.var(ddof=1))
    if var == 0:
        return None, None
    cov = float(bench_excess.cov(port_excess))
    beta = cov / var
    alpha_daily = float(port_excess.mean() - beta * bench_excess.mean())
    alpha = alpha_daily * TRADING_DAYS
    return float(beta), alpha


def _safe_ratio(num: float, den: float) -> float:
    return num / den if den else 0.0


def _per_share_returns(
    prices: pd.DataFrame,
    holdings: list[HoldingInput],
) -> dict[str, dict[str, float]]:
    latest = prices.iloc[-1]
    out: dict[str, dict[str, float]] = {}
    for h in holdings:
        if h.symbol not in prices.columns:
            out[h.symbol] = {}
            continue
        row: dict[str, float] = {}
        series = prices[h.symbol].dropna()
        latest_price = float(latest[h.symbol])
        for period, days in PERIODS_DAYS.items():
            if len(series) <= days:
                continue
            past = float(series.iloc[-days - 1])
            if past > 0:
                row[period] = (latest_price / past - 1) * 100
        out[h.symbol] = row
    return out


def compute_portfolio_metrics(
    holdings: list[HoldingInput],
    *,
    benchmark: str = "SPY",
    risk_free_rate_override: float | None = None,
) -> MetricsResponse:
    """End-to-end computation of every metric the API returns."""
    symbols = sorted({h.symbol for h in holdings})
    earliest = min(h.purchase_date for h in holdings)

    # Pull a little pre-roll so we can compute returns on day one.
    price_start = earliest - pd.Timedelta(days=14).to_pytimedelta()
    prices = fetch_close_prices(symbols, cast(date, price_start))

    # Benchmark series — a separate download so we get its full range.
    bench_prices = fetch_close_prices([benchmark], cast(date, price_start))[benchmark]

    value_frame = _build_value_frame(prices, holdings)
    port_values = value_frame.sum(axis=1)

    # Trim to dates where the portfolio actually holds something.
    port_values = port_values[port_values > 0]
    if len(port_values) < 5:
        raise InsufficientDataError("Not enough data to compute portfolio returns.")

    port_returns = port_values.pct_change().dropna()
    bench_returns = bench_prices.reindex(port_returns.index).pct_change().dropna()

    rf = (
        risk_free_rate_override
        if risk_free_rate_override is not None
        else fetch_risk_free_rate()
    )

    ann_return = _annualize_return(port_returns)
    vol = _annualize_vol(port_returns)
    cagr = _cagr(port_returns)
    sharpe = _safe_ratio(ann_return - rf, vol)
    sortino = _sortino(port_returns, rf)
    mdd = _max_drawdown(port_returns)
    var95 = _value_at_risk(port_returns)
    beta, alpha = _beta_and_alpha(port_returns, bench_returns, rf)

    # ---- Snapshot (today) ----
    latest_prices = prices.iloc[-1]
    total_value = 0.0
    total_cost = 0.0
    share_rows: list[ShareMetric] = []
    returns_per_symbol = _per_share_returns(prices, holdings)

    # Consolidate same-symbol holdings for weight calc? Keep lot-level — users
    # expect each purchase as its own row. Weight is value / total_value.
    for h in holdings:
        cost = h.shares * h.purchase_price
        total_cost += cost
        latest_price = (
            float(latest_prices[h.symbol]) if h.symbol in latest_prices.index else h.purchase_price
        )
        value = latest_price * h.shares
        total_value += value

    for h in holdings:
        latest_price = (
            float(latest_prices[h.symbol]) if h.symbol in latest_prices.index else h.purchase_price
        )
        value = latest_price * h.shares
        pnl = value - h.shares * h.purchase_price
        pnl_pct = ((latest_price / h.purchase_price) - 1) * 100 if h.purchase_price > 0 else 0.0
        sector = h.sector or fetch_sector(h.symbol)
        share_rows.append(
            ShareMetric(
                symbol=h.symbol,
                shares=h.shares,
                purchase_price=h.purchase_price,
                current_price=latest_price,
                current_value=value,
                unrealized_pnl=pnl,
                unrealized_pnl_pct=pnl_pct,
                sector=sector,
                weight=value / total_value if total_value > 0 else 0.0,
                returns_by_period=returns_per_symbol.get(h.symbol, {}),
            )
        )

    total_return_amount = total_value - total_cost
    total_return_pct = _safe_ratio(total_return_amount, total_cost)

    # ---- Diversification (HHI on weights) ----
    weights = np.array([row.weight for row in share_rows])
    hhi = float((weights**2).sum())
    diversification_index = max(0.0, min(1.0, 1.0 - hhi))

    # ---- Sector exposure ----
    sector_buckets: dict[str, float] = {}
    for row in share_rows:
        key = row.sector or "Unknown"
        sector_buckets[key] = sector_buckets.get(key, 0.0) + row.current_value
    sector_exposure = [
        SectorExposure(
            sector=sector,
            weight=(v / total_value) if total_value > 0 else 0.0,
            value=v,
        )
        for sector, v in sorted(sector_buckets.items(), key=lambda kv: -kv[1])
    ]

    # ---- Benchmark comparison series ----
    port_cum = (1 + port_returns).cumprod()
    bench_cum = (1 + bench_returns).cumprod()
    benchmark_series = BenchmarkComparison(
        symbol=benchmark,
        portfolio_cumulative=_series_to_points(port_cum),
        benchmark_cumulative=_series_to_points(bench_cum),
    )

    portfolio = PortfolioMetrics(
        cagr=cagr,
        volatility=vol,
        sharpe=_finite_or_zero(sharpe),
        sortino=_finite_or_zero(sortino),
        beta=beta,
        alpha=alpha,
        max_drawdown=mdd,
        value_at_risk95=var95,
        diversification_index=diversification_index,
        total_value=total_value,
        total_cost=total_cost,
        total_return=total_return_pct,
        total_return_amount=total_return_amount,
        as_of_date=prices.index[-1].date(),
    )

    risk_score, risk_label = compute_risk_score(portfolio, n_holdings=len(share_rows))

    return MetricsResponse(
        portfolio=portfolio,
        holdings=share_rows,
        sector_exposure=sector_exposure,
        benchmark=benchmark_series,
        risk_score=risk_score,
        risk_label=cast(
            Literal["Conservative", "Moderate", "Balanced", "Aggressive", "Speculative"],
            risk_label,
        ),
    )


def _series_to_points(series: pd.Series) -> list[dict[str, float | str]]:
    return [
        {"date": cast(pd.Timestamp, idx).date().isoformat(), "value": float(val)}
        for idx, val in series.items()
    ]


def _finite_or_zero(x: float) -> float:
    if np.isinf(x) or np.isnan(x):
        return 0.0
    return float(x)
