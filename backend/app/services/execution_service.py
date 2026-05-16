from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from ..models import (
    BinanceExecutionAuditEvent,
    BinanceExecutionConfig,
    BinanceExecutionIntentRequest,
    BinanceExecutionIntentResponse,
    BinanceKillSwitchRequest,
    BinanceLiveFill,
    BinanceLiveLedgerEntry,
    BinanceLiveOrder,
    BinanceRiskDecision,
    UpdateBinanceExecutionConfigRequest,
)
from ..providers.binance import BinanceProvider
from ..storage.sqlite_store import SqliteStore
from .asset_service import AssetService
from .security_audit_service import SecurityAuditService


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _round_money(value: float) -> float:
    return round(value, 2)


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper().replace("-", "/")


def _quote_asset(symbol: str) -> str:
    return symbol.split("/")[-1] if "/" in symbol else "USDT"


def _base_asset(symbol: str) -> str:
    return symbol.split("/")[0] if "/" in symbol else symbol.replace("USDT", "")


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class ExecutionService:
    def __init__(
        self,
        sqlite_store: SqliteStore,
        asset_service: AssetService,
        binance_provider: BinanceProvider,
        security_audit_service: SecurityAuditService | None = None,
    ) -> None:
        self.sqlite_store = sqlite_store
        self.asset_service = asset_service
        self.binance_provider = binance_provider
        self.security_audit_service = security_audit_service

    def get_config(self) -> BinanceExecutionConfig:
        stored = self.sqlite_store.get_binance_execution_config()
        if stored is None:
            stored = BinanceExecutionConfig(updated_at=_utc_now_iso()).model_dump(mode="json")
            self.sqlite_store.put_binance_execution_config(stored)
        stored["credentials_configured"] = self.binance_provider.is_configured
        stored["kill_switch_enabled"] = bool(self._kill_switch_enabled("global"))
        stored["notes"] = self._config_notes(stored)
        return BinanceExecutionConfig.model_validate(stored)

    def update_config(self, payload: UpdateBinanceExecutionConfigRequest) -> BinanceExecutionConfig:
        current = self.get_config().model_dump(mode="json")
        updates = payload.model_dump(exclude_none=True)
        if "allowlist" in updates:
            updates["allowlist"] = sorted({_normalize_symbol(item) for item in updates["allowlist"] if item.strip()})
            if not updates["allowlist"]:
                raise ValueError("Binance execution allowlist cannot be empty.")
        current.update(updates)
        current["updated_at"] = _utc_now_iso()
        self.sqlite_store.put_binance_execution_config(current)
        self._audit(
            event_type="config_updated",
            summary="Binance execution config updated.",
            payload={
                key: value
                for key, value in updates.items()
                if key not in {"credentials_configured"}
            },
        )
        self._security_audit(
            event_type="binance_config_updated",
            summary="Binance execution config updated.",
            payload={
                key: value
                for key, value in updates.items()
                if key not in {"credentials_configured"}
            },
        )
        return self.get_config()

    def create_intent(self, payload: BinanceExecutionIntentRequest) -> BinanceExecutionIntentResponse:
        request = payload.model_copy(update={"symbol": _normalize_symbol(payload.symbol)})
        now = _utc_now_iso()
        intent = BinanceExecutionIntentResponse(
            intent_id=f"intent-{uuid4().hex[:12]}",
            created_at=now,
            updated_at=now,
            status="draft",
            request=request,
            no_live_order_until_submit=True,
        )
        row = self.sqlite_store.create_binance_execution_intent(intent.model_dump(mode="json"))
        self._audit(
            event_type="intent_created",
            intent_id=intent.intent_id,
            strategy_run_id=request.strategy_run_id,
            summary=f"Created Binance execution intent for {request.symbol}.",
            payload={
                "symbol": request.symbol,
                "side": request.side,
                "quantity": request.quantity,
                "order_type": request.order_type,
                "paper_session_id": request.paper_session_id,
            },
        )
        self._security_audit(
            event_type="binance_intent_created",
            subject=intent.intent_id,
            summary=f"Created Binance execution intent for {request.symbol}.",
            payload={
                "intent_id": intent.intent_id,
                "strategy_run_id": request.strategy_run_id,
                "symbol": request.symbol,
                "side": request.side,
                "quantity": request.quantity,
                "order_type": request.order_type,
                "paper_session_id": request.paper_session_id,
                "no_live_order_until_submit": True,
            },
        )
        return BinanceExecutionIntentResponse.model_validate(row)

    def submit_intent(self, intent_id: str) -> BinanceExecutionIntentResponse:
        row = self.sqlite_store.get_binance_execution_intent(intent_id)
        if row is None:
            raise ValueError(f"Execution intent not found: {intent_id}")

        intent = BinanceExecutionIntentResponse.model_validate(row)
        if intent.status in {"submitted", "filled"}:
            decisions = [
                BinanceRiskDecision(
                    check="duplicate_order",
                    status="block",
                    message="Intent has already been submitted.",
                )
            ]
            return self._block_intent(intent, decisions)

        config = self.get_config()
        decisions = self._risk_decisions(intent, config)
        blocked = [decision for decision in decisions if decision.status == "block"]
        if blocked:
            return self._block_intent(intent, decisions)

        request = intent.request
        order_response = self.binance_provider.place_order(
            symbol=request.symbol,
            side=request.side,
            order_type=request.order_type,
            quantity=request.quantity,
            limit_price=request.limit_price,
            client_order_id=request.client_order_id,
        )
        now = _utc_now_iso()
        broker_order_id = str(order_response.get("orderId") or order_response.get("clientOrderId") or "")
        fills = self._fills_from_response(intent.intent_id, broker_order_id, order_response, request.symbol, request.side)
        order = BinanceLiveOrder(
            order_id=f"live-order-{uuid4().hex[:10]}",
            intent_id=intent.intent_id,
            created_at=now,
            symbol=request.symbol,
            side=request.side,
            quantity=request.quantity,
            order_type=request.order_type,
            limit_price=request.limit_price,
            status=str(order_response.get("status") or ("FILLED" if fills else "SUBMITTED")).lower(),
            broker_order_id=broker_order_id or None,
            broker_response=self._safe_broker_response(order_response),
        )
        ledger = self._ledger_from_fills(intent.intent_id, fills, request.symbol)
        intent.status = "filled" if fills else "submitted"
        intent.updated_at = now
        intent.risk_decisions = decisions
        intent.order = order
        intent.fills = fills
        intent.ledger = ledger
        intent.estimated_notional = intent.estimated_notional or sum(fill.notional for fill in fills)
        intent.audit_event_count += 1
        row = self.sqlite_store.update_binance_execution_intent(intent.model_dump(mode="json"))
        self._audit(
            event_type="intent_submitted",
            intent_id=intent.intent_id,
            strategy_run_id=request.strategy_run_id,
            summary=f"Submitted Binance execution intent {intent.intent_id}.",
            payload={
                "symbol": request.symbol,
                "status": intent.status,
                "broker_order_id": broker_order_id or None,
                "fill_count": len(fills),
                "no_secret_payload": True,
            },
        )
        self._security_audit(
            event_type="binance_intent_submitted",
            subject=intent.intent_id,
            summary=f"Submitted Binance execution intent {intent.intent_id}.",
            payload={
                "intent_id": intent.intent_id,
                "strategy_run_id": request.strategy_run_id,
                "symbol": request.symbol,
                "status": intent.status,
                "broker_order_id": broker_order_id or None,
                "fill_count": len(fills),
                "no_secret_payload": True,
            },
        )
        return BinanceExecutionIntentResponse.model_validate(row or intent.model_dump(mode="json"))

    def set_kill_switch(self, payload: BinanceKillSwitchRequest) -> BinanceExecutionConfig:
        scope_key = payload.strategy_run_id or "global"
        self.sqlite_store.put_binance_kill_switch(scope_key, payload.enabled, payload.reason)
        self._audit(
            event_type="kill_switch_updated",
            strategy_run_id=payload.strategy_run_id,
            summary=f"Binance execution kill switch {'enabled' if payload.enabled else 'disabled'} for {scope_key}.",
            payload={"scope_key": scope_key, "enabled": payload.enabled, "reason": payload.reason},
        )
        self._security_audit(
            event_type="binance_kill_switch_updated",
            subject=scope_key,
            summary=f"Binance execution kill switch {'enabled' if payload.enabled else 'disabled'} for {scope_key}.",
            payload={"scope_key": scope_key, "enabled": payload.enabled, "reason": payload.reason},
        )
        return self.get_config()

    def list_audit_events(self, limit: int = 50) -> list[BinanceExecutionAuditEvent]:
        return [
            BinanceExecutionAuditEvent.model_validate(item)
            for item in self.sqlite_store.list_binance_execution_audit_events(limit)
        ]

    def list_recent_intents(self, limit: int = 20) -> list[BinanceExecutionIntentResponse]:
        return [
            BinanceExecutionIntentResponse.model_validate(item)
            for item in self.sqlite_store.list_recent_binance_execution_intents(limit)
        ]

    def _risk_decisions(
        self,
        intent: BinanceExecutionIntentResponse,
        config: BinanceExecutionConfig,
    ) -> list[BinanceRiskDecision]:
        request = intent.request
        decisions: list[BinanceRiskDecision] = []

        def add(check: str, passed: bool, message: str, details: dict[str, Any] | None = None) -> None:
            decisions.append(
                BinanceRiskDecision(
                    check=check,
                    status="pass" if passed else "block",
                    message=message,
                    details=details or {},
                )
            )

        add("live_mode", config.live_enabled, "Live mode is enabled." if config.live_enabled else "Live mode is off by default.")
        add(
            "risk_acknowledgement",
            config.risk_acknowledged,
            "Risk acknowledgement is recorded." if config.risk_acknowledged else "Risk acknowledgement is required.",
        )
        add(
            "credentials",
            self.binance_provider.is_configured,
            "Binance credentials are configured." if self.binance_provider.is_configured else "Binance credentials are missing.",
        )
        add(
            "global_kill_switch",
            not self._kill_switch_enabled("global"),
            "Global kill switch is clear." if not self._kill_switch_enabled("global") else "Global kill switch is enabled.",
        )
        if request.strategy_run_id:
            add(
                "strategy_kill_switch",
                not self._kill_switch_enabled(request.strategy_run_id),
                "Strategy kill switch is clear."
                if not self._kill_switch_enabled(request.strategy_run_id)
                else f"Strategy kill switch is enabled for {request.strategy_run_id}.",
            )

        if not all(decision.status == "pass" for decision in decisions):
            return decisions

        allowed = _normalize_symbol(request.symbol) in {_normalize_symbol(item) for item in config.allowlist}
        add("symbol_allowlist", allowed, f"{request.symbol} is allowlisted." if allowed else f"{request.symbol} is not allowlisted.")

        price, quote_age_seconds = self._quote_context(request.symbol, request.limit_price)
        intent.estimated_price = price
        intent.estimated_notional = _round_money(price * request.quantity)
        add(
            "stale_data",
            quote_age_seconds is not None and quote_age_seconds <= config.stale_quote_seconds,
            "Quote freshness is within the configured limit."
            if quote_age_seconds is not None and quote_age_seconds <= config.stale_quote_seconds
            else "Quote is missing or stale.",
            {"quote_age_seconds": quote_age_seconds, "stale_quote_seconds": config.stale_quote_seconds},
        )
        add(
            "max_order_notional",
            intent.estimated_notional <= config.max_order_notional,
            f"Order notional {intent.estimated_notional} is within limit {config.max_order_notional}."
            if intent.estimated_notional <= config.max_order_notional
            else f"Order notional {intent.estimated_notional} exceeds limit {config.max_order_notional}.",
        )

        if config.require_paper_session:
            paper_ok = bool(request.paper_session_id and self.sqlite_store.get_strategy_paper_session(request.paper_session_id))
            add(
                "paper_evidence",
                paper_ok,
                "Paper session evidence is linked." if paper_ok else "A valid paper session is required before live submit.",
                {"paper_session_id": request.paper_session_id},
            )

        if request.client_order_id:
            duplicate = self.sqlite_store.has_duplicate_binance_client_order(request.client_order_id, intent.intent_id)
            add(
                "duplicate_order",
                not duplicate,
                "Client order id is unique." if not duplicate else "Client order id was already submitted.",
            )

        if not all(decision.status == "pass" for decision in decisions):
            return decisions

        provider_ok, provider_message = self.binance_provider.test_private_connection()
        add("provider_available", provider_ok, provider_message)
        if not provider_ok:
            return decisions

        start_of_day = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        daily_turnover = self.sqlite_store.sum_binance_live_notional_since(start_of_day)
        next_turnover = daily_turnover + float(intent.estimated_notional or 0.0)
        add(
            "max_daily_turnover",
            next_turnover <= config.max_daily_turnover,
            f"Daily turnover {next_turnover:.2f} is within limit {config.max_daily_turnover:.2f}."
            if next_turnover <= config.max_daily_turnover
            else f"Daily turnover {next_turnover:.2f} exceeds limit {config.max_daily_turnover:.2f}.",
        )

        account = self.binance_provider.get_account_snapshot()
        balances = {item.asset.upper(): item.free for item in account.balances}
        quote = _quote_asset(request.symbol).upper()
        base = _base_asset(request.symbol).upper()
        if request.side == "buy":
            available = float(balances.get(quote, 0.0))
            balance_ok = available >= float(intent.estimated_notional or 0.0)
            add(
                "balance_cash",
                balance_ok,
                f"{quote} free balance covers estimated notional."
                if balance_ok
                else f"{quote} free balance is below estimated notional.",
                {"asset": quote, "available": available, "required": intent.estimated_notional},
            )
        else:
            available = float(balances.get(base, 0.0))
            balance_ok = available >= request.quantity
            add(
                "balance_cash",
                balance_ok,
                f"{base} free balance covers sell quantity." if balance_ok else f"{base} free balance is below sell quantity.",
                {"asset": base, "available": available, "required": request.quantity},
            )

        account_value = max(float(balances.get(quote, 0.0)) + float(intent.estimated_notional or 0.0), 1.0)
        weight = float(intent.estimated_notional or 0.0) / account_value
        add(
            "max_position_weight",
            weight <= config.max_position_weight,
            f"Estimated position weight {weight:.2%} is within limit {config.max_position_weight:.2%}."
            if weight <= config.max_position_weight
            else f"Estimated position weight {weight:.2%} exceeds limit {config.max_position_weight:.2%}.",
            {"estimated_weight": weight, "max_position_weight": config.max_position_weight},
        )
        return decisions

    def _block_intent(
        self,
        intent: BinanceExecutionIntentResponse,
        decisions: list[BinanceRiskDecision],
    ) -> BinanceExecutionIntentResponse:
        intent.status = "blocked"
        intent.updated_at = _utc_now_iso()
        intent.risk_decisions = decisions
        intent.audit_event_count += 1
        row = self.sqlite_store.update_binance_execution_intent(intent.model_dump(mode="json"))
        blocked = [decision.check for decision in decisions if decision.status == "block"]
        self._audit(
            event_type="intent_blocked",
            intent_id=intent.intent_id,
            strategy_run_id=intent.request.strategy_run_id,
            summary=f"Blocked Binance execution intent {intent.intent_id}.",
            payload={"blocked_checks": blocked, "no_binance_order_request": True},
        )
        self._security_audit(
            event_type="binance_intent_blocked",
            subject=intent.intent_id,
            summary=f"Blocked Binance execution intent {intent.intent_id}.",
            payload={
                "intent_id": intent.intent_id,
                "strategy_run_id": intent.request.strategy_run_id,
                "symbol": intent.request.symbol,
                "blocked_checks": blocked,
                "no_binance_order_request": True,
            },
        )
        return BinanceExecutionIntentResponse.model_validate(row or intent.model_dump(mode="json"))

    def _quote_context(self, symbol: str, limit_price: float | None) -> tuple[float, int | None]:
        if limit_price:
            price = float(limit_price)
        else:
            workspace = self.asset_service.get_asset_workspace(symbol)
            price = float(workspace.quote.price)
        workspace = self.asset_service.get_asset_workspace(symbol)
        as_of = _parse_iso(getattr(workspace.quote, "as_of", None))
        if as_of is None:
            return price, None
        if as_of.tzinfo is None:
            as_of = as_of.replace(tzinfo=UTC)
        age = datetime.now(UTC) - as_of
        return price, max(0, int(age.total_seconds()))

    def _fills_from_response(
        self,
        intent_id: str,
        order_id: str,
        response: dict[str, Any],
        symbol: str,
        side: str,
    ) -> list[BinanceLiveFill]:
        rows = response.get("fills")
        fills: list[BinanceLiveFill] = []
        if isinstance(rows, list):
            for row in rows:
                price = float(row.get("price") or 0.0)
                quantity = float(row.get("qty") or row.get("quantity") or 0.0)
                fills.append(
                    BinanceLiveFill(
                        fill_id=f"live-fill-{uuid4().hex[:10]}",
                        order_id=order_id or str(response.get("orderId") or ""),
                        intent_id=intent_id,
                        filled_at=_utc_now_iso(),
                        symbol=symbol,
                        side=side,  # type: ignore[arg-type]
                        quantity=quantity,
                        price=price,
                        notional=_round_money(price * quantity),
                        fee=float(row.get("commission") or 0.0),
                        fee_asset=row.get("commissionAsset"),
                    )
                )
        return fills

    def _ledger_from_fills(self, intent_id: str, fills: list[BinanceLiveFill], symbol: str) -> list[BinanceLiveLedgerEntry]:
        base = _base_asset(symbol)
        quote = _quote_asset(symbol)
        ledger: list[BinanceLiveLedgerEntry] = []
        for fill in fills:
            sign = 1 if fill.side == "buy" else -1
            ledger.append(
                BinanceLiveLedgerEntry(
                    entry_id=f"live-ledger-{uuid4().hex[:10]}",
                    intent_id=intent_id,
                    timestamp=fill.filled_at,
                    event=f"{fill.side}_{base}",
                    asset=base,
                    amount=round(sign * fill.quantity, 8),
                )
            )
            ledger.append(
                BinanceLiveLedgerEntry(
                    entry_id=f"live-ledger-{uuid4().hex[:10]}",
                    intent_id=intent_id,
                    timestamp=fill.filled_at,
                    event=f"{fill.side}_{quote}",
                    asset=quote,
                    amount=_round_money(-sign * fill.notional),
                )
            )
        return ledger

    def _safe_broker_response(self, response: dict[str, Any]) -> dict[str, Any]:
        allowed = {"symbol", "orderId", "clientOrderId", "transactTime", "price", "origQty", "executedQty", "status", "type", "side"}
        return {key: value for key, value in response.items() if key in allowed}

    def _kill_switch_enabled(self, scope_key: str) -> bool:
        state = self.sqlite_store.get_binance_kill_switch(scope_key)
        return bool(state and state.get("enabled"))

    def _config_notes(self, payload: dict[str, Any]) -> list[str]:
        notes = ["Live mode is default-off and Binance-only."]
        if not payload.get("live_enabled"):
            notes.append("Submit is blocked until live mode is explicitly enabled.")
        if not payload.get("risk_acknowledged"):
            notes.append("Risk acknowledgement is required before any broker request.")
        if not self.binance_provider.is_configured:
            notes.append("Binance credentials are not configured in the local secret store.")
        if self._kill_switch_enabled("global"):
            notes.append("Global execution kill switch is enabled.")
        return notes

    def _audit(
        self,
        *,
        event_type: str,
        summary: str,
        intent_id: str | None = None,
        strategy_run_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        event = BinanceExecutionAuditEvent(
            event_id=f"audit-{uuid4().hex[:12]}",
            created_at=_utc_now_iso(),
            event_type=event_type,
            intent_id=intent_id,
            strategy_run_id=strategy_run_id,
            summary=summary,
            payload=payload or {},
        )
        self.sqlite_store.create_binance_execution_audit_event(event.model_dump(mode="json"))

    def _security_audit(
        self,
        *,
        event_type: str,
        summary: str,
        subject: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        if self.security_audit_service is None:
            return
        self.security_audit_service.record(
            category="execution",
            event_type=event_type,
            subject=subject,
            summary=summary,
            payload=payload or {},
        )
