from __future__ import annotations

import hashlib
import hmac
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlencode

import requests

from ..models import BinanceAccountSnapshot, BinanceBalanceItem
from ..runtime import RuntimeSettings


class BinanceProvider:
    base_url = "https://api.binance.com"

    def __init__(self, settings: RuntimeSettings) -> None:
        self.api_key = settings.binance_api_key
        self.secret = settings.binance_secret
        self.password = settings.binance_password
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "Pengbo Workbench/0.1"})

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.secret)

    @property
    def credential_summary(self) -> str | None:
        if not any([self.api_key, self.secret, self.password]):
            return None

        api_key = self.api_key or "missing"
        if self.api_key and len(self.api_key) > 8:
            api_key = f"{self.api_key[:4]}...{self.api_key[-4:]}"
        elif self.api_key:
            api_key = f"{self.api_key[:2]}...{self.api_key[-2:]}"

        password_status = "stored" if self.password else "not set"
        secret_status = "stored" if self.secret else "missing"
        return f"API key {api_key}; secret {secret_status}; password {password_status}"

    def _normalize_symbol(self, symbol: str) -> str:
        return symbol.replace("/", "").upper()

    def _request(
        self,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        private: bool = False,
        method: str = "GET",
    ) -> Any:
        params = dict(params or {})
        headers: dict[str, str] = {}
        method = method.upper()

        if private:
            if not self.is_configured or not self.secret:
                raise ValueError("Binance credentials are not configured.")
            params.setdefault("recvWindow", 5_000)
            params["timestamp"] = int(time.time() * 1000)
            query = urlencode(params, doseq=True)
            signature = hmac.new(
                self.secret.encode("utf-8"),
                query.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
            url = f"{self.base_url}{path}?{query}&signature={signature}"
            headers["X-MBX-APIKEY"] = self.api_key or ""
            if method == "POST":
                response = self.session.post(url, headers=headers, timeout=20)
            else:
                response = self.session.get(url, headers=headers, timeout=20)
        else:
            response = self.session.get(
                f"{self.base_url}{path}",
                params=params,
                timeout=20,
            )

        try:
            response.raise_for_status()
        except requests.HTTPError as error:
            detail = response.text
            try:
                payload = response.json()
            except ValueError:
                payload = None
            if isinstance(payload, dict):
                detail = payload.get("msg") or payload.get("message") or detail
            raise RuntimeError(f"Binance request failed: {detail}") from error

        payload = response.json()
        if isinstance(payload, dict) and "code" in payload and "msg" in payload:
            raise RuntimeError(f"Binance request failed: {payload['msg']}")
        return payload

    def _totals(self, balance: dict[str, Any]) -> dict[str, float]:
        totals: dict[str, float] = {}
        for item in balance.get("balances", []):
            asset = str(item.get("asset") or "").upper()
            free = float(item.get("free") or 0.0)
            locked = float(item.get("locked") or 0.0)
            total = free + locked
            if asset and total > 0:
                totals[asset] = total
        return totals

    def get_public_quote(self, symbol: str) -> dict[str, Any]:
        ticker = self._request(
            "/api/v3/ticker/24hr",
            params={"symbol": self._normalize_symbol(symbol)},
        )
        close = float(ticker["lastPrice"])
        change = float(ticker.get("priceChange") or 0.0)
        percentage = float(ticker.get("priceChangePercent") or 0.0)
        return {
            "symbol": symbol,
            "price": close,
            "change": change,
            "change_pct": percentage,
            "currency": symbol.split("/")[-1],
            "provider": "ccxt:binance",
            "as_of": datetime.now(UTC).isoformat(),
        }

    def get_public_history(self, symbol: str, limit: int = 365, interval: str = "1d") -> list[dict[str, Any]]:
        rows = self._request(
            "/api/v3/klines",
            params={
                "symbol": self._normalize_symbol(symbol),
                "interval": interval,
                "limit": limit,
            },
        )
        return [
            {
                "timestamp": datetime.fromtimestamp(row[0] / 1000, tz=UTC).date().isoformat(),
                "open": float(row[1]),
                "high": float(row[2]),
                "low": float(row[3]),
                "close": float(row[4]),
                "volume": float(row[5]),
            }
            for row in rows
        ]

    def test_private_connection(self) -> tuple[bool, str]:
        if not self.is_configured:
            return False, "Binance credentials are not configured."
        balance = self._request("/api/v3/account", private=True)
        non_zero = [
            asset
            for asset, total in self._totals(balance).items()
            if total > 0
        ]
        return True, f"Binance connection succeeded with {len(non_zero)} non-zero assets."

    def get_account_snapshot(self) -> BinanceAccountSnapshot:
        if not self.is_configured:
            raise ValueError("Binance credentials are not configured.")

        balance = self._request("/api/v3/account", private=True)
        totals = self._totals(balance)
        free = {
            item["asset"]: float(item.get("free") or 0.0)
            for item in balance.get("balances", [])
        }
        used = {
            item["asset"]: float(item.get("locked") or 0.0)
            for item in balance.get("balances", [])
        }

        items = [
            BinanceBalanceItem(
                asset=asset,
                free=float(free.get(asset) or 0.0),
                used=float(used.get(asset) or 0.0),
                total=float(total_amount),
            )
            for asset, total_amount in totals.items()
            if total_amount and float(total_amount) > 0
        ]
        items.sort(key=lambda item: item.total, reverse=True)
        return BinanceAccountSnapshot(
            updated_at=datetime.now(UTC).isoformat(),
            stale=False,
            exchange="Binance",
            balances=items[:20],
            total_assets=len(items),
        )

    def place_order(
        self,
        *,
        symbol: str,
        side: str,
        order_type: str,
        quantity: float,
        limit_price: float | None = None,
        client_order_id: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {
            "symbol": self._normalize_symbol(symbol),
            "side": side.upper(),
            "type": order_type.upper(),
            "quantity": quantity,
        }
        if client_order_id:
            params["newClientOrderId"] = client_order_id
        if order_type.lower() == "limit":
            if limit_price is None:
                raise ValueError("Limit orders require a limit price.")
            params["price"] = limit_price
            params["timeInForce"] = "GTC"
        response = self._request("/api/v3/order", params=params, private=True, method="POST")
        if not isinstance(response, dict):
            raise RuntimeError("Binance order response was not an object.")
        return response
