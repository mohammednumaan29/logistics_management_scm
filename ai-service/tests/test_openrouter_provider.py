
import unittest
from unittest.mock import AsyncMock, Mock, patch

import httpx

from app.core.exceptions import AIProviderError
from app.providers.openrouter import OpenRouterProvider


class TestOpenRouterProvider(unittest.IsolatedAsyncioTestCase):

    def setUp(self):
        self.settings_patcher = patch(
            "app.providers.openrouter.get_settings"
        )
        self.mock_get_settings = self.settings_patcher.start()
        self.addCleanup(self.settings_patcher.stop)

        settings = self.mock_get_settings.return_value
        settings.openrouter_api_key = "test-key"
        settings.openrouter_model = "test-model"

        self.provider = OpenRouterProvider()

    @patch("app.providers.openrouter.httpx.AsyncClient")
    async def test_generates_text_successfully(self, mock_client_class):
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": " OpenRouter test response "
                    }
                }
            ]
        }

        mock_client = Mock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        result = await self.provider.generate("test prompt")

        self.assertEqual(result, "OpenRouter test response")

    @patch("app.providers.openrouter.httpx.AsyncClient")
    async def test_handles_http_error(self, mock_client_class):
        request = httpx.Request(
            "POST",
            OpenRouterProvider.API_URL,
        )
        response = httpx.Response(
            401,
            request=request,
        )

        mock_client = Mock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "Unauthorized",
                request=request,
                response=response,
            )
        )
        mock_client_class.return_value = mock_client

        with self.assertRaises(AIProviderError):
            await self.provider.generate("test prompt")

    @patch("app.providers.openrouter.httpx.AsyncClient")
    async def test_rejects_empty_response(self, mock_client_class):
        mock_response = Mock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": " "
                    }
                }
            ]
        }

        mock_client = Mock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client

        with self.assertRaises(AIProviderError):
            await self.provider.generate("test prompt")


if __name__ == "__main__":
    unittest.main()
