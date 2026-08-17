from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from backend.app.api.factory import AppContainer
from backend.app.runtime import RuntimeSettings


def make_settings(runtime_root: Path) -> RuntimeSettings:
    return RuntimeSettings(
        host="127.0.0.1",
        port=8765,
        data_dir=runtime_root / "data",
        log_dir=runtime_root / "logs",
        runtime_mode="test",
        build_summary_path=None,
        edgar_identity=None,
        binance_api_key=None,
        binance_secret=None,
        binance_password=None,
    )


class AssetCacheOnlyTests(unittest.TestCase):
    def test_cache_only_workspace_never_calls_external_providers(self) -> None:
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            container = AppContainer(make_settings(Path(temp_dir)))
            provider_calls: list[str] = []

            def unexpected_provider_call(*_args, **_kwargs):
                provider_calls.append("called")
                raise AssertionError("cache-only workspace attempted an external provider call")

            container.market_provider.get_latest_quote = unexpected_provider_call
            container.market_provider.get_price_history = unexpected_provider_call
            container.fundamental_provider.get_overview = unexpected_provider_call
            container.fundamental_provider.get_ratios = unexpected_provider_call
            container.filings_provider.get_filings = unexpected_provider_call

            try:
                with self.assertRaisesRegex(RuntimeError, "Cached market data unavailable"):
                    container.asset_service.get_asset_workspace("AAPL", cache_only=True)
            finally:
                container.close()

            self.assertEqual(provider_calls, [])


if __name__ == "__main__":
    unittest.main()
