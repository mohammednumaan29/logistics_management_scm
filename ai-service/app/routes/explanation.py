
from fastapi import APIRouter, HTTPException

from app.core.exceptions import (
    AIProviderError,
    AIResponseValidationError,
)
from app.schemas.disruption import (
    DisruptionSummaryRequest,
    RiskExplanationRequest,
)
from app.schemas.responses import (
    DisruptionSummaryResponse,
    RiskExplanationResponse,
)
from app.services.ai_service import AIService


router = APIRouter(
    prefix="/api/v1/explanations",
    tags=["Explanations"],
)


@router.post(
    "/disruption",
    response_model=DisruptionSummaryResponse,
)
async def summarize_disruption(
    request: DisruptionSummaryRequest,
) -> DisruptionSummaryResponse:
    """Generate a summary of a supplied supply-chain disruption."""
    try:
        service = AIService()
        summary = await service.summarize_disruption(
            disruption_type=request.type,
            shipment_id=request.shipmentId,
            delay_days=request.delayDays,
            reason=request.reason,
            affected_orders=request.affectedOrders,
            critical_orders=request.criticalOrders,
        )
        return DisruptionSummaryResponse(summary=summary)

    except AIProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider could not complete the request.",
        ) from exc

    except AIResponseValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider returned an invalid response.",
        ) from exc


@router.post(
    "/risk",
    response_model=RiskExplanationResponse,
)
async def explain_risk(
    request: RiskExplanationRequest,
) -> RiskExplanationResponse:
    """Explain a risk score and factors supplied by the backend."""
    try:
        service = AIService()
        explanation = await service.explain_risk(
            order_id=request.orderId,
            risk_score=request.riskScore,
            risk_level=request.riskLevel,
            risk_factors=request.factors,
        )
        return RiskExplanationResponse(explanation=explanation)

    except AIProviderError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider could not complete the request.",
        ) from exc

    except AIResponseValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail="The AI provider returned an invalid response.",
        ) from exc
