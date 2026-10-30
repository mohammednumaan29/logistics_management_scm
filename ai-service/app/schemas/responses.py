
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class DisruptionSummaryResponse(BaseModel):
    """AI-generated explanation of a supplied disruption."""

    model_config = ConfigDict(extra="forbid")

    summary: str = Field(
        ...,
        min_length=1,
        description="Summary based on the supplied disruption facts",
    )


class RiskExplanationResponse(BaseModel):
    """AI explanation of a backend-calculated risk score."""

    model_config = ConfigDict(extra="forbid")

    explanation: str = Field(
        ...,
        min_length=1,
        description="Explanation of the supplied risk score and factors",
    )


class RecoveryRecommendationResponse(BaseModel):
    """AI recommendation among backend-generated recovery options."""

    model_config = ConfigDict(extra="forbid")

    recommendedOption: str = Field(
        ...,
        min_length=1,
        description="Name of one of the supplied recovery options",
    )
    reasoning: str = Field(
        ...,
        min_length=1,
        description="Reason for recommending the selected option",
    )
    tradeoffs: List[str] = Field(
        ...,
        description="Trade-offs supported by the supplied option data",
    )
