from __future__ import annotations

import unittest
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from fastapi.testclient import TestClient

from backend.app.api.factory import create_app
from backend.app.models import (
    BinanceExecutionIntentRequest,
    BinanceKillSwitchRequest,
    UpdateBinanceExecutionConfigRequest,
)
from backend.app.runtime import RuntimeSettings
from backend.app.services.execution_service import ExecutionService
from backend.app.storage.duckdb_store import DuckDbStore
from backend.app.storage.sqlite_store import SqliteStore


def make_settings(runtime_root: Path, *, credentials: bool = False) -> RuntimeSettings:
    return RuntimeSettings(
        host="127.0.0.1",
        port=8765,
        data_dir=runtime_root / "data",
        log_dir=runtime_root / "logs",
        runtime_mode="test",
        build_summary_path=None,
        edgar_identity=None,
        binance_api_key="key" if credentials else None,
        binance_secret="secret" if credentials else None,
        binance_password=None,
    )


def make_workspace(symbol: str, *, price: float = 100.0, as_of: str | None = None):
    as_of = as_of or datetime.now(UTC).isoformat()
    return SimpleNamespace(
        stale=False,
        quote=SimpleNamespace(symbol=symbol, price=price, as_of=as_of),
    )


class FakeAssetService:
    def __init__(self, *, as_of: str | None = None, price: float = 100.0):
        self.as_of = as_of
        self.price = price

    def get_asset_workspace(self, symbol: str):
        return make_workspace(symbol, price=self.price, as_of=self.as_of)


class FakeProvider:
    def __init__(self, *, configured: bool = True, provider_ok: bool = True, balances: dict[str, float] | None = None):
        self.configured = configured
        self.provider_ok = provider_ok
        self.balances = balances or {"USDT": 10_000, "BTC": 2}
        self.place_order_calls: list[dict[str, object]] = []
        self.private_test_calls = 0

    @property
    def is_configured(self) -> bool:
        return self.configured

    def test_private_connection(self):
        self.private_test_calls += 1
        return self.provider_ok, "provider ok" if self.provider_ok else "provider unavailable"

    def get_account_snapshot(self):
        return SimpleNamespace(
            balances=[
                SimpleNamespace(asset=asset, free=amount, used=0, total=amount)
                for asset, amount in self.balances.items()
            ]
        )

    def place_order(self, **kwargs):
        self.place_order_calls.append(kwargs)
        return {
            "symbol": "BTCUSDT",
            "orderId": 123,
            "clientOrderId": kwargs.get("client_order_id") or "unit-client",
            "status": "FILLED",
            "type": kwargs["order_type"].upper(),
            "side": kwargs["side"].upper(),
            "executedQty": str(kwargs["quantity"]),
            "fills": [
                {
                    "price": "100",
                    "qty": str(kwargs["quantity"]),
                    "commission": "0.01",
                    "commissionAsset": "USDT",
                }
            ],
        }


class ExecutionServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = TemporaryDirectory(dir=Path.cwd(), prefix="runtime_")
        runtime_root = Path(self.temp_dir.name)
        self.settings = make_settings(runtime_root)
        self.settings.ensure_directories()
        self.sqlite_store = SqliteStore(self.settings.sqlite_path)
        self.sqlite_store.initialize()
        self.provider = FakeProvider()
        self.asset_service = FakeAssetService()
        self.service = ExecutionService(self.sqlite_store, self.asset_service, self.provider)  # type: ignore[arg-type]
        self.paper_session_id = self._seed_paper_session()

    def tearDown(self) -> None:
        self.sqlite_store.close()
        self.temp_dir.cleanup()

    def _seed_paper_session(self) -> str:
        payload = {
            "session_id": "paper-unit",
            "backtest_run_id": "strategy-unit",
            "created_at": "2026-04-29T00:00:00+00:00",
            "label": "Unit paper",
            "execution_mode": "paper",
            "status": "simulated",
            "no_live_orders": True,
            "orders": [],
            "fills": [],
            "positions": [],
            "cash_ledger": [
                {
                    "entry_id": "ledger-unit",
                    "session_id": "paper-unit",
                    "timestamp": "2026-04-29T00:00:00+00:00",
                    "event": "initial_cash",
                    "amount": 10000,
                    "cash_balance": 10000,
                }
            ],
            "pnl": {"cash_balance": 10000, "total_pnl": 0},
            "drawdown": {},
            "rule_decisions": [],
            "diagnostics": {"warnings": [], "degraded_symbols": [], "assumptions": [], "no_live_orders": True},
        }
        self.sqlite_store.create_strategy_paper_session(payload)
        return payload["session_id"]

    def _intent(self, **overrides):
        payload = {
            "symbol": "BTC/USDT",
            "side": "buy",
            "quantity": 1,
            "orderType": "market",
            "paperSessionId": self.paper_session_id,
            "strategyRunId": "strategy-unit",
            "clientOrderId": "client-unit",
        }
        payload.update(overrides)
        return self.service.create_intent(BinanceExecutionIntentRequest.model_validate(payload))

    def _enable_live(self, **overrides):
        payload = {
            "live_enabled": True,
            "risk_acknowledged": True,
            "allowlist": ["BTC/USDT"],
            "max_order_notional": 500,
            "max_daily_turnover": 2000,
            "max_position_weight": 0.5,
            "stale_quote_seconds": 86400,
            "require_paper_session": True,
        }
        payload.update(overrides)
        return self.service.update_config(UpdateBinanceExecutionConfigRequest.model_validate(payload))

    def assertBlockedWithoutOrder(self, reason: str, result):
        self.assertEqual(result.status, "blocked", reason)
        self.assertEqual(self.provider.place_order_calls, [], reason)
        self.assertTrue(any(item.status == "block" for item in result.risk_decisions), reason)

    def test_default_off_blocks_submit_before_adapter(self):
        intent = self._intent()
        result = self.service.submit_intent(intent.intent_id)
        self.assertBlockedWithoutOrder("default-off", result)
        self.assertIn("live_mode", [item.check for item in result.risk_decisions if item.status == "block"])
        self.assertEqual(self.provider.private_test_calls, 0)

    def test_missing_credentials_blocks_before_provider_request(self):
        self.provider.configured = False
        self._enable_live()
        result = self.service.submit_intent(self._intent().intent_id)
        self.assertBlockedWithoutOrder("missing credentials", result)
        self.assertEqual(self.provider.private_test_calls, 0)

    def test_provider_unavailable_blocks_before_order(self):
        self.provider.provider_ok = False
        self._enable_live()
        result = self.service.submit_intent(self._intent().intent_id)
        self.assertBlockedWithoutOrder("provider unavailable", result)
        self.assertEqual(self.provider.private_test_calls, 1)

    def test_stale_data_notional_daily_turnover_position_balance_duplicate_allowlist_and_kill_switch_block(self):
        cases = [
            ("symbol_allowlist", {"allowlist": ["ETH/USDT"]}, {}, None),
            ("stale_data", {}, {}, FakeAssetService(as_of="2020-01-01T00:00:00+00:00")),
            ("max_order_notional", {"max_order_notional": 50}, {}, None),
            ("max_position_weight", {"max_position_weight": 0.001}, {}, None),
            ("balance_cash", {}, {}, None, {"USDT": 10}),
        ]
        for item in cases:
            name = item[0]
            config = item[1]
            intent_overrides = item[2]
            asset_service = item[3]
            balances = item[4] if len(item) > 4 else None
            with self.subTest(name):
                self.provider = FakeProvider(balances=balances)
                self.service = ExecutionService(
                    self.sqlite_store,
                    asset_service or FakeAssetService(),
                    self.provider,
                )  # type: ignore[arg-type]
                self._enable_live(**config)
                result = self.service.submit_intent(self._intent(**intent_overrides).intent_id)
                self.assertBlockedWithoutOrder(name, result)
                self.assertIn(name, [decision.check for decision in result.risk_decisions if decision.status == "block"])

        self.provider = FakeProvider()
        self.service = ExecutionService(self.sqlite_store, FakeAssetService(), self.provider)  # type: ignore[arg-type]
        self._enable_live()
        existing = self._intent(clientOrderId="duplicate-client")
        existing.status = "submitted"
        existing.updated_at = "2026-04-29T00:00:00+00:00"
        self.sqlite_store.update_binance_execution_intent(existing.model_dump(mode="json"))
        duplicate = self.service.submit_intent(self._intent(clientOrderId="duplicate-client").intent_id)
        self.assertBlockedWithoutOrder("duplicate order", duplicate)
        self.assertIn("duplicate_order", [decision.check for decision in duplicate.risk_decisions if decision.status == "block"])

        self.service.set_kill_switch(BinanceKillSwitchRequest(enabled=True, reason="unit"))
        killed = self.service.submit_intent(self._intent(clientOrderId="after-kill").intent_id)
        self.assertBlockedWithoutOrder("kill switch", killed)
        self.assertIn("global_kill_switch", [decision.check for decision in killed.risk_decisions if decision.status == "block"])

    def test_daily_turnover_blocks_before_order(self):
        self._enable_live(max_daily_turnover=200)
        previous = self._intent(clientOrderId="previous-client")
        previous.status = "submitted"
        previous.estimated_notional = 150
        previous.updated_at = datetime.now(UTC).isoformat()
        self.sqlite_store.update_binance_execution_intent(previous.model_dump(mode="json"))
        result = self.service.submit_intent(self._intent(clientOrderId="daily-client").intent_id)
        self.assertBlockedWithoutOrder("daily turnover", result)
        self.assertIn("max_daily_turnover", [decision.check for decision in result.risk_decisions if decision.status == "block"])

    def test_eligible_intent_records_order_fill_ledger_and_audit(self):
        self._enable_live()
        intent = self._intent(clientOrderId="eligible-client")
        result = self.service.submit_intent(intent.intent_id)
        self.assertEqual(result.status, "filled")
        self.assertEqual(len(self.provider.place_order_calls), 1)
        self.assertIsNotNone(result.order)
        self.assertEqual(len(result.fills), 1)
        self.assertEqual(len(result.ledger), 2)
        self.assertTrue(result.order.no_secret_payload if result.order else False)
        self.assertTrue(all(decision.status == "pass" for decision in result.risk_decisions))
        events = self.service.list_audit_events()
        self.assertTrue(any(event.event_type == "intent_submitted" for event in events))
        self.assertEqual(result.request.paper_session_id, self.paper_session_id)


