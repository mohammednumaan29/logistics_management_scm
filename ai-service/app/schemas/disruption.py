
from typing import List

from pydantic import BaseModel, Field, ConfigDict


class DisruptionSummaryRequest(BaseModel):
    """Input facts for generating a disruption summary."""

    model_config = ConfigDict(extra="forbid")

    type: str = Field(
        ...,
        min_length=1,
        description="Type of supply-chain disruption",
    )
    shipmentId: str = Field(
        ...,
        min_length=1,
        description="Identifier of the affected shipment",
    )
    delayDays: int = Field(
        ...,
        ge=0,
        description="Number of days the shipment is delayed",
    )
    reason: str = Field(
        ...,
        min_length=1,
        description="Reported reason for the disruption",
    )
    affectedOrders: int = Field(
        ...,
        ge=0,
        description="Number of affected orders",
    )
    criticalOrders: int = Field(
        ...,
        ge=0,
        description="Number of critical orders affected",
    )


class RiskExplanationRequest(BaseModel):
    """Backend-calculated risk facts to explain."""

    model_config = ConfigDict(extra="forbid")

    orderId: str = Field(
        ...,
        min_length=1,
        description="Identifier of the affected order",
    )
    riskScore: float = Field(
        ...,
        ge=0,
        le=100,
        description="Risk score calculated by the backend",
    )
    riskLevel: str = Field(
        ...,
        min_length=1,
        description="Risk level assigned by the backend",
    )
    factors: List[str] = Field(
        ...,
        min_length=1,
        description="Factors supplied by the backend",
    )
