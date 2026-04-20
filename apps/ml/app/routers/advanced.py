from __future__ import annotations

from fastapi import APIRouter

from app.models import (
    BacktestRequest,
    BacktestResponse,
    EfficientFrontierRequest,
    EfficientFrontierResponse,
    ForecastRequest,
    ForecastResponse,
    MonteCarloRequest,
    MonteCarloResponse,
)
from app.services.backtest import run_backtest
from app.services.forecast import compute_forecast
from app.services.monte_carlo import run_monte_carlo
from app.services.optimizer import compute_efficient_frontier

router = APIRouter(prefix="/v1", tags=["advanced"])


@router.post("/efficient-frontier", response_model=EfficientFrontierResponse)
def efficient_frontier(req: EfficientFrontierRequest) -> EfficientFrontierResponse:
    """Return the Modern Portfolio Theory frontier for a set of candidate tickers."""
    return compute_efficient_frontier(
        req.symbols,
        points=req.points,
        risk_free_rate_override=req.risk_free_rate,
        lookback_years=req.lookback_years,
    )


@router.post("/monte-carlo", response_model=MonteCarloResponse)
def monte_carlo(req: MonteCarloRequest) -> MonteCarloResponse:
    """Project the portfolio forward with Monte Carlo sampling of historical returns."""
    return run_monte_carlo(
        req.holdings,
        years=req.years,
        simulations=req.simulations,
        annual_contribution=req.annual_contribution,
    )


@router.post("/forecast", response_model=ForecastResponse)
def forecast(req: ForecastRequest) -> ForecastResponse:
    """Per-stock GBM forecasts with confidence bands and news."""
    return compute_forecast(
        req.symbols,
        horizon_days=req.horizon_days,
        lookback_years=req.lookback_years,
        simulations=req.simulations,
        include_news=req.include_news,
    )


@router.post("/backtest", response_model=BacktestResponse)
def backtest(req: BacktestRequest) -> BacktestResponse:
    """Replay a fixed-weight portfolio through real historical prices."""
    return run_backtest(
        req.symbols,
        weights=req.weights,
        start_date=req.start_date,
        end_date=req.end_date,
        benchmark=req.benchmark,
    )
