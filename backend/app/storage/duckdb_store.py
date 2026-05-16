from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any

import duckdb


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class DuckDbStore:
    def __init__(self, database_path: Path) -> None:
        self._lock = RLock()
        self.connection = duckdb.connect(str(database_path))

    def close(self) -> None:
        with self._lock:
            self.connection.close()

    def initialize(self) -> None:
        with self._lock:
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS quote_snapshots (
                    symbol VARCHAR,
                    provider VARCHAR,
                    fetched_at TIMESTAMP,
                    price DOUBLE,
                    change DOUBLE,
                    change_pct DOUBLE,
                    currency VARCHAR,
                    payload_json VARCHAR
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS price_bars (
                    symbol VARCHAR,
                    interval VARCHAR,
                    timestamp TIMESTAMP,
                    open DOUBLE,
                    high DOUBLE,
                    low DOUBLE,
                    close DOUBLE,
                    volume DOUBLE,
                    provider VARCHAR,
                    fetched_at TIMESTAMP
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS fundamental_snapshots (
                    symbol VARCHAR,
                    snapshot_kind VARCHAR,
                    provider VARCHAR,
                    fetched_at TIMESTAMP,
                    payload_json VARCHAR
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS filing_index (
                    symbol VARCHAR,
                    form_type VARCHAR,
                    filed_at DATE,
                    headline VARCHAR,
                    status VARCHAR,
                    provider VARCHAR,
                    fetched_at TIMESTAMP,
                    payload_json VARCHAR
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS binance_account_snapshots (
                    account_label VARCHAR,
                    provider VARCHAR,
                    fetched_at TIMESTAMP,
                    payload_json VARCHAR
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS factor_snapshots (
                    run_id VARCHAR,
                    universe_source VARCHAR,
                    asset_type VARCHAR,
                    family VARCHAR,
                    as_of TIMESTAMP,
                    evaluated_count INTEGER,
                    result_count INTEGER,
                    source_timestamps_json VARCHAR,
                    diagnostics_json VARCHAR,
                    results_json VARCHAR,
                    payload_json VARCHAR
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS strategy_backtest_snapshots (
                    run_id VARCHAR,
                    template_key VARCHAR,
                    factor_run_id VARCHAR,
                    created_at TIMESTAMP,
                    top_n INTEGER,
                    initial_capital DOUBLE,
                    total_return_pct DOUBLE,
                    max_drawdown_pct DOUBLE,
                    request_json VARCHAR,
                    factor_context_json VARCHAR,
                    data_window_json VARCHAR,
                    equity_curve_json VARCHAR,
                    trades_json VARCHAR,
                    metrics_json VARCHAR,
                    diagnostics_json VARCHAR,
                    payload_json VARCHAR
                )
                """
            )
            self.connection.execute(
                """
                CREATE TABLE IF NOT EXISTS data_source_snapshots (
                    provider VARCHAR,
                    cache_key VARCHAR,
                    fetched_at TIMESTAMP,
                    payload_json VARCHAR,
                    PRIMARY KEY (provider, cache_key)
                )
                """
            )

    def get_data_source_snapshot(self, provider: str, cache_key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM data_source_snapshots
                WHERE provider = ? AND cache_key = ?
                """,
                [provider, cache_key],
            ).fetchone()
        return None if row is None else json.loads(row[0])

    def get_latest_data_source_fetched_at(self, provider: str) -> str | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT MAX(fetched_at)
                FROM data_source_snapshots
                WHERE provider = ?
                """,
                [provider],
            ).fetchone()
        value = None if row is None else row[0]
        return None if value is None else value.isoformat()

    def put_data_source_snapshot(self, provider: str, cache_key: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self.connection.execute(
                "DELETE FROM data_source_snapshots WHERE provider = ? AND cache_key = ?",
                [provider, cache_key],
            )
            self.connection.execute(
                """
                INSERT INTO data_source_snapshots (provider, cache_key, fetched_at, payload_json)
                VALUES (?, ?, ?, ?)
                """,
                [provider, cache_key, utc_now_iso(), json.dumps(payload, ensure_ascii=False)],
            )

    def get_latest_quote_snapshot(self, symbol: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM quote_snapshots
                WHERE symbol = ?
                ORDER BY fetched_at DESC
                LIMIT 1
                """,
                [symbol],
            ).fetchone()
        return None if row is None else json.loads(row[0])

    def put_quote_snapshot(self, symbol: str, provider: str, payload: dict[str, Any]) -> None:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO quote_snapshots (symbol, provider, fetched_at, price, change, change_pct, currency, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    symbol,
                    provider,
                    utc_now_iso(),
                    payload["price"],
                    payload["change"],
                    payload["change_pct"],
                    payload["currency"],
                    json.dumps(payload, ensure_ascii=False),
                ],
            )

    def get_latest_price_history(self, symbol: str, interval: str) -> list[dict[str, Any]] | None:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT timestamp, open, high, low, close, volume
                FROM price_bars
                WHERE symbol = ? AND interval = ?
                ORDER BY timestamp ASC
                """,
                [symbol, interval],
            ).fetchall()
        if not rows:
            return None

        return [
            {
                "timestamp": row[0].isoformat() if getattr(row[0], "time", lambda: None)() and row[0].time().isoformat() != "00:00:00" else row[0].date().isoformat(),
                "open": row[1],
                "high": row[2],
                "low": row[3],
                "close": row[4],
                "volume": row[5],
            }
            for row in rows
        ]

    def replace_price_history(
        self,
        symbol: str,
        interval: str,
        provider: str,
        points: list[dict[str, Any]],
    ) -> None:
        with self._lock:
            self.connection.execute(
                "DELETE FROM price_bars WHERE symbol = ? AND interval = ?",
                [symbol, interval],
            )
            if points:
                self.connection.executemany(
                    """
                    INSERT INTO price_bars (
                        symbol, interval, timestamp, open, high, low, close, volume, provider, fetched_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            symbol,
                            interval,
                            point["timestamp"],
                            point.get("open"),
                            point.get("high"),
                            point.get("low"),
                            point["close"],
                            point["volume"],
                            provider,
                            utc_now_iso(),
                        )
                        for point in points
                    ],
                )

    def get_latest_fundamental_snapshot(
        self,
        symbol: str,
        snapshot_kind: str,
    ) -> dict[str, Any] | list[dict[str, Any]] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM fundamental_snapshots
                WHERE symbol = ? AND snapshot_kind = ?
                ORDER BY fetched_at DESC
                LIMIT 1
                """,
                [symbol, snapshot_kind],
            ).fetchone()
        return None if row is None else json.loads(row[0])

    def put_fundamental_snapshot(
        self,
        symbol: str,
        snapshot_kind: str,
        provider: str,
        payload: dict[str, Any] | list[dict[str, Any]],
    ) -> None:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO fundamental_snapshots (symbol, snapshot_kind, provider, fetched_at, payload_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                [symbol, snapshot_kind, provider, utc_now_iso(), json.dumps(payload, ensure_ascii=False)],
            )

    def get_latest_filings(self, symbol: str) -> list[dict[str, Any]] | None:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT payload_json
                FROM filing_index
                WHERE symbol = ?
                ORDER BY filed_at DESC
                """,
                [symbol],
            ).fetchall()
        return None if not rows else [json.loads(row[0]) for row in rows]

    def replace_filings(self, symbol: str, provider: str, filings: list[dict[str, Any]]) -> None:
        with self._lock:
            self.connection.execute("DELETE FROM filing_index WHERE symbol = ?", [symbol])
            if filings:
                self.connection.executemany(
                    """
                    INSERT INTO filing_index (
                        symbol, form_type, filed_at, headline, status, provider, fetched_at, payload_json
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            symbol,
                            filing["type"],
                            filing["filed_at"],
                            filing["headline"],
                            filing["status"],
                            provider,
                            utc_now_iso(),
                            json.dumps(filing, ensure_ascii=False),
                        )
                        for filing in filings
                    ],
                )

    def get_latest_binance_account_snapshot(self) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM binance_account_snapshots
                ORDER BY fetched_at DESC
                LIMIT 1
                """
            ).fetchone()
        return None if row is None else json.loads(row[0])

    def get_latest_binance_account_snapshot_fetched_at(self) -> str | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT fetched_at
                FROM binance_account_snapshots
                ORDER BY fetched_at DESC
                LIMIT 1
                """
            ).fetchone()
        if row is None or row[0] is None:
            return None
        return row[0].replace(tzinfo=UTC).isoformat() if row[0].tzinfo is None else row[0].astimezone(UTC).isoformat()

    def get_latest_filings_fetched_at(self, symbol: str) -> str | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT MAX(fetched_at)
                FROM filing_index
                WHERE symbol = ?
                """,
                [symbol],
            ).fetchone()
        if row is None or row[0] is None:
            return None
        return row[0].replace(tzinfo=UTC).isoformat() if row[0].tzinfo is None else row[0].astimezone(UTC).isoformat()

    def put_binance_account_snapshot(self, payload: dict[str, Any]) -> None:
        fetched_at = utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO binance_account_snapshots (account_label, provider, fetched_at, payload_json)
                VALUES (?, ?, ?, ?)
                """,
                ["default", "ccxt:binance", fetched_at, json.dumps(payload, ensure_ascii=False)],
            )

    def put_factor_snapshot(self, payload: dict[str, Any]) -> None:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO factor_snapshots (
                    run_id,
                    universe_source,
                    asset_type,
                    family,
                    as_of,
                    evaluated_count,
                    result_count,
                    source_timestamps_json,
                    diagnostics_json,
                    results_json,
                    payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    payload["run_id"],
                    payload["universe_source"],
                    payload["asset_type"],
                    payload["family"],
                    payload["as_of"],
                    int(payload["evaluated_count"]),
                    int(payload["result_count"]),
                    json.dumps(payload.get("source_timestamps", {}), ensure_ascii=False),
                    json.dumps(payload.get("diagnostics", {}), ensure_ascii=False),
                    json.dumps(payload.get("results", []), ensure_ascii=False),
                    json.dumps(payload, ensure_ascii=False),
                ],
            )

    def get_factor_snapshot(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM factor_snapshots
                WHERE run_id = ?
                ORDER BY as_of DESC
                LIMIT 1
                """,
                [run_id],
            ).fetchone()
        return None if row is None else json.loads(row[0])

    def list_recent_factor_snapshots(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT
                    run_id,
                    universe_source,
                    asset_type,
                    family,
                    as_of,
                    evaluated_count,
                    result_count,
                    diagnostics_json
                FROM factor_snapshots
                ORDER BY as_of DESC, run_id DESC
                LIMIT ?
                """,
                [limit],
            ).fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            as_of = row[4]
            if hasattr(as_of, "replace"):
                as_of = as_of.replace(tzinfo=UTC).isoformat() if as_of.tzinfo is None else as_of.astimezone(UTC).isoformat()
            items.append(
                {
                    "run_id": row[0],
                    "universe_source": row[1],
                    "asset_type": row[2],
                    "family": row[3],
                    "as_of": str(as_of),
                    "evaluated_count": int(row[5]),
                    "result_count": int(row[6]),
                    "diagnostics": json.loads(row[7] or "{}"),
                }
            )
        return items

    def put_strategy_backtest_snapshot(self, payload: dict[str, Any]) -> None:
        metric_lookup = {
            item.get("label"): item.get("value")
            for item in payload.get("metrics", [])
            if isinstance(item, dict)
        }
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO strategy_backtest_snapshots (
                    run_id,
                    template_key,
                    factor_run_id,
                    created_at,
                    top_n,
                    initial_capital,
                    total_return_pct,
                    max_drawdown_pct,
                    request_json,
                    factor_context_json,
                    data_window_json,
                    equity_curve_json,
                    trades_json,
                    metrics_json,
                    diagnostics_json,
                    payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    payload["run_id"],
                    payload["template_key"],
                    payload["factor_run_id"],
                    payload["created_at"],
                    int(payload.get("request", {}).get("topN", payload.get("request", {}).get("top_n", 0))),
                    float(payload.get("request", {}).get("initialCapital", payload.get("request", {}).get("initial_capital", 0))),
                    metric_lookup.get("Total return"),
                    metric_lookup.get("Max drawdown"),
                    json.dumps(payload.get("request", {}), ensure_ascii=False),
                    json.dumps(payload.get("factor_context", {}), ensure_ascii=False),
                    json.dumps(payload.get("data_window", {}), ensure_ascii=False),
                    json.dumps(payload.get("equity_curve", []), ensure_ascii=False),
                    json.dumps(payload.get("trades", []), ensure_ascii=False),
                    json.dumps(payload.get("metrics", []), ensure_ascii=False),
                    json.dumps(payload.get("diagnostics", {}), ensure_ascii=False),
                    json.dumps(payload, ensure_ascii=False),
                ],
            )

    def get_strategy_backtest_snapshot(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM strategy_backtest_snapshots
                WHERE run_id = ?
                ORDER BY created_at DESC
                LIMIT 1
                """,
                [run_id],
            ).fetchone()
        return None if row is None else json.loads(row[0])

    def list_recent_strategy_backtest_snapshots(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT
                    run_id,
                    template_key,
                    factor_run_id,
                    created_at,
                    top_n,
                    initial_capital,
                    total_return_pct,
                    max_drawdown_pct,
                    diagnostics_json
                FROM strategy_backtest_snapshots
                ORDER BY created_at DESC, run_id DESC
                LIMIT ?
                """,
                [limit],
            ).fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            created_at = row[3]
            if hasattr(created_at, "replace"):
                created_at = (
                    created_at.replace(tzinfo=UTC).isoformat()
                    if created_at.tzinfo is None
                    else created_at.astimezone(UTC).isoformat()
                )
            diagnostics = json.loads(row[8] or "{}")
            items.append(
                {
                    "run_id": row[0],
                    "template_key": row[1],
                    "factor_run_id": row[2],
                    "created_at": str(created_at),
                    "top_n": int(row[4]),
                    "initial_capital": float(row[5]),
                    "total_return_pct": row[6],
                    "max_drawdown_pct": row[7],
                    "warning_count": len(diagnostics.get("warnings", [])),
                }
            )
        return items
