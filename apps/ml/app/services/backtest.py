"""Simple historical backtest: replay a given weight vector through real prices
and compare against a benchmark.

This is intentionally straightforward — no rebalancing, no slippage, no
transaction costs. Good enough to visualize "what would this allocation have
done" without pretending to be an institutional backtester.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from app.exceptions import BadRequestError, InsufficientDataError
from app.models import BacktestResponse
from app.services.prices import fetch_close_prices

TRADING_DAYS = 252


def run_backtest(
    symbols: list[str],
    *,
    weights: list[float] | None,
    start_date: date,
    end_date: date | None,
    benchmark: str,
) -> BacktestResponse:
    if start_date >= (end_date or date.today()):
        raise BadRequestError("start_date must be before end_date.")
    if (date.today() - start_date).days < 60:
        raise BadRequestError("Backtest window is too short. Pick a start date at least 60 days ago.")

    if weights is None:
        weights = [1.0 / len(symbols)] * len(symbols)
    if len(weights) != len(symbols):
        raise BadRequestError("weights and symbols must have the same length.")
    if abs(sum(weights) - 1.0) > 0.01:
        raise BadRequestError("weights must sum to 1.0 (±1%).")

    prices = fetch_close_prices(symbols, start_date, end_date)
    bench = fetch_close_prices([benchmark], start_date, end_date)[benchmark]

    # Align on common dates.
    prices, bench = prices.align(bench, join="inner", axis=0)
    if len(prices) < 2:
        raise InsufficientDataError("Not enough overlapping price history to backtest.")

    daily_returns = prices.pct_change().dropna()
    bench_returns = bench.pct_change().dropna()
    weights_arr = np.asarray(weights, dtype=float)

    portfolio_daily = (daily_returns * weights_arr).sum(axis=1)
    port_cum = (1 + portfolio_daily).cumprod()
    bench_cum = (1 + bench_returns).cumprod().reindex(port_cum.index).ffill()

    years = len(portfolio_daily) / TRADING_DAYS
    total_return = float(port_cum.iloc[-1] - 1)
    bench_total_return = float(bench_cum.iloc[-1] - 1) if not bench_cum.empty else 0.0
    ann_return = (1 + total_return) ** (1 / years) - 1 if years > 0 else 0.0
    ann_vol = float(portfolio_daily.std(ddof=1)) * np.sqrt(TRADING_DAYS)
    sharpe = (ann_return / ann_vol) if ann_vol > 0 else 0.0

    running_max = port_cum.cummax()
    drawdown = port_cum / running_max - 1
    mdd = float(drawdown.min())

    return BacktestResponse(
        portfolio_cumulative=_series_to_points(port_cum),
        benchmark_cumulative=_series_to_points(bench_cum),
        total_return=total_return,
        benchmark_total_return=bench_total_return,
        annualized_return=float(ann_return),
        annualized_volatility=ann_vol,
        sharpe=float(sharpe),
        max_drawdown=mdd,
    )


def _series_to_points(series: pd.Series) -> list[dict[str, float | str]]:
    return [
        {"date": idx.date().isoformat(), "value": float(val)}
        for idx, val in series.items()
    ]
