"""Health check endpoint."""

from fastapi import APIRouter

from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health():
    """Health check for load balancers and monitoring."""
    return HealthResponse(status="ok")