class ExecutionApiTests(unittest.TestCase):
    def test_execution_api_default_off_and_audit_flow(self):
        with TemporaryDirectory(dir=Path.cwd(), prefix="runtime_") as temp_dir:
            app = create_app(make_settings(Path(temp_dir)))
            with TestClient(app) as client:
                container = app.state.container
                container.asset_service = FakeAssetService()
                container.execution_service.asset_service = container.asset_service
                container.execution_service.binance_provider = FakeProvider()

                config_response = client.get("/api/v1/execution/binance/config")
                self.assertEqual(config_response.status_code, 200)
                self.assertFalse(config_response.json()["live_enabled"])

                intent_response = client.post(
                    "/api/v1/execution/binance/intents",
                    json={
                        "symbol": "BTC/USDT",
                        "side": "buy",
                        "quantity": 1,
                        "orderType": "market",
                    },
                )
                self.assertEqual(intent_response.status_code, 200)
                intent = intent_response.json()
                self.assertEqual(intent["status"], "draft")

                submit_response = client.post(f"/api/v1/execution/binance/intents/{intent['intent_id']}/submit")
                self.assertEqual(submit_response.status_code, 200)
                submitted = submit_response.json()
                self.assertEqual(submitted["status"], "blocked")
                self.assertTrue(submitted["no_live_order_until_submit"])

                kill_response = client.post(
                    "/api/v1/execution/binance/kill-switch",
                    json={"enabled": True, "reason": "api test"},
                )
                self.assertEqual(kill_response.status_code, 200)
                self.assertTrue(kill_response.json()["kill_switch_enabled"])

                audit_response = client.get("/api/v1/execution/binance/audit")
                self.assertEqual(audit_response.status_code, 200)
                event_types = [item["event_type"] for item in audit_response.json()]
                self.assertIn("intent_created", event_types)
                self.assertIn("intent_blocked", event_types)

                security_audit_response = client.get("/api/v1/security/audit?category=execution")
                self.assertEqual(security_audit_response.status_code, 200)
                security_event_types = [item["event_type"] for item in security_audit_response.json()]
                self.assertIn("binance_intent_created", security_event_types)
                self.assertIn("binance_intent_blocked", security_event_types)
                self.assertIn("binance_kill_switch_updated", security_event_types)


if __name__ == "__main__":
    unittest.main()
