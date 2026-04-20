from __future__ import annotations

from fastapi import APIRouter

from app.models import MetricsRequest, MetricsResponse
from app.services.metrics import compute_portfolio_metrics

router = APIRouter(prefix="/v1", tags=["metrics"])


@router.post("/metrics", response_model=MetricsResponse)
def metrics(req: MetricsRequest) -> MetricsResponse:
    """Compute the full metric suite for a set of holdings."""
    return compute_portfolio_metrics(
        req.holdings,
        benchmark=req.benchmark,
        risk_free_rate_override=req.risk_free_rate,
    )
