
import unittest
from unittest.mock import AsyncMock, Mock, patch

from app.core.exceptions import AIProviderError
from app.providers.gemini import GeminiProvider


class TestGeminiProvider(unittest.IsolatedAsyncioTestCase):

    @patch("app.providers.gemini.get_settings")
    @patch("app.providers.gemini.genai.Client")
    async def test_generates_text_successfully(
        self,
        mock_client_class,
        mock_get_settings,
    ):
        mock_get_settings.return_value.gemini_api_key = "test-key"

        mock_client = Mock()
        mock_client.aio.models.generate_content = AsyncMock(
            return_value=Mock(text=" Gemini test response ")
        )
        mock_client_class.return_value = mock_client

        provider = GeminiProvider()
        result = await provider.generate("test prompt")

        self.assertEqual(result, "Gemini test response")

    @patch("app.providers.gemini.get_settings")
    @patch("app.providers.gemini.genai.Client")
    async def test_rejects_empty_response(
        self,
        mock_client_class,
        mock_get_settings,
    ):
        mock_get_settings.return_value.gemini_api_key = "test-key"

        mock_client = Mock()
        mock_client.aio.models.generate_content = AsyncMock(
            return_value=Mock(text=" ")
        )
        mock_client_class.return_value = mock_client

        provider = GeminiProvider()

        with self.assertRaises(AIProviderError):
            await provider.generate("test prompt")

    @patch("app.providers.gemini.get_settings")
    @patch("app.providers.gemini.genai.Client")
    async def test_normalizes_api_failure(
        self,
        mock_client_class,
        mock_get_settings,
    ):
        mock_get_settings.return_value.gemini_api_key = "test-key"

        mock_client = Mock()
        mock_client.aio.models.generate_content = AsyncMock(
            side_effect=RuntimeError("simulated API failure")
        )
        mock_client_class.return_value = mock_client

        provider = GeminiProvider()

        with self.assertRaises(AIProviderError):
            await provider.generate("test prompt")


if __name__ == "__main__":
    unittest.main()
