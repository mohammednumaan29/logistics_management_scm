
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import httpx

from app.core.exceptions import AIProviderError
from app.providers.ollama import OllamaProvider


class TestOllamaProvider(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.settings_patcher = patch(
            "app.providers.ollama.get_settings"
        )
        self.mock_settings = self.settings_patcher.start()
        self.mock_settings.return_value.ollama_base_url = (
            "http://localhost:11434"
        )
        self.mock_settings.return_value.ollama_model = "qwen3:8b"

        self.addCleanup(self.settings_patcher.stop)

        self.provider = OllamaProvider()

    @patch("app.providers.ollama.httpx.AsyncClient")
    async def test_generates_text_successfully(self, mock_client_class):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "Shipment delay explained."}
        }
        mock_response.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_context = MagicMock()
        mock_context.__aenter__.return_value = mock_client
        mock_context.__aexit__.return_value = False
        mock_client_class.return_value = mock_context

        result = await self.provider.generate("Explain the delay.")

        self.assertEqual(result, "Shipment delay explained.")
        mock_client.post.assert_awaited_once()

    @patch("app.providers.ollama.httpx.AsyncClient")
    async def test_handles_network_error(self, mock_client_class):
        mock_client = MagicMock()
        mock_client.post = AsyncMock(
            side_effect=httpx.ConnectError("Connection failed")
        )

        mock_context = MagicMock()
        mock_context.__aenter__.return_value = mock_client
        mock_context.__aexit__.return_value = False
        mock_client_class.return_value = mock_context

        with self.assertRaises(AIProviderError):
            await self.provider.generate("Explain the delay.")

    @patch("app.providers.ollama.httpx.AsyncClient")
    async def test_rejects_empty_response(self, mock_client_class):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "message": {"content": "   "}
        }
        mock_response.raise_for_status.return_value = None

        mock_client = MagicMock()
        mock_client.post = AsyncMock(return_value=mock_response)

        mock_context = MagicMock()
        mock_context.__aenter__.return_value = mock_client
        mock_context.__aexit__.return_value = False
        mock_client_class.return_value = mock_context

        with self.assertRaises(AIProviderError):
            await self.provider.generate("Explain the delay.")


if __name__ == "__main__":
    unittest.main()
