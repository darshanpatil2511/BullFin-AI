"""Monte Carlo simulation for long-horizon portfolio outcomes.

Approach: fit a lognormal to the portfolio's daily LOG returns (mean & stdev),
draw `simulations` sample paths forward, and report the percentile cone.

Why log returns and not simple returns?  A naive simulation that draws simple
returns r_t ~ N(μ, σ) and compounds paths as cumprod(1 + r) introduces an
upward bias at long horizons — E[cumprod(1 + r)] grows faster than exp(μ·t)
because of Jensen's inequality / the convexity correction in Itô's lemma.
Using log returns (with S_t = S_0 · exp(Σ log_r)) avoids that bias entirely
and is the GBM / Black-Scholes convention used by industry retirement tools.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from app.exceptions import InsufficientDataError
from app.models import HoldingInput, MonteCarloResponse
from app.services.prices import fetch_close_prices

TRADING_DAYS = 252


def run_monte_carlo(
    holdings: list[HoldingInput],
    *,
    years: float,
    simulations: int,
    annual_contribution: float,
) -> MonteCarloResponse:
    symbols = sorted({h.symbol for h in holdings})
    earliest = min(h.purchase_date for h in holdings)
    # Need at least a year of history to fit the return distribution.
    start = min(earliest, date.today() - timedelta(days=365 * 3))
    prices = fetch_close_prices(symbols, start)

    # Build weights from current value
    latest = prices.iloc[-1]
    values = {h.symbol: float(latest[h.symbol]) * h.shares for h in holdings if h.symbol in latest.index}
    total_value = sum(values.values())
    if total_value == 0:
        raise InsufficientDataError("Portfolio has no current value — cannot simulate.")
    weights = np.array([values.get(sym, 0.0) / total_value for sym in prices.columns])

    # Portfolio simple returns (weighted sum is only well-defined in arithmetic
    # space — a weighted sum of asset LOG returns is NOT the portfolio log
    # return). We then convert those portfolio simple returns to log space for
    # the simulation itself, so the draw distribution matches the correct
    # geometric-compounding statistics.
    daily_returns = prices.pct_change().dropna()
    portfolio_daily_simple = (daily_returns * weights).sum(axis=1)
    if len(portfolio_daily_simple) < 60:
        raise InsufficientDataError(
            "Need at least ~60 trading days of history to simulate forward."
        )

    # log(1 + r) — defined whenever the simple return is strictly > -1, which
    # a diversified portfolio's daily return effectively always is. We guard
    # with a tiny floor just so log() never blows up on a degenerate row.
    portfolio_daily_log = np.log(np.clip(1.0 + portfolio_daily_simple.to_numpy(), 1e-9, None))
    mu_log = float(portfolio_daily_log.mean())
    sigma_log = float(portfolio_daily_log.std(ddof=1))

    # Round to a whole number of trading days so numpy shapes are clean.
    # Minimum of 5 guards against too-short horizons producing empty arrays.
    days = max(5, int(round(years * TRADING_DAYS)))

    rng = np.random.default_rng(seed=42)
    # Log-return shocks. Because mu_log is the mean of log returns directly,
    # no Itô convexity correction is needed — the drift is already in log
    # space. Paths are then S_0 · exp(cumsum(log_r)).
    log_shocks = rng.normal(loc=mu_log, scale=sigma_log, size=(simulations, days))
    log_cum = np.cumsum(log_shocks, axis=1)
    growth = np.exp(log_cum)  # cumulative growth factor at each day, shape (sims, days)

    initial = total_value
    if annual_contribution > 0:
        # Each daily contribution is added at time t and compounded forward by
        # growth[:, t+1:] for the remainder of the horizon. Instead of a Python
        # loop we compute future-value factors per day and take a running sum
        # across the time axis (axis=1) so every simulation path gets its own
        # correctly-compounded contribution trajectory.
        #
        #   FV at day t of a contribution made on day i (i ≤ t)
        #     = daily_contribution · growth[t] / growth[i−1]     (with growth[−1] := 1)
        #   total_FV[t]
        #     = daily_contribution · growth[t] · Σ_{i≤t} 1 / growth[i−1]
        daily_contribution = annual_contribution / TRADING_DAYS
        growth_prev = np.concatenate(
            [np.ones((simulations, 1)), growth[:, :-1]], axis=1
        )
        inv_growth_prev = 1.0 / growth_prev
        cum_inv = np.cumsum(inv_growth_prev, axis=1)
        contributions_value = daily_contribution * growth * cum_inv
        paths = growth * initial + contributions_value
    else:
        paths = growth * initial

    # Target ~60 sampled points regardless of horizon so the chart stays
    # readable for both a 3-week and a 30-year simulation. Always include
    # day 0 (the starting value) and the final day so the cone looks right.
    target_points = 60
    step = max(1, days // target_points)
    idxs = np.unique(
        np.concatenate([np.arange(0, days, step), [days - 1]])
    ).astype(int)
    sampled = paths[:, idxs]

    p10 = np.percentile(sampled, 10, axis=0).tolist()
    p50 = np.percentile(sampled, 50, axis=0).tolist()
    p90 = np.percentile(sampled, 90, axis=0).tolist()

    final_values = paths[:, -1]
    median_final = float(np.median(final_values))
    prob_above_initial = float(np.mean(final_values > initial))

    return MonteCarloResponse(
        percentiles={"p10": p10, "p50": p50, "p90": p90},
        sampled_days=idxs.tolist(),
        horizon_days=days,
        median_final_value=median_final,
        probability_above_initial=prob_above_initial,
        years=float(years),
    )
