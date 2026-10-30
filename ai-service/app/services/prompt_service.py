
from pathlib import Path
from typing import List, Mapping, Any


class PromptService:
    """Loads and formats DisruptionIQ AI prompt templates."""

    def __init__(self) -> None:
        # Resolve the prompts directory relative to this file,
        # so the service works regardless of the terminal's directory.
        self.prompts_dir = (
            Path(__file__).resolve().parent.parent / "prompts"
        )

    def _load_template(self, filename: str) -> str:
        """Load a prompt template from the prompts directory."""
        template_path = self.prompts_dir / filename

        if not template_path.is_file():
            raise FileNotFoundError(
                f"Prompt template not found: {template_path}"
            )

        return template_path.read_text(encoding="utf-8")

    def _render_template(
        self,
        filename: str,
        values: Mapping[str, Any],
    ) -> str:
        """Replace template placeholders with supplied values."""
        template = self._load_template(filename)

        try:
            return template.format_map(values)
        except KeyError as exc:
            missing_key = exc.args[0]
            raise ValueError(
                f"Missing prompt value '{missing_key}' "
                f"for template '{filename}'."
            ) from exc

    def build_disruption_summary_prompt(
        self,
        disruption_type: str,
        shipment_id: str,
        delay_days: int,
        reason: str,
        affected_orders: int,
        critical_orders: int,
    ) -> str:
        """Build the disruption summary prompt."""
        return self._render_template(
            "disruption_summary.txt",
            {
                "disruption_type": disruption_type,
                "shipment_id": shipment_id,
                "delay_days": delay_days,
                "reason": reason,
                "affected_orders": affected_orders,
                "critical_orders": critical_orders,
            },
        )

    def build_risk_explanation_prompt(
        self,
        order_id: str,
        risk_score: float,
        risk_level: str,
        risk_factors: List[str],
    ) -> str:
        """Build the risk explanation prompt."""
        formatted_factors = "\n".join(
            f"- {factor}" for factor in risk_factors
        )

        return self._render_template(
            "risk_explanation.txt",
            {
                "order_id": order_id,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "risk_factors": formatted_factors,
            },
        )

    def build_recovery_recommendation_prompt(
        self,
        recovery_options: List[Mapping[str, Any]],
    ) -> str:
        """Build the recovery recommendation prompt."""
        import json

        formatted_options = json.dumps(
            recovery_options,
            indent=2,
            ensure_ascii=False,
        )

        return self._render_template(
            "recovery_recommendation.txt",
            {
                "recovery_options": formatted_options,
            },
        )
