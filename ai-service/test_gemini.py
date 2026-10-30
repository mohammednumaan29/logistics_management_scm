
import asyncio

from app.providers.gemini import GeminiProvider


async def main():
    provider = GeminiProvider()

    response = await provider.generate(
        "Reply with exactly: DisruptionIQ Gemini connection successful"
    )

    print("Gemini response:", response)


if __name__ == "__main__":
    asyncio.run(main())
