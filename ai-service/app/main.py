
from fastapi import FastAPI

from app.core.config import get_settings
from app.routes.explanation import router as explanation_router
from app.routes.recommendation import router as recommendation_router

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "AI service for DisruptionIQ supply-chain "
        "disruption explanations and recovery recommendations."
    ),
)
app.include_router(explanation_router)
app.include_router(recommendation_router)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Check whether the AI service is running."""
    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
    }
