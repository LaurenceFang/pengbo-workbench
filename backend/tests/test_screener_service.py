from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.data_seed import DEFAULT_SCREENERS
from backend.app.providers.catalog import get_asset
from backend.app.runtime import RuntimeSettings
from backend.app.services.screener_service import CatalogUniverseSource, ExpandedUniverseSource, ScreenerService
from backend.app.storage.sqlite_store import SqliteStore


def make_history(days: int, start_close: float, daily_step: float, volume: float) -> list[SimpleNamespace]:
    points: list[SimpleNamespace] = []
    for index in range(days):
        close = start_close + daily_step * index
        points.append(
            SimpleNamespace(
                timestamp=f"2026-01-{(index % 28) + 1:02d}",
                close=close,
                volume=volume,
            )
        )
    return points


def make_workspace(
    *,
    asset_class: str,
    provider: str,
    price: float,
    change_pct: float,
    history: list[SimpleNamespace],
    market_cap: str | None = None,
    ratios: list[tuple[str, str]] | None = None,
    stale: bool = False,
    notes: list[str] | None = None,
):
    ratio_items = [SimpleNamespace(label=label, value=value) for label, value in ratios or []]
    overview = SimpleNamespace(market_cap=market_cap) if market_cap is not None else None
    return SimpleNamespace(
        stale=stale,
        asset=SimpleNamespace(provider=provider, asset_class=asset_class),
        quote=SimpleNamespace(price=price, change_pct=change_pct),
        history=history,
        overview=overview,
        ratios=ratio_items,
        capabilities=SimpleNamespace(notes=notes or []),
    )


class FakeAssetService:
    def __init__(self, workspaces: dict[str, object | Exception]) -> None:
        self.workspaces = workspaces

    def get_asset_workspace(self, symbol: str):
        workspace = self.workspaces[symbol]
        if isinstance(workspace, Exception):
            raise workspace
        return workspace


class StaticUniverseSource:
    def __init__(self, symbols: list[str]) -> None:
        self.key = "static"
        self.symbols = symbols

    def assets_for(self, asset_type: str):
        del asset_type
        return [get_asset(symbol) for symbol in self.symbols if get_asset(symbol) is not None]


class ScreenerServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory(dir=Path.cwd(), prefix="runtime_")
        self.runtime_root = Path(self.temp_dir.name)
        self.store = SqliteStore(self.runtime_root / "screeners.sqlite3")
        self.store.initialize()

    def tearDown(self) -> None:
        self.store.close()
        self.temp_dir.cleanup()

    def make_service(self, workspaces: dict[str, object | Exception]) -> ScreenerService:
        service = ScreenerService(self.store, FakeAssetService(workspaces))
        return service

    def test_default_variants_seeded_for_all_presets(self):
        presets = self.store.list_screener_presets()

        self.assertEqual(len(presets), len(DEFAULT_SCREENERS))
        for preset in DEFAULT_SCREENERS:
            seeded_preset = self.store.get_screener_preset(preset["key"])
            variants = self.store.list_screener_preset_variants(preset["key"])
            self.assertIsNotNone(seeded_preset)
            self.assertEqual(seeded_preset["active_variant_key"], "default")
            self.assertEqual(seeded_preset["active_variant_name"], "默认配置")
            self.assertEqual(len(variants), 1)
            self.assertTrue(variants[0]["is_system_default"])
            self.assertTrue(variants[0]["is_active"])
            self.assertEqual(variants[0]["variant_key"], "default")
            self.assertEqual(set(variants[0]["tuning"].values()), {"medium"})
            self.assertEqual(len(variants[0]["filters"]), 3)

    def test_variant_crud_activation_and_delete_rules(self):
        service = self.make_service({})

        created = service.create_variant(
            "quality-equities",
            SimpleNamespace(name="高质量偏进攻", description="在质量不失真的前提下放宽门槛。"),
        )
        self.assertFalse(created.is_active)
        self.assertFalse(created.is_system_default)
        self.assertEqual(created.preset_key, "quality-equities")

        updated = service.update_variant(
            "quality-equities",
            created.variant_key,
            SimpleNamespace(
                name="高质量偏宽松",
                description="偏宽松的大盘质量配置。",
                tuning={
                    "quality_floor": "low",
                    "trend_requirement": "low",
                    "size_bias": "low",
                },
            ),
        )
        self.assertEqual(updated.name, "高质量偏宽松")
        self.assertEqual(updated.tuning["quality_floor"], "low")
        self.assertIn("质量门槛偏宽松", updated.filters)

        activated = service.activate_variant("quality-equities", created.variant_key)
        preset = self.store.get_screener_preset("quality-equities")
        self.assertTrue(activated.is_active)
        self.assertEqual(preset["active_variant_key"], created.variant_key)

        with self.assertRaisesRegex(ValueError, "cannot be deleted"):
            service.delete_variant("quality-equities", "default")

        service.delete_variant("quality-equities", created.variant_key)
        variants = self.store.list_screener_preset_variants("quality-equities")
        self.assertEqual(len(variants), 1)
        self.assertTrue(variants[0]["is_system_default"])
        self.assertTrue(variants[0]["is_active"])

    def test_run_variant_key_changes_scores_without_overwriting_active_variant_hit_count(self):
        service = self.make_service(
            {
                "AAPL": make_workspace(
                    asset_class="equity",
                    provider="test-yahoo",
                    price=189.5,
                    change_pct=1.6,
                    market_cap="$3.10T",
                    history=make_history(120, 150.0, 0.45, 98_000_000),
                    ratios=[
                        ("Gross Margin", "46.0%"),
                        ("Operating Margin", "29.0%"),
                        ("Profit Margin", "24.0%"),
                        ("Return on Equity", "34.0%"),
                        ("Current Ratio", "1.20x"),
                    ],
                ),
                "NVDA": make_workspace(
                    asset_class="equity",
                    provider="test-yahoo",
                    price=912.0,
                    change_pct=0.8,
                    market_cap="$420.00B",
                    history=make_history(120, 800.0, 0.55, 64_000_000),
                    ratios=[
                        ("Gross Margin", "33.0%"),
                        ("Operating Margin", "22.0%"),
                        ("Profit Margin", "9.0%"),
                        ("Return on Equity", "14.0%"),
                    ],
                ),
                "QQQ": make_workspace(
                    asset_class="etf",
                    provider="test-yahoo",
                    price=488.0,
                    change_pct=0.4,
                    history=make_history(45, 430.0, 1.0, 55_000_000),
                ),
            }
        )
        service.universe_sources["expanded"] = StaticUniverseSource(["AAPL", "NVDA", "QQQ"])

        baseline = service.run(
            SimpleNamespace(
                preset="quality-equities",
                asset_type="equity",
                universe_source="expanded",
                variant_key=None,
            )
        )
        baseline_nvda = next(item for item in baseline.results if item.symbol == "NVDA")
        active_variant = self.store.get_active_screener_preset_variant("quality-equities")
        self.assertEqual(active_variant["last_hit_count"], baseline.hit_count)
        self.assertEqual(self.store.get_screener_preset("quality-equities")["hit_count"], baseline.hit_count)

        custom = service.create_variant(
            "quality-equities",
            SimpleNamespace(name="宽松质量实验", description="允许更早参与大盘质量股。"),
        )
        service.update_variant(
            "quality-equities",
            custom.variant_key,
            SimpleNamespace(
                name="宽松质量实验",
                description="允许更早参与大盘质量股。",
                tuning={
                    "quality_floor": "low",
                    "trend_requirement": "low",
                    "size_bias": "low",
                },
            ),
        )

        custom_run = service.run(
            SimpleNamespace(
                preset="quality-equities",
                asset_type="equity",
                universe_source="expanded",
                variant_key=custom.variant_key,
            )
        )
        custom_nvda = next(item for item in custom_run.results if item.symbol == "NVDA")

        self.assertGreater(custom_nvda.score, baseline_nvda.score)
        self.assertEqual(custom_run.variant_key, custom.variant_key)
        self.assertEqual(
            self.store.get_screener_preset_variant("quality-equities", custom.variant_key)["last_hit_count"],
            custom_run.hit_count,
        )
        self.assertEqual(
            self.store.get_screener_preset("quality-equities")["hit_count"],
            baseline.hit_count,
        )

    def test_provider_error_becomes_watch_result(self):
        service = self.make_service({"BTC/USDT": RuntimeError("provider offline")})
        service.universe_sources["expanded"] = StaticUniverseSource(["BTC/USDT"])

        response = service.run(
            SimpleNamespace(
                preset="trend-crypto",
                asset_type="crypto",
                universe_source="expanded",
                variant_key=None,
            )
        )

        self.assertEqual(response.evaluated_count, 1)
        self.assertEqual(response.hit_count, 0)
        self.assertEqual(response.results[0].score, 0.0)
        self.assertEqual(response.results[0].score_label, "watch")
        self.assertEqual(response.results[0].missing_metrics, ["provider_data"])
        self.assertIsNotNone(response.results[0].data_quality)
        self.assertEqual(response.results[0].data_quality.overall, "blocked")

    def test_expanded_universe_includes_repo_managed_symbols(self):
        expanded_equities = [entry.symbol for entry in ExpandedUniverseSource().assets_for("equity")]
        expanded_crypto = [entry.symbol for entry in ExpandedUniverseSource().assets_for("crypto")]
        catalog_equities = [entry.symbol for entry in CatalogUniverseSource().assets_for("equity")]

        self.assertIn("MSFT", expanded_equities)
        self.assertIn("QQQ", expanded_equities)
        self.assertIn("ETH/USDT", expanded_crypto)
        self.assertGreater(len(expanded_equities), len(catalog_equities))


