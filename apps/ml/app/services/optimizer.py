"""Modern Portfolio Theory — efficient frontier via PyPortfolioOpt.

We compute the set of portfolios that maximize return for a given level
of volatility, then pick out the max-Sharpe and min-volatility points.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd
from pypfopt import EfficientFrontier, expected_returns, risk_models

from app.exceptions import InsufficientDataError
from app.models import EfficientFrontierResponse, FrontierPoint
from app.services.prices import fetch_close_prices, fetch_risk_free_rate


def compute_efficient_frontier(
    symbols: list[str],
    *,
    points: int = 30,
    risk_free_rate_override: float | None = None,
    lookback_years: int = 3,
) -> EfficientFrontierResponse:
    """Return `points` samples of the frontier plus the max-Sharpe and min-vol portfolios."""
    if len(set(symbols)) < 2:
        raise InsufficientDataError("Efficient frontier needs at least two distinct symbols.")

    start = date.today() - timedelta(days=365 * lookback_years)
    prices = fetch_close_prices(sorted(set(symbols)), start)

    mu = expected_returns.mean_historical_return(prices)
    S = risk_models.CovarianceShrinkage(prices).ledoit_wolf()

    rf = risk_free_rate_override if risk_free_rate_override is not None else fetch_risk_free_rate()

    # Sample the frontier between the min-vol point and max-return point.
    min_vol_point = _min_volatility_point(mu, S)
    max_sharpe_point = _max_sharpe_point(mu, S, rf)

    min_mu = float(mu.min())
    max_mu = float(mu.max())
    # Stay a hair inside the bounds so the solver doesn't choke on the endpoints.
    targets = np.linspace(min_mu * 1.01, max_mu * 0.99, points)

    frontier: list[FrontierPoint] = []
    for target in targets:
        try:
            ef = EfficientFrontier(mu, S)
            ef.efficient_return(target_return=float(target))
            frontier.append(_to_point(ef, rf))
        except Exception:
            continue

    if not frontier:
        raise InsufficientDataError(
            "Could not compute any frontier points — try a longer lookback or fewer symbols."
        )

    return EfficientFrontierResponse(
        frontier=frontier,
        max_sharpe=max_sharpe_point,
        min_volatility=min_vol_point,
    )


def _min_volatility_point(mu: pd.Series, S: pd.DataFrame) -> FrontierPoint:
    ef = EfficientFrontier(mu, S)
    ef.min_volatility()
    return _to_point(ef, risk_free_rate=0.0)


def _max_sharpe_point(mu: pd.Series, S: pd.DataFrame, rf: float) -> FrontierPoint:
    ef = EfficientFrontier(mu, S)
    ef.max_sharpe(risk_free_rate=rf)
    return _to_point(ef, rf)


def _to_point(ef: EfficientFrontier, risk_free_rate: float) -> FrontierPoint:
    ret, vol, sharpe = ef.portfolio_performance(risk_free_rate=risk_free_rate, verbose=False)
    weights = {k: float(v) for k, v in ef.clean_weights().items() if v > 0.0005}
    return FrontierPoint(
        expected_return=float(ret),
        volatility=float(vol),
        sharpe=float(sharpe),
        weights=weights,
    )
