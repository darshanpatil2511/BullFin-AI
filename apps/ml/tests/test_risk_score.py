"""Unit tests for the risk score heuristic."""

from datetime import date

from app.models import PortfolioMetrics
from app.services.risk_score import compute_risk_score


def _metrics(**overrides) -> PortfolioMetrics:
    defaults = dict(
        cagr=0.08,
        volatility=0.15,
        sharpe=1.0,
        sortino=1.2,
        beta=1.0,
        alpha=0.0,
        max_drawdown=-0.15,
        value_at_risk95=-0.02,
        diversification_index=0.7,
        total_value=10_000.0,
        total_cost=9_000.0,
        total_return=0.111,
        total_return_amount=1_000.0,
        as_of_date=date.today(),
    )
    defaults.update(overrides)
    return PortfolioMetrics(**defaults)


def test_low_risk_portfolio_scores_conservative() -> None:
    m = _metrics(
        volatility=0.06,
        max_drawdown=-0.05,
        beta=0.4,
        diversification_index=0.95,
    )
    score, label = compute_risk_score(m, n_holdings=25)
    assert score < 25
    assert label == "Conservative"


def test_high_risk_portfolio_scores_speculative() -> None:
    m = _metrics(
        volatility=0.60,
        max_drawdown=-0.70,
        beta=2.0,
        diversification_index=0.05,
    )
    score, label = compute_risk_score(m, n_holdings=1)
    assert score >= 85
    assert label == "Speculative"


def test_midrange_portfolio_lands_in_balanced_bucket() -> None:
    m = _metrics(
        volatility=0.20,
        max_drawdown=-0.25,
        beta=1.0,
        diversification_index=0.55,
    )
    score, label = compute_risk_score(m, n_holdings=8)
    assert 35 <= score <= 75
    assert label in {"Moderate", "Balanced", "Aggressive"}
