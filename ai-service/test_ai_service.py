
import asyncio

from app.services.ai_service import AIService


async def main() -> None:
    service = AIService()

    options = [
        {
            "name": "Air Freight",
            "cost": 5000,
            "ordersSaved": 10,
            "recoveryDays": 2,
        },
        {
            "name": "Alternative Supplier",
            "cost": 3000,
            "ordersSaved": 8,
            "recoveryDays": 4,
        },
    ]

    recommendation = await service.recommend_recovery(
        recovery_options=options
    )

    print("\n--- Recovery Recommendation ---")
    print("Recommended option:", recommendation["recommendedOption"])
    print("Reasoning:", recommendation["reasoning"])
    print("Trade-offs:")
    for tradeoff in recommendation["tradeoffs"]:
        print("-", tradeoff)


if __name__ == "__main__":
    asyncio.run(main())
