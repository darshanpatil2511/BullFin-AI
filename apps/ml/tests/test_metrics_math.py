"""Unit tests for pure-math helpers in services.metrics.

These tests avoid touching yfinance so they run offline in CI.
"""

from datetime import date

import numpy as np
import pandas as pd

from app.models import HoldingInput
from app.services.metrics import (
    _annualize_return,
    _annualize_vol,
    _beta_and_alpha,
    _build_value_frame,
    _cagr,
    _max_drawdown,
    _sortino,
    _value_at_risk,
)


def _mock_returns(mean: float, std: float, n: int, seed: int = 0) -> pd.Series:
    rng = np.random.default_rng(seed)
    return pd.Series(rng.normal(mean, std, n))


def test_cagr_for_flat_returns_is_zero() -> None:
    flat = pd.Series([0.0] * 252)
    assert _cagr(flat) == 0.0


def test_cagr_positive_for_positive_mean() -> None:
    pos = _mock_returns(mean=0.0005, std=0.01, n=252)
    assert _cagr(pos) > 0.0


def test_annualize_volatility_scales_by_sqrt252() -> None:
    daily = _mock_returns(mean=0.0, std=0.01, n=504)
    assert abs(_annualize_vol(daily) - 0.01 * np.sqrt(252)) < 0.01


def test_annualize_return_scales_by_252() -> None:
    daily = pd.Series([0.001] * 252)
    assert abs(_annualize_return(daily) - 0.252) < 1e-9


def test_max_drawdown_never_positive() -> None:
    r = _mock_returns(mean=-0.001, std=0.02, n=200)
    assert _max_drawdown(r) <= 0


def test_var_is_left_tail_quantile() -> None:
    r = pd.Series(np.linspace(-0.1, 0.1, 100))
    assert _value_at_risk(r, 0.95) < 0


def test_sortino_is_infinite_when_no_downside() -> None:
    r = pd.Series([0.001] * 100)
    assert _sortino(r, risk_free_rate=0.0) == float("inf")


def test_beta_is_one_when_series_match() -> None:
    base = _mock_returns(0.0, 0.01, 252, seed=1)
    beta, alpha = _beta_and_alpha(base.copy(), base.copy(), risk_free_rate=0.0)
    assert beta is not None and abs(beta - 1.0) < 1e-6
    assert alpha is not None and abs(alpha) < 1e-6


def test_value_frame_zero_before_purchase_date() -> None:
    idx = pd.date_range("2024-01-01", "2024-01-10", freq="B")
    prices = pd.DataFrame({"AAPL": np.linspace(100, 110, len(idx))}, index=idx)
    holdings = [
        HoldingInput(
            symbol="AAPL",
            shares=10,
            purchase_price=105,
            purchase_date=date(2024, 1, 5),
        )
    ]
    vf = _build_value_frame(prices, holdings)
    # Nothing owned before 2024-01-05
    assert (vf.loc[: pd.Timestamp("2024-01-04"), "AAPL"] == 0).all()
    assert (vf.loc[pd.Timestamp("2024-01-05") :, "AAPL"] > 0).all()
