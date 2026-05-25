from __future__ import annotations

from copy import deepcopy
from typing import Any


class ConnectorScenarioError(RuntimeError):
    pass


ASHARE_STOCK_BASIC_FIXTURE: list[dict[str, Any]] = [
    {
        "ts_code": "600519.SH",
        "name": "Kweichow Moutai",
        "area": "Guizhou",
        "industry": "Beverages",
        "market": "Main Board",
        "list_date": "20010827",
    },
    {
        "ts_code": "000001.SZ",
        "name": "Ping An Bank",
        "area": "Shenzhen",
        "industry": "Banking",
        "market": "Main Board",
        "list_date": "19910403",
    },
    {
        "ts_code": "300750.SZ",
        "name": "CATL",
        "area": "Fujian",
        "industry": "Battery",
        "market": "ChiNext",
        "list_date": "20180611",
    },
]

ASHARE_DAILY_FIXTURE: dict[str, dict[str, Any]] = {
    "600519.SH": {
        "ts_code": "600519.SH",
        "trade_date": "20260522",
        "open": 1580.0,
        "high": 1608.5,
        "low": 1571.2,
        "close": 1596.8,
        "pre_close": 1584.0,
        "change": 12.8,
        "pct_chg": 0.81,
        "vol": 23456.0,
        "amount": 3742000.0,
    },
    "000001.SZ": {
        "ts_code": "000001.SZ",
        "trade_date": "20260522",
        "open": 11.12,
        "high": 11.28,
        "low": 11.05,
        "close": 11.23,
        "pre_close": 11.08,
        "change": 0.15,
        "pct_chg": 1.35,
        "vol": 458000.0,
        "amount": 512300.0,
    },
    "300750.SZ": {
        "ts_code": "300750.SZ",
        "trade_date": "20260522",
        "open": 188.4,
        "high": 192.7,
        "low": 186.2,
        "close": 191.5,
        "pre_close": 187.9,
        "change": 3.6,
        "pct_chg": 1.92,
        "vol": 89120.0,
        "amount": 1699000.0,
    },
}

HKMA_MONETARY_FIXTURE: list[dict[str, Any]] = [
    {
        "end_of_month": "2026-02",
        "monetary_base_total": 1932480.0,
        "m3_hkd": 8765400.0,
        "exrate_hkd_usd": 7.82,
        "hibor_fixing_3m": 4.25,
    },
    {
        "end_of_month": "2026-03",
        "monetary_base_total": 1941160.0,
        "m3_hkd": 8791200.0,
        "exrate_hkd_usd": 7.83,
        "hibor_fixing_3m": 4.18,
    },
    {
        "end_of_month": "2026-04",
        "monetary_base_total": 1950440.0,
        "m3_hkd": 8810300.0,
        "exrate_hkd_usd": 7.84,
        "hibor_fixing_3m": 4.07,
    },
]


class ConnectorFixtureHarness:
    def __init__(self, *, allowed: bool) -> None:
        self.allowed = allowed

    def assert_allowed(self, scenario: str | None) -> None:
        if scenario and not self.allowed:
            raise ConnectorScenarioError("Connector fixture scenarios are only available in test or packaged smoke mode.")

    def maybe_raise(self, scenario: str | None) -> None:
        self.assert_allowed(scenario)
        if scenario == "timeout":
            raise TimeoutError("connector_fixture_timeout")
        if scenario == "malformed_response":
            raise ConnectorScenarioError("connector_fixture_malformed_response")

    def license_blocked(self, scenario: str | None) -> bool:
        self.assert_allowed(scenario)
        return scenario == "license_blocked"

    def stock_basic_rows(self, *, query: str = "", symbol: str | None = None) -> list[dict[str, Any]]:
        normalized_query = query.strip().upper()
        rows = deepcopy(ASHARE_STOCK_BASIC_FIXTURE)
        if symbol:
            return [row for row in rows if row["ts_code"].upper() == symbol.upper()]
        if not normalized_query:
            return rows
        return [
            row
            for row in rows
            if normalized_query in row["ts_code"].upper() or normalized_query in row["name"].upper()
        ]

    def daily_row(self, symbol: str) -> dict[str, Any]:
        try:
            return deepcopy(ASHARE_DAILY_FIXTURE[symbol.upper()])
        except KeyError as exc:
            raise ConnectorScenarioError(f"No fixture quote is registered for {symbol}.") from exc

    def hkma_rows(self) -> list[dict[str, Any]]:
        return deepcopy(HKMA_MONETARY_FIXTURE)
