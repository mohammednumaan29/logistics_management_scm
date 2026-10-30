
from typing import List

from pydantic import BaseModel, ConfigDict, Field


class RecoveryOption(BaseModel):
    """A recovery option already calculated by the backend."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(
        ...,
        min_length=1,
        description="Name of the recovery strategy",
    )
    cost: float = Field(
        ...,
        ge=0,
        description="Cost of the recovery strategy",
    )
    ordersSaved: int = Field(
        ...,
        ge=0,
        description="Number of orders expected to be saved",
    )
    recoveryDays: int = Field(
        ...,
        ge=0,
        description="Expected recovery time in days",
    )


class RecoveryRecommendationRequest(BaseModel):
    """Recovery options supplied by the backend for AI comparison."""

    model_config = ConfigDict(extra="forbid")

    options: List[RecoveryOption] = Field(
        ...,
        min_length=1,
        description="Backend-generated recovery options",
    )