class ScreenerApiTests(unittest.TestCase):
    def test_api_supports_variant_endpoints_and_variant_key_runs(self):
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            runtime_root = Path(temp_dir)
            app = create_app(
                RuntimeSettings(
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
            )

            with TestClient(app) as client:
                container = app.state.container
                fake_workspaces = {
                    "AAPL": make_workspace(
                        asset_class="equity",
                        provider="test-yahoo",
                        price=189.5,
                        change_pct=1.6,
                        market_cap="$3.10T",
                        history=make_history(120, 150.0, 0.45, 98_000_000),
                        ratios=[
                            ("Gross Margin", "46.0%"),
                            ("Operating Margin", "29.0%"),
                            ("Profit Margin", "24.0%"),
                            ("Return on Equity", "34.0%"),
                            ("Current Ratio", "1.20x"),
                        ],
                    ),
                    "NVDA": make_workspace(
                        asset_class="equity",
                        provider="test-yahoo",
                        price=912.0,
                        change_pct=0.8,
                        market_cap="$420.00B",
                        history=make_history(120, 800.0, 0.55, 64_000_000),
                        ratios=[
                            ("Gross Margin", "33.0%"),
                            ("Operating Margin", "22.0%"),
                            ("Profit Margin", "9.0%"),
                            ("Return on Equity", "14.0%"),
                        ],
                    ),
                }

                def fake_get_asset_workspace(symbol: str):
                    return fake_workspaces[symbol]

                container.asset_service.get_asset_workspace = fake_get_asset_workspace
                container.screener_service.asset_service = container.asset_service

                variants_response = client.get("/api/v1/screeners/presets/quality-equities/variants")
                self.assertEqual(variants_response.status_code, 200)
                self.assertEqual(len(variants_response.json()), 1)
                self.assertTrue(variants_response.json()[0]["is_system_default"])

                create_response = client.post(
                    "/api/v1/screeners/presets/quality-equities/variants",
                    json={"name": "API 自定义配置", "description": "从活动配置复制。"},
                )
                self.assertEqual(create_response.status_code, 200)
                created_payload = create_response.json()
                variant_key = created_payload["variant_key"]
                self.assertEqual(created_payload["name"], "API 自定义配置")
                self.assertFalse(created_payload["is_active"])

                update_response = client.put(
                    f"/api/v1/screeners/presets/quality-equities/variants/{variant_key}",
                    json={
                        "name": "API 宽松质量配置",
                        "description": "放宽质量门槛。",
                        "tuning": {
                            "quality_floor": "low",
                            "trend_requirement": "low",
                            "size_bias": "low",
                        },
                    },
                )
                self.assertEqual(update_response.status_code, 200)
                self.assertEqual(update_response.json()["tuning"]["quality_floor"], "low")

                run_response = client.post(
                    "/api/v1/screeners/run",
                    json={
                        "preset": "quality-equities",
                        "asset_type": "equity",
                        "universeSource": "catalog",
                        "variantKey": variant_key,
                    },
                )
                self.assertEqual(run_response.status_code, 200)
                run_payload = run_response.json()
                self.assertEqual(run_payload["variant_key"], variant_key)
                self.assertEqual(run_payload["evaluated_count"], len(run_payload["results"]))
                self.assertGreaterEqual(run_payload["evaluated_count"], 2)
                self.assertIn(run_payload["results"][0]["score_label"], {"high", "medium", "watch"})

                activate_response = client.post(
                    f"/api/v1/screeners/presets/quality-equities/variants/{variant_key}/activate"
                )
                self.assertEqual(activate_response.status_code, 200)
                self.assertTrue(activate_response.json()["is_active"])

                presets_response = client.get("/api/v1/screeners/presets")
                self.assertEqual(presets_response.status_code, 200)
                quality_preset = next(item for item in presets_response.json() if item["key"] == "quality-equities")
                self.assertEqual(quality_preset["active_variant_key"], variant_key)

                invalid_variant_response = client.post(
                    "/api/v1/screeners/run",
                    json={
                        "preset": "quality-equities",
                        "asset_type": "equity",
                        "universeSource": "catalog",
                        "variantKey": "missing-variant",
                    },
                )
                self.assertEqual(invalid_variant_response.status_code, 404)

                invalid_universe_response = client.post(
                    "/api/v1/screeners/run",
                    json={
                        "preset": "quality-equities",
                        "asset_type": "equity",
                        "universeSource": "broken",
                    },
                )
                self.assertEqual(invalid_universe_response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
