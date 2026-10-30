
from fastapi import APIRouter, HTTPException

from app.core.exceptions import (
    AIProviderError,
    AIResponseValidationError,
)
from app.schemas.recovery import RecoveryRecommendationRequest
from app.schemas.responses import RecoveryRecommendationResponse
from app.services.ai_service import AIService


router = APIRouter(
    prefix="/api/v1/recommendations",
    tags=["Recommendations"],
)


@router.post(
    "/recovery",
    response_model=RecoveryRecommendationResponse,
)
async def recommend_recovery(
    request: RecoveryRecommendationRequest,
) -> RecoveryRecommendationResponse:
    """Recommend one of the backend-provided recovery options."""
    try:
        service = AIService()

        options = [
            option.model_dump(by_alias=True)
            if hasattr(option, "model_dump")
            else option.dict(by_alias=True)
            for option in request.options
        ]

        recommendation = await service.recommend_recovery(
            recovery_options=options,
        )
        return RecoveryRecommendationResponse(**recommendation)

    except AIProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider could not complete the request.",
        ) from exc

    except AIResponseValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider returned an invalid recovery recommendation.",
        ) from exc
