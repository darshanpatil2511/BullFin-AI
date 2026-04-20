"""Plain-English risk score (0-100) + label derived from computed metrics.

This is intentionally opinionated. The weights reflect what a reasonable
financial-planning dashboard would emphasize:
  - Volatility                 (35%) — the most direct measure of bumpiness
  - Max drawdown magnitude     (25%) — "how bad can it get in a crash"
  - Beta relative to benchmark (20%) — systematic market exposure
  - Concentration (1 - HHI)    (15%) — fewer eggs, more baskets
  - Number of holdings         ( 5%) — tiny bonus for diversification count

Each sub-score is scaled into 0-100 then combined. 0 = placid, 100 = casino.
"""

from __future__ import annotations

from app.models import PortfolioMetrics

Label = str  # ("Conservative" | "Moderate" | "Balanced" | "Aggressive" | "Speculative")


def _scale(value: float, low: float, high: float) -> float:
    """Linearly scale `value` from [low, high] into [0, 100]."""
    if high <= low:
        return 0.0
    return max(0.0, min(100.0, (value - low) / (high - low) * 100.0))


def _label_for_score(score: int) -> Label:
    if score < 25:
        return "Conservative"
    if score < 45:
        return "Moderate"
    if score < 65:
        return "Balanced"
    if score < 85:
        return "Aggressive"
    return "Speculative"


def compute_risk_score(metrics: PortfolioMetrics, *, n_holdings: int) -> tuple[int, Label]:
    # Volatility — 0.05 (5% ann. vol, ultra-calm) to 0.50 (50%, very wild)
    vol_score = _scale(metrics.volatility, 0.05, 0.50)

    # Max drawdown magnitude — 5% = mild, 60% = crisis
    mdd_score = _scale(abs(metrics.max_drawdown), 0.05, 0.60)

    # Beta — 0.3 (defensive) to 1.8 (leveraged). Beta<0 clamps to 0.
    beta_value = metrics.beta if metrics.beta is not None else 1.0
    beta_score = _scale(beta_value, 0.3, 1.8)

    # Concentration — use 1 - diversification_index (HHI). 0 = balanced, 1 = single stock.
    concentration = 1.0 - metrics.diversification_index
    conc_score = _scale(concentration, 0.1, 1.0)

    # Holding count — 20+ gets full "diversified" credit; 1 holding penalizes.
    count_penalty = _scale(20 - min(n_holdings, 20), 0, 19)

    composite = (
        0.35 * vol_score
        + 0.25 * mdd_score
        + 0.20 * beta_score
        + 0.15 * conc_score
        + 0.05 * count_penalty
    )
    score_int = int(round(max(0.0, min(100.0, composite))))
    return score_int, _label_for_score(score_int)
