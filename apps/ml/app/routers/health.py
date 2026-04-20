from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, object]:
    """Liveness probe."""
    return {"ok": True, "service": "bullfin-ml", "status": "alive"}
