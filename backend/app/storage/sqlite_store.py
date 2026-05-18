from __future__ import annotations

import json
import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from threading import RLock
from typing import Any

from ..data_seed import DEFAULT_SCREENERS, DEFAULT_WATCHLIST
from ..screener_profiles import default_variant_seed


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()


class SqliteStore:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self._lock = RLock()
        self.connection = sqlite3.connect(database_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row

    def close(self) -> None:
        with self._lock:
            self.connection.close()

    def _migrate_connection_profiles_to_account_scope(self) -> None:
        columns = {
            row["name"]
            for row in self.connection.execute("PRAGMA table_info(connection_profiles)").fetchall()
        }
        if "profile_id" in columns:
            return

        now = utc_now_iso()
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS connection_profiles_v2 (
                profile_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                is_configured INTEGER NOT NULL,
                metadata_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (profile_id, provider),
                FOREIGN KEY (profile_id) REFERENCES credential_profiles(profile_id) ON DELETE CASCADE
            )
            """
        )
        self.connection.execute(
            """
            INSERT OR REPLACE INTO connection_profiles_v2 (
                profile_id, provider, is_configured, metadata_json, updated_at
            )
            SELECT 'local_default', provider, is_configured, metadata_json, updated_at
            FROM connection_profiles
            """
        )
        self.connection.execute("DROP TABLE connection_profiles")
        self.connection.execute("ALTER TABLE connection_profiles_v2 RENAME TO connection_profiles")
        self.connection.execute(
            """
            INSERT INTO credential_profiles (profile_id, label, is_active, created_at, updated_at)
            VALUES ('local_default', 'Local default', 1, ?, ?)
            ON CONFLICT(profile_id) DO NOTHING
            """,
            (now, now),
        )

    def initialize(self) -> None:
        with self._lock:
            self.connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS watchlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    is_default INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS watchlist_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    watchlist_id INTEGER NOT NULL,
                    symbol TEXT NOT NULL,
                    sort_index INTEGER NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE (watchlist_id, symbol),
                    FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS screener_presets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    preset_key TEXT NOT NULL UNIQUE,
                    title TEXT NOT NULL,
                    badge TEXT NOT NULL,
                    description TEXT NOT NULL,
                    filters_json TEXT NOT NULL,
                    asset_type TEXT NOT NULL,
                    hit_count INTEGER NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS screener_preset_variants (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    variant_key TEXT NOT NULL,
                    preset_key TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    tuning_json TEXT NOT NULL,
                    filters_json TEXT NOT NULL,
                    is_system_default INTEGER NOT NULL DEFAULT 0,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    last_hit_count INTEGER NOT NULL DEFAULT 0,
                    updated_at TEXT NOT NULL,
                    UNIQUE (preset_key, variant_key),
                    UNIQUE (preset_key, name),
                    FOREIGN KEY (preset_key) REFERENCES screener_presets(preset_key) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS portfolio_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    symbol TEXT NOT NULL,
                    side TEXT NOT NULL,
                    quantity REAL NOT NULL,
                    price REAL NOT NULL,
                    fees REAL NOT NULL DEFAULT 0,
                    traded_at TEXT NOT NULL,
                    notes TEXT
                );

                CREATE TABLE IF NOT EXISTS research_briefs (
                    brief_id TEXT PRIMARY KEY,
                    symbol TEXT NOT NULL,
                    title TEXT NOT NULL,
                    snapshot_json TEXT NOT NULL,
                    notes_markdown TEXT NOT NULL DEFAULT '',
                    source_context_json TEXT NOT NULL,
                    last_export_path TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS connection_profiles (
                    provider TEXT PRIMARY KEY,
                    is_configured INTEGER NOT NULL,
                    metadata_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS credential_profiles (
                    profile_id TEXT PRIMARY KEY,
                    label TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS strategy_paper_sessions (
                    session_id TEXT PRIMARY KEY,
                    backtest_run_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    label TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS strategy_paper_orders (
                    order_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES strategy_paper_sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS strategy_paper_fills (
                    fill_id TEXT PRIMARY KEY,
                    order_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES strategy_paper_sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS strategy_paper_positions (
                    session_id TEXT NOT NULL,
                    symbol TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY (session_id, symbol),
                    FOREIGN KEY (session_id) REFERENCES strategy_paper_sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS strategy_paper_cash_ledger (
                    entry_id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    FOREIGN KEY (session_id) REFERENCES strategy_paper_sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS strategy_paper_rule_decisions (
                    session_id TEXT NOT NULL,
                    decision_index INTEGER NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY (session_id, decision_index),
                    FOREIGN KEY (session_id) REFERENCES strategy_paper_sessions(session_id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS binance_execution_config (
                    key TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS binance_execution_intents (
                    intent_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    status TEXT NOT NULL,
                    strategy_run_id TEXT,
                    paper_session_id TEXT,
                    client_order_id TEXT,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS binance_execution_audit_events (
                    event_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    intent_id TEXT,
                    strategy_run_id TEXT,
                    summary TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS security_audit_events (
                    event_id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    category TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    surface TEXT NOT NULL,
                    subject TEXT,
                    summary TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS local_security_state (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    pin_hash TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    initialized_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    unlocked_until TEXT,
                    locked_at TEXT,
                    failed_attempts INTEGER NOT NULL DEFAULT 0,
                    lockout_until TEXT
                );

                CREATE TABLE IF NOT EXISTS local_auth_sessions (
                    session_id TEXT PRIMARY KEY,
                    account_id TEXT NOT NULL,
                    account_label TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked_at TEXT,
                    permissions_json TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS binance_execution_kill_switches (
                    scope_key TEXT PRIMARY KEY,
                    enabled INTEGER NOT NULL,
                    reason TEXT,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS workflow_runs (
                    run_id TEXT PRIMARY KEY,
                    template_key TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    input_json TEXT NOT NULL,
                    output_json TEXT NOT NULL,
                    steps_json TEXT NOT NULL,
                    artifact_refs_json TEXT NOT NULL,
                    blocked_reasons_json TEXT NOT NULL,
                    audit_events_json TEXT NOT NULL,
                    manual_confirmation_required INTEGER NOT NULL DEFAULT 0,
                    manual_confirmation_policy TEXT,
                    payload_json TEXT NOT NULL
                );
                """
            )
            self.connection.commit()
            self._migrate_connection_profiles_to_account_scope()
        self._seed_defaults()

    def _seed_defaults(self) -> None:
        now = utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO credential_profiles (profile_id, label, is_active, created_at, updated_at)
                VALUES ('local_default', 'Local default', 1, ?, ?)
                ON CONFLICT(profile_id) DO NOTHING
                """,
                (now, now),
            )
            active_count = self.connection.execute(
                "SELECT COUNT(*) AS count FROM credential_profiles WHERE is_active = 1"
            ).fetchone()["count"]
            if int(active_count) == 0:
                self.connection.execute(
                    """
                    UPDATE credential_profiles
                    SET is_active = 1, updated_at = ?
                    WHERE profile_id = 'local_default'
                    """,
                    (now,),
                )

            self.connection.execute(
                """
                INSERT INTO watchlists (key, title, is_default, updated_at)
                VALUES ('default', 'Default Watchlist', 1, ?)
                ON CONFLICT(key) DO NOTHING
                """,
                (now,),
            )
            watchlist_id = self.connection.execute(
                "SELECT id FROM watchlists WHERE key = 'default'"
            ).fetchone()["id"]

            for index, symbol in enumerate(DEFAULT_WATCHLIST):
                self.connection.execute(
                    """
                    INSERT INTO watchlist_items (watchlist_id, symbol, sort_index, updated_at)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(watchlist_id, symbol) DO NOTHING
                    """,
                    (watchlist_id, symbol, index, now),
                )

            for preset in DEFAULT_SCREENERS:
                self.connection.execute(
                    """
                    INSERT INTO screener_presets (
                        preset_key, title, badge, description, filters_json, asset_type, hit_count, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(preset_key) DO NOTHING
                    """,
                    (
                        preset["key"],
                        preset["title"],
                        preset["badge"],
                        preset["description"],
                        json.dumps(preset["filters"], ensure_ascii=False),
                        preset["asset_type"],
                        preset["hit_count"],
                        now,
                    ),
                )

            for preset in DEFAULT_SCREENERS:
                variant = default_variant_seed(preset)
                self.connection.execute(
                    """
                    INSERT INTO screener_preset_variants (
                        variant_key,
                        preset_key,
                        name,
                        description,
                        tuning_json,
                        filters_json,
                        is_system_default,
                        is_active,
                        last_hit_count,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(preset_key, variant_key) DO NOTHING
                    """,
                    (
                        variant["variant_key"],
                        variant["preset_key"],
                        variant["name"],
                        variant["description"],
                        json.dumps(variant["tuning"], ensure_ascii=False),
                        json.dumps(variant["filters"], ensure_ascii=False),
                        int(bool(variant["is_system_default"])),
                        int(bool(variant["is_active"])),
                        int(variant["last_hit_count"]),
                        now,
                    ),
                )

            self.connection.commit()

    def get_default_watchlist_symbols(self) -> list[str]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT wi.symbol
                FROM watchlist_items wi
                JOIN watchlists w ON w.id = wi.watchlist_id
                WHERE w.key = 'default'
                ORDER BY wi.sort_index ASC, wi.id ASC
                """
            ).fetchall()
        return [row["symbol"] for row in rows]

    def set_default_watchlist_symbols(self, symbols: list[str]) -> list[str]:
        now = utc_now_iso()
        with self._lock:
            watchlist_id = self.connection.execute(
                "SELECT id FROM watchlists WHERE key = 'default'"
            ).fetchone()["id"]
            self.connection.execute("DELETE FROM watchlist_items WHERE watchlist_id = ?", (watchlist_id,))
            for index, symbol in enumerate(symbols):
                self.connection.execute(
                    """
                    INSERT INTO watchlist_items (watchlist_id, symbol, sort_index, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (watchlist_id, symbol, index, now),
                )
            self.connection.commit()
        return symbols

    def get_app_settings(self, keys: list[str] | None = None) -> dict[str, str]:
        query = "SELECT key, value FROM app_settings"
        params: list[Any] = []
        if keys:
            placeholders = ", ".join(["?"] * len(keys))
            query += f" WHERE key IN ({placeholders})"
            params.extend(keys)

        with self._lock:
            rows = self.connection.execute(query, params).fetchall()
        return {row["key"]: row["value"] for row in rows}

    def upsert_app_settings(self, values: dict[str, Any]) -> None:
        now = utc_now_iso()
        with self._lock:
            self.connection.executemany(
                """
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                [(key, json.dumps(value, ensure_ascii=False), now) for key, value in values.items()],
            )
            self.connection.commit()

    def get_local_security_state(self) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT pin_hash, salt, initialized_at, updated_at, unlocked_until, locked_at,
                       failed_attempts, lockout_until
                FROM local_security_state
                WHERE id = 1
                """
            ).fetchone()
        if row is None:
            return None
        return {
            "pin_hash": row["pin_hash"],
            "salt": row["salt"],
            "initialized_at": row["initialized_at"],
            "updated_at": row["updated_at"],
            "unlocked_until": row["unlocked_until"],
            "locked_at": row["locked_at"],
            "failed_attempts": row["failed_attempts"],
            "lockout_until": row["lockout_until"],
        }

    def upsert_local_security_state(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO local_security_state (
                    id, pin_hash, salt, initialized_at, updated_at, unlocked_until,
                    locked_at, failed_attempts, lockout_until
                )
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    pin_hash = excluded.pin_hash,
                    salt = excluded.salt,
                    initialized_at = excluded.initialized_at,
                    updated_at = excluded.updated_at,
                    unlocked_until = excluded.unlocked_until,
                    locked_at = excluded.locked_at,
                    failed_attempts = excluded.failed_attempts,
                    lockout_until = excluded.lockout_until
                """,
                (
                    payload["pin_hash"],
                    payload["salt"],
                    payload["initialized_at"],
                    payload["updated_at"],
                    payload.get("unlocked_until"),
                    payload.get("locked_at"),
                    int(payload.get("failed_attempts") or 0),
                    payload.get("lockout_until"),
                ),
            )
            self.connection.commit()
        return payload

    def list_credential_profiles(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT profile_id, label, is_active, created_at, updated_at
                FROM credential_profiles
                ORDER BY is_active DESC, updated_at DESC, label ASC
                """
            ).fetchall()
        return [
            {
                "profile_id": row["profile_id"],
                "label": row["label"],
                "is_active": bool(row["is_active"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }
            for row in rows
        ]

    def get_active_credential_profile(self) -> dict[str, Any]:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT profile_id, label, is_active, created_at, updated_at
                FROM credential_profiles
                WHERE is_active = 1
                ORDER BY updated_at DESC
                LIMIT 1
                """
            ).fetchone()
        if row is None:
            now = utc_now_iso()
            self.upsert_credential_profile("local_default", label="Local default", is_active=True)
            return {
                "profile_id": "local_default",
                "label": "Local default",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        return {
            "profile_id": row["profile_id"],
            "label": row["label"],
            "is_active": bool(row["is_active"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def upsert_credential_profile(self, profile_id: str, *, label: str, is_active: bool = False) -> dict[str, Any]:
        now = utc_now_iso()
        with self._lock:
            if is_active:
                self.connection.execute("UPDATE credential_profiles SET is_active = 0")
            self.connection.execute(
                """
                INSERT INTO credential_profiles (profile_id, label, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(profile_id) DO UPDATE SET
                    label = excluded.label,
                    is_active = excluded.is_active,
                    updated_at = excluded.updated_at
                """,
                (profile_id, label, int(is_active), now, now),
            )
            self.connection.commit()
        return self.get_credential_profile(profile_id) or {
            "profile_id": profile_id,
            "label": label,
            "is_active": is_active,
            "created_at": now,
            "updated_at": now,
        }

    def get_credential_profile(self, profile_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT profile_id, label, is_active, created_at, updated_at
                FROM credential_profiles
                WHERE profile_id = ?
                """,
                (profile_id,),
            ).fetchone()
        if row is None:
            return None

        return {
            "profile_id": row["profile_id"],
            "label": row["label"],
            "is_active": bool(row["is_active"]),
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    def set_active_credential_profile(self, profile_id: str) -> dict[str, Any]:
        profile = self.get_credential_profile(profile_id)
        if profile is None:
            raise ValueError(f"Credential profile not found: {profile_id}")
        now = utc_now_iso()
        with self._lock:
            self.connection.execute("UPDATE credential_profiles SET is_active = 0")
            self.connection.execute(
                """
                UPDATE credential_profiles
                SET is_active = 1, updated_at = ?
                WHERE profile_id = ?
                """,
                (now, profile_id),
            )
            self.connection.commit()
        return self.get_active_credential_profile()

    def get_connection_profile(self, provider: str, profile_id: str | None = None) -> dict[str, Any] | None:
        credential_profile = self.get_credential_profile(profile_id) if profile_id else self.get_active_credential_profile()
        if credential_profile is None:
            return None
        with self._lock:
            row = self.connection.execute(
                """
                SELECT profile_id, provider, is_configured, metadata_json, updated_at
                FROM connection_profiles
                WHERE profile_id = ? AND provider = ?
                """,
                (credential_profile["profile_id"], provider),
            ).fetchone()
        if row is None:
            return None

        return {
            "profile_id": row["profile_id"],
            "profile_label": credential_profile["label"],
            "provider": row["provider"],
            "is_configured": bool(row["is_configured"]),
            "metadata": json.loads(row["metadata_json"]),
            "updated_at": row["updated_at"],
        }

    def upsert_connection_profile(
        self,
        provider: str,
        *,
        is_configured: bool,
        metadata: dict[str, Any] | None = None,
        merge_metadata: bool = True,
        profile_id: str | None = None,
    ) -> None:
        credential_profile = self.get_credential_profile(profile_id) if profile_id else self.get_active_credential_profile()
        if credential_profile is None:
            raise ValueError(f"Credential profile not found: {profile_id}")
        existing = self.get_connection_profile(provider, credential_profile["profile_id"]) if merge_metadata else None
        payload_data = dict(existing["metadata"]) if existing else {}
        payload_data.update(metadata or {})
        payload = json.dumps(payload_data, ensure_ascii=False)

        with self._lock:
            self.connection.execute(
                """
                INSERT INTO connection_profiles (profile_id, provider, is_configured, metadata_json, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(profile_id, provider) DO UPDATE SET
                    is_configured = excluded.is_configured,
                    metadata_json = excluded.metadata_json,
                    updated_at = excluded.updated_at
                """,
                (credential_profile["profile_id"], provider, int(is_configured), payload, utc_now_iso()),
            )
            self.connection.commit()

    def delete_connection_profile(self, provider: str, profile_id: str | None = None) -> None:
        credential_profile = self.get_credential_profile(profile_id) if profile_id else self.get_active_credential_profile()
        if credential_profile is None:
            raise ValueError(f"Credential profile not found: {profile_id}")
        with self._lock:
            self.connection.execute(
                "DELETE FROM connection_profiles WHERE profile_id = ? AND provider = ?",
                (credential_profile["profile_id"], provider),
            )
            self.connection.commit()

    def _variant_select_sql(self) -> str:
        return """
            SELECT
                variant_key,
                preset_key,
                name,
                description,
                tuning_json,
                filters_json,
                is_system_default,
                is_active,
                last_hit_count,
                updated_at
            FROM screener_preset_variants
        """

    def _row_to_variant(self, row: sqlite3.Row) -> dict[str, Any]:
        return {
            "variant_key": row["variant_key"],
            "preset_key": row["preset_key"],
            "name": row["name"],
            "description": row["description"],
            "tuning": json.loads(row["tuning_json"]),
            "filters": json.loads(row["filters_json"]),
            "is_system_default": bool(row["is_system_default"]),
            "is_active": bool(row["is_active"]),
            "last_hit_count": int(row["last_hit_count"]),
            "updated_at": row["updated_at"],
        }

    def list_screener_presets(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT
                    p.preset_key,
                    p.title,
                    p.badge,
                    p.description,
                    COALESCE(v.filters_json, p.filters_json) AS filters_json,
                    p.asset_type,
                    p.hit_count,
                    p.updated_at,
                    v.variant_key AS active_variant_key,
                    v.name AS active_variant_name
                FROM screener_presets p
                LEFT JOIN screener_preset_variants v
                    ON v.preset_key = p.preset_key
                   AND v.is_active = 1
                ORDER BY asset_type ASC, title ASC
                """
            ).fetchall()

        return [
            {
                "key": row["preset_key"],
                "title": row["title"],
                "badge": row["badge"],
                "description": row["description"],
                "filters": json.loads(row["filters_json"]),
                "asset_type": row["asset_type"],
                "hit_count": row["hit_count"],
                "updated_at": row["updated_at"],
                "active_variant_key": row["active_variant_key"],
                "active_variant_name": row["active_variant_name"],
            }
            for row in rows
        ]

    def get_screener_preset(self, preset_key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT
                    p.preset_key,
                    p.title,
                    p.badge,
                    p.description,
                    COALESCE(v.filters_json, p.filters_json) AS filters_json,
                    p.asset_type,
                    p.hit_count,
                    p.updated_at,
                    v.variant_key AS active_variant_key,
                    v.name AS active_variant_name
                FROM screener_presets p
                LEFT JOIN screener_preset_variants v
                    ON v.preset_key = p.preset_key
                   AND v.is_active = 1
                WHERE p.preset_key = ?
                """,
                (preset_key,),
            ).fetchone()
        if row is None:
            return None

        return {
            "key": row["preset_key"],
            "title": row["title"],
            "badge": row["badge"],
            "description": row["description"],
            "filters": json.loads(row["filters_json"]),
            "asset_type": row["asset_type"],
            "hit_count": row["hit_count"],
            "updated_at": row["updated_at"],
            "active_variant_key": row["active_variant_key"],
            "active_variant_name": row["active_variant_name"],
        }

    def update_screener_preset(
        self,
        preset_key: str,
        *,
        title: str | None = None,
        badge: str | None = None,
        description: str | None = None,
        filters: list[str] | None = None,
        asset_type: str | None = None,
        hit_count: int | None = None,
    ) -> dict[str, Any] | None:
        current = self.get_screener_preset(preset_key)
        if current is None:
            return None

        next_value = {
            "title": title if title is not None else current["title"],
            "badge": badge if badge is not None else current["badge"],
            "description": description if description is not None else current["description"],
            "filters_json": json.dumps(filters if filters is not None else current["filters"], ensure_ascii=False),
            "asset_type": asset_type if asset_type is not None else current["asset_type"],
            "hit_count": hit_count if hit_count is not None else current["hit_count"],
            "updated_at": utc_now_iso(),
        }

        with self._lock:
            self.connection.execute(
                """
                UPDATE screener_presets
                SET title = ?, badge = ?, description = ?, filters_json = ?, asset_type = ?, hit_count = ?, updated_at = ?
                WHERE preset_key = ?
                """,
                (
                    next_value["title"],
                    next_value["badge"],
                    next_value["description"],
                    next_value["filters_json"],
                    next_value["asset_type"],
                    next_value["hit_count"],
                    next_value["updated_at"],
                    preset_key,
                ),
            )
            self.connection.commit()

        return self.get_screener_preset(preset_key)

    def list_screener_preset_variants(self, preset_key: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                f"""
                {self._variant_select_sql()}
                WHERE preset_key = ?
                ORDER BY is_system_default DESC, is_active DESC, updated_at DESC, name ASC
                """,
                (preset_key,),
            ).fetchall()
        return [self._row_to_variant(row) for row in rows]

    def get_screener_preset_variant(self, preset_key: str, variant_key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                f"""
                {self._variant_select_sql()}
                WHERE preset_key = ? AND variant_key = ?
                """,
                (preset_key, variant_key),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_variant(row)

    def get_active_screener_preset_variant(self, preset_key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                f"""
                {self._variant_select_sql()}
                WHERE preset_key = ? AND is_active = 1
                ORDER BY is_system_default DESC, updated_at DESC
                LIMIT 1
                """,
                (preset_key,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_variant(row)

    def create_screener_preset_variant(
        self,
        preset_key: str,
        *,
        variant_key: str,
        name: str,
        description: str,
        tuning: dict[str, Any],
        filters: list[str],
        is_system_default: bool = False,
        is_active: bool = False,
        last_hit_count: int = 0,
    ) -> dict[str, Any]:
        if self.get_screener_preset(preset_key) is None:
            raise ValueError(f"Screener preset not found: {preset_key}")

        with self._lock:
            duplicate = self.connection.execute(
                """
                SELECT 1
                FROM screener_preset_variants
                WHERE preset_key = ? AND lower(name) = lower(?)
                """,
                (preset_key, name),
            ).fetchone()
            if duplicate is not None:
                raise ValueError(f"Variant name already exists for preset {preset_key}: {name}")

            if is_active:
                self.connection.execute(
                    "UPDATE screener_preset_variants SET is_active = 0 WHERE preset_key = ?",
                    (preset_key,),
                )

            self.connection.execute(
                """
                INSERT INTO screener_preset_variants (
                    variant_key,
                    preset_key,
                    name,
                    description,
                    tuning_json,
                    filters_json,
                    is_system_default,
                    is_active,
                    last_hit_count,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    variant_key,
                    preset_key,
                    name,
                    description,
                    json.dumps(tuning, ensure_ascii=False),
                    json.dumps(filters, ensure_ascii=False),
                    int(is_system_default),
                    int(is_active),
                    int(last_hit_count),
                    utc_now_iso(),
                ),
            )
            self.connection.commit()

        return self.get_screener_preset_variant(preset_key, variant_key)  # type: ignore[return-value]

    def update_screener_preset_variant(
        self,
        preset_key: str,
        variant_key: str,
        *,
        name: str | None = None,
        description: str | None = None,
        tuning: dict[str, Any] | None = None,
        filters: list[str] | None = None,
        last_hit_count: int | None = None,
    ) -> dict[str, Any] | None:
        current = self.get_screener_preset_variant(preset_key, variant_key)
        if current is None:
            return None

        if name is not None and name.lower() != current["name"].lower():
            with self._lock:
                duplicate = self.connection.execute(
                    """
                    SELECT 1
                    FROM screener_preset_variants
                    WHERE preset_key = ? AND lower(name) = lower(?) AND variant_key <> ?
                    """,
                    (preset_key, name, variant_key),
                ).fetchone()
            if duplicate is not None:
                raise ValueError(f"Variant name already exists for preset {preset_key}: {name}")

        next_value = {
            "name": name if name is not None else current["name"],
            "description": description if description is not None else current["description"],
            "tuning_json": json.dumps(tuning if tuning is not None else current["tuning"], ensure_ascii=False),
            "filters_json": json.dumps(filters if filters is not None else current["filters"], ensure_ascii=False),
            "last_hit_count": int(last_hit_count if last_hit_count is not None else current["last_hit_count"]),
            "updated_at": utc_now_iso(),
        }

        with self._lock:
            self.connection.execute(
                """
                UPDATE screener_preset_variants
                SET name = ?, description = ?, tuning_json = ?, filters_json = ?, last_hit_count = ?, updated_at = ?
                WHERE preset_key = ? AND variant_key = ?
                """,
                (
                    next_value["name"],
                    next_value["description"],
                    next_value["tuning_json"],
                    next_value["filters_json"],
                    next_value["last_hit_count"],
                    next_value["updated_at"],
                    preset_key,
                    variant_key,
                ),
            )
            self.connection.commit()

        return self.get_screener_preset_variant(preset_key, variant_key)

    def activate_screener_preset_variant(self, preset_key: str, variant_key: str) -> dict[str, Any] | None:
        current = self.get_screener_preset_variant(preset_key, variant_key)
        if current is None:
            return None

        now = utc_now_iso()
        with self._lock:
            self.connection.execute(
                "UPDATE screener_preset_variants SET is_active = 0 WHERE preset_key = ?",
                (preset_key,),
            )
            self.connection.execute(
                """
                UPDATE screener_preset_variants
                SET is_active = 1, updated_at = ?
                WHERE preset_key = ? AND variant_key = ?
                """,
                (now, preset_key, variant_key),
            )
            self.connection.commit()

        return self.get_screener_preset_variant(preset_key, variant_key)

    def delete_screener_preset_variant(self, preset_key: str, variant_key: str) -> bool:
        current = self.get_screener_preset_variant(preset_key, variant_key)
        if current is None:
            return False

        if current["is_system_default"]:
            raise ValueError("System default screener variants cannot be deleted")

        with self._lock:
            self.connection.execute(
                "DELETE FROM screener_preset_variants WHERE preset_key = ? AND variant_key = ?",
                (preset_key, variant_key),
            )
            if current["is_active"]:
                self.connection.execute(
                    """
                    UPDATE screener_preset_variants
                    SET is_active = 1, updated_at = ?
                    WHERE preset_key = ? AND is_system_default = 1
                    """,
                    (utc_now_iso(), preset_key),
                )
            self.connection.commit()
        return True

    def list_portfolio_transactions(self) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT id, symbol, side, quantity, price, fees, traded_at, notes
                FROM portfolio_transactions
                ORDER BY traded_at DESC, id DESC
                """
            ).fetchall()

        return [
            {
                "id": row["id"],
                "symbol": row["symbol"],
                "side": row["side"],
                "quantity": float(row["quantity"]),
                "price": float(row["price"]),
                "fees": float(row["fees"]),
                "traded_at": row["traded_at"],
                "notes": row["notes"],
            }
            for row in rows
        ]

    def create_portfolio_transaction(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            cursor = self.connection.execute(
                """
                INSERT INTO portfolio_transactions (symbol, side, quantity, price, fees, traded_at, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["symbol"],
                    payload["side"],
                    payload["quantity"],
                    payload["price"],
                    payload.get("fees", 0),
                    payload["traded_at"],
                    payload.get("notes"),
                ),
            )
            self.connection.commit()
            transaction_id = int(cursor.lastrowid)
        return self.get_portfolio_transaction(transaction_id)  # type: ignore[return-value]

    def get_portfolio_transaction(self, transaction_id: int) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT id, symbol, side, quantity, price, fees, traded_at, notes
                FROM portfolio_transactions
                WHERE id = ?
                """,
                (transaction_id,),
            ).fetchone()
        if row is None:
            return None

        return {
            "id": row["id"],
            "symbol": row["symbol"],
            "side": row["side"],
            "quantity": float(row["quantity"]),
            "price": float(row["price"]),
            "fees": float(row["fees"]),
            "traded_at": row["traded_at"],
            "notes": row["notes"],
        }

    def update_portfolio_transaction(self, transaction_id: int, payload: dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            self.connection.execute(
                """
                UPDATE portfolio_transactions
                SET symbol = ?, side = ?, quantity = ?, price = ?, fees = ?, traded_at = ?, notes = ?
                WHERE id = ?
                """,
                (
                    payload["symbol"],
                    payload["side"],
                    payload["quantity"],
                    payload["price"],
                    payload.get("fees", 0),
                    payload["traded_at"],
                    payload.get("notes"),
                    transaction_id,
                ),
            )
            self.connection.commit()
        return self.get_portfolio_transaction(transaction_id)

    def delete_portfolio_transaction(self, transaction_id: int) -> bool:
        with self._lock:
            cursor = self.connection.execute(
                "DELETE FROM portfolio_transactions WHERE id = ?",
                (transaction_id,),
            )
            self.connection.commit()
        return cursor.rowcount > 0

    def create_research_brief(
        self,
        *,
        brief_id: str,
        symbol: str,
        title: str,
        snapshot: dict[str, Any],
        notes_markdown: str,
        source_context: dict[str, Any],
        last_export_path: str | None = None,
    ) -> dict[str, Any]:
        updated_at = utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO research_briefs (
                    brief_id,
                    symbol,
                    title,
                    snapshot_json,
                    notes_markdown,
                    source_context_json,
                    last_export_path,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    brief_id,
                    symbol,
                    title,
                    json.dumps(snapshot, ensure_ascii=False),
                    notes_markdown,
                    json.dumps(source_context, ensure_ascii=False),
                    last_export_path,
                    updated_at,
                ),
            )
            self.connection.commit()
        return self.get_research_brief(brief_id)  # type: ignore[return-value]

    def get_research_brief(self, brief_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT
                    brief_id,
                    symbol,
                    title,
                    snapshot_json,
                    notes_markdown,
                    source_context_json,
                    last_export_path,
                    updated_at
                FROM research_briefs
                WHERE brief_id = ?
                """,
                (brief_id,),
            ).fetchone()
        if row is None:
            return None

        return {
            "brief_id": row["brief_id"],
            "symbol": row["symbol"],
            "title": row["title"],
            "snapshot": json.loads(row["snapshot_json"]),
            "notes_markdown": row["notes_markdown"] or "",
            "source_context": json.loads(row["source_context_json"]),
            "last_export_path": row["last_export_path"],
            "updated_at": row["updated_at"],
        }

    def list_recent_research_briefs(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT
                    brief_id,
                    symbol,
                    title,
                    snapshot_json,
                    notes_markdown,
                    source_context_json,
                    last_export_path,
                    updated_at
                FROM research_briefs
                ORDER BY updated_at DESC, brief_id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            items.append(
                {
                    "brief_id": row["brief_id"],
                    "symbol": row["symbol"],
                    "title": row["title"],
                    "snapshot": json.loads(row["snapshot_json"]),
                    "notes_markdown": row["notes_markdown"] or "",
                    "source_context": json.loads(row["source_context_json"]),
                    "last_export_path": row["last_export_path"],
                    "updated_at": row["updated_at"],
                }
            )
        return items

    def update_research_brief_notes(self, brief_id: str, markdown: str) -> dict[str, Any] | None:
        updated_at = utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                UPDATE research_briefs
                SET notes_markdown = ?, updated_at = ?
                WHERE brief_id = ?
                """,
                (markdown, updated_at, brief_id),
            )
            self.connection.commit()
        return self.get_research_brief(brief_id)

    def update_research_brief_snapshot(
        self,
        brief_id: str,
        *,
        title: str,
        snapshot: dict[str, Any],
        source_context: dict[str, Any],
    ) -> dict[str, Any] | None:
        updated_at = utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                UPDATE research_briefs
                SET title = ?, snapshot_json = ?, source_context_json = ?, updated_at = ?
                WHERE brief_id = ?
                """,
                (
                    title,
                    json.dumps(snapshot, ensure_ascii=False),
                    json.dumps(source_context, ensure_ascii=False),
                    updated_at,
                    brief_id,
                ),
            )
            self.connection.commit()
        return self.get_research_brief(brief_id)

    def update_research_brief_export_path(self, brief_id: str, export_path: str) -> dict[str, Any] | None:
        updated_at = utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                UPDATE research_briefs
                SET last_export_path = ?, updated_at = ?
                WHERE brief_id = ?
                """,
                (export_path, updated_at, brief_id),
            )
            self.connection.commit()
        return self.get_research_brief(brief_id)

    def create_strategy_paper_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO strategy_paper_sessions (
                    session_id, backtest_run_id, created_at, label, payload_json
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    payload["session_id"],
                    payload["backtest_run_id"],
                    payload["created_at"],
                    payload["label"],
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
            for order in payload.get("orders", []):
                self.connection.execute(
                    """
                    INSERT INTO strategy_paper_orders (order_id, session_id, payload_json)
                    VALUES (?, ?, ?)
                    """,
                    (order["order_id"], payload["session_id"], json.dumps(order, ensure_ascii=False)),
                )
            for fill in payload.get("fills", []):
                self.connection.execute(
                    """
                    INSERT INTO strategy_paper_fills (fill_id, order_id, session_id, payload_json)
                    VALUES (?, ?, ?, ?)
                    """,
                    (fill["fill_id"], fill["order_id"], payload["session_id"], json.dumps(fill, ensure_ascii=False)),
                )
            for position in payload.get("positions", []):
                self.connection.execute(
                    """
                    INSERT INTO strategy_paper_positions (session_id, symbol, payload_json)
                    VALUES (?, ?, ?)
                    """,
                    (payload["session_id"], position["symbol"], json.dumps(position, ensure_ascii=False)),
                )
            for entry in payload.get("cash_ledger", []):
                self.connection.execute(
                    """
                    INSERT INTO strategy_paper_cash_ledger (entry_id, session_id, payload_json)
                    VALUES (?, ?, ?)
                    """,
                    (entry["entry_id"], payload["session_id"], json.dumps(entry, ensure_ascii=False)),
                )
            for index, decision in enumerate(payload.get("rule_decisions", [])):
                self.connection.execute(
                    """
                    INSERT INTO strategy_paper_rule_decisions (session_id, decision_index, payload_json)
                    VALUES (?, ?, ?)
                    """,
                    (payload["session_id"], index, json.dumps(decision, ensure_ascii=False)),
                )
            self.connection.commit()
        return self.get_strategy_paper_session(payload["session_id"])  # type: ignore[return-value]

    def get_strategy_paper_session(self, session_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM strategy_paper_sessions
                WHERE session_id = ?
                """,
                (session_id,),
            ).fetchone()
        return None if row is None else json.loads(row["payload_json"])

    def list_recent_strategy_paper_sessions(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT payload_json
                FROM strategy_paper_sessions
                ORDER BY created_at DESC, session_id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        items: list[dict[str, Any]] = []
        for row in rows:
            payload = json.loads(row["payload_json"])
            cash_ledger = payload.get("cash_ledger", [])
            latest_cash = cash_ledger[-1]["cash_balance"] if cash_ledger else 0.0
            items.append(
                {
                    "session_id": payload["session_id"],
                    "backtest_run_id": payload["backtest_run_id"],
                    "created_at": payload["created_at"],
                    "label": payload["label"],
                    "order_count": len(payload.get("orders", [])),
                    "fill_count": len(payload.get("fills", [])),
                    "cash_balance": float(latest_cash),
                    "total_pnl": float(payload.get("pnl", {}).get("total_pnl", 0.0)),
                    "no_live_orders": bool(payload.get("no_live_orders", True)),
                }
            )
        return items

    def get_binance_execution_config(self) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM binance_execution_config
                WHERE key = 'default'
                """
            ).fetchone()
        return None if row is None else json.loads(row["payload_json"])

    def put_binance_execution_config(self, payload: dict[str, Any]) -> dict[str, Any]:
        updated_at = payload.get("updated_at") or utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO binance_execution_config (key, payload_json, updated_at)
                VALUES ('default', ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    payload_json = excluded.payload_json,
                    updated_at = excluded.updated_at
                """,
                (json.dumps(payload, ensure_ascii=False), updated_at),
            )
            self.connection.commit()
        return self.get_binance_execution_config() or payload

    def create_binance_execution_intent(self, payload: dict[str, Any]) -> dict[str, Any]:
        request = payload.get("request", {})
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO binance_execution_intents (
                    intent_id, created_at, updated_at, status, strategy_run_id, paper_session_id, client_order_id, payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["intent_id"],
                    payload["created_at"],
                    payload["updated_at"],
                    payload["status"],
                    request.get("strategy_run_id"),
                    request.get("paper_session_id"),
                    request.get("client_order_id"),
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
            self.connection.commit()
        return self.get_binance_execution_intent(payload["intent_id"])  # type: ignore[return-value]

    def update_binance_execution_intent(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        request = payload.get("request", {})
        with self._lock:
            self.connection.execute(
                """
                UPDATE binance_execution_intents
                SET updated_at = ?, status = ?, strategy_run_id = ?, paper_session_id = ?, client_order_id = ?, payload_json = ?
                WHERE intent_id = ?
                """,
                (
                    payload["updated_at"],
                    payload["status"],
                    request.get("strategy_run_id"),
                    request.get("paper_session_id"),
                    request.get("client_order_id"),
                    json.dumps(payload, ensure_ascii=False),
                    payload["intent_id"],
                ),
            )
            self.connection.commit()
        return self.get_binance_execution_intent(payload["intent_id"])

    def get_binance_execution_intent(self, intent_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM binance_execution_intents
                WHERE intent_id = ?
                """,
                (intent_id,),
            ).fetchone()
        return None if row is None else json.loads(row["payload_json"])

    def list_recent_binance_execution_intents(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT payload_json
                FROM binance_execution_intents
                ORDER BY created_at DESC, intent_id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [json.loads(row["payload_json"]) for row in rows]

    def has_duplicate_binance_client_order(self, client_order_id: str, exclude_intent_id: str | None = None) -> bool:
        query = """
            SELECT intent_id
            FROM binance_execution_intents
            WHERE client_order_id = ?
              AND status IN ('submitted', 'filled')
        """
        params: list[Any] = [client_order_id]
        if exclude_intent_id:
            query += " AND intent_id <> ?"
            params.append(exclude_intent_id)
        with self._lock:
            row = self.connection.execute(query, params).fetchone()
        return row is not None

    def sum_binance_live_notional_since(self, since_iso: str) -> float:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT payload_json
                FROM binance_execution_intents
                WHERE updated_at >= ?
                  AND status IN ('submitted', 'filled')
                """,
                (since_iso,),
            ).fetchall()
        total = 0.0
        for row in rows:
            payload = json.loads(row["payload_json"])
            total += float(payload.get("estimated_notional") or 0.0)
        return total

    def put_binance_kill_switch(self, scope_key: str, enabled: bool, reason: str | None = None) -> dict[str, Any]:
        updated_at = utc_now_iso()
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO binance_execution_kill_switches (scope_key, enabled, reason, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(scope_key) DO UPDATE SET
                    enabled = excluded.enabled,
                    reason = excluded.reason,
                    updated_at = excluded.updated_at
                """,
                (scope_key, int(enabled), reason, updated_at),
            )
            self.connection.commit()
        return {"scope_key": scope_key, "enabled": enabled, "reason": reason, "updated_at": updated_at}

    def get_binance_kill_switch(self, scope_key: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT scope_key, enabled, reason, updated_at
                FROM binance_execution_kill_switches
                WHERE scope_key = ?
                """,
                (scope_key,),
            ).fetchone()
        if row is None:
            return None
        return {
            "scope_key": row["scope_key"],
            "enabled": bool(row["enabled"]),
            "reason": row["reason"],
            "updated_at": row["updated_at"],
        }

    def create_binance_execution_audit_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO binance_execution_audit_events (
                    event_id, created_at, event_type, intent_id, strategy_run_id, summary, payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["event_id"],
                    payload["created_at"],
                    payload["event_type"],
                    payload.get("intent_id"),
                    payload.get("strategy_run_id"),
                    payload["summary"],
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
            self.connection.commit()
        return payload

    def list_binance_execution_audit_events(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT payload_json
                FROM binance_execution_audit_events
                ORDER BY created_at DESC, event_id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [json.loads(row["payload_json"]) for row in rows]

    def create_security_audit_event(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO security_audit_events (
                    event_id, created_at, category, event_type, actor, surface, subject, summary, payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["event_id"],
                    payload["created_at"],
                    payload["category"],
                    payload["event_type"],
                    payload.get("actor", "local_user"),
                    payload.get("surface", "sidecar"),
                    payload.get("subject"),
                    payload["summary"],
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
            self.connection.commit()
        return payload

    def list_security_audit_events(
        self,
        limit: int = 100,
        *,
        category: str | None = None,
    ) -> list[dict[str, Any]]:
        query = "SELECT payload_json FROM security_audit_events"
        params: list[Any] = []
        if category:
            query += " WHERE category = ?"
            params.append(category)
        query += " ORDER BY created_at DESC, event_id DESC LIMIT ?"
        params.append(limit)
        with self._lock:
            rows = self.connection.execute(query, params).fetchall()
        return [json.loads(row["payload_json"]) for row in rows]

    def upsert_local_auth_session(self, payload: dict[str, Any]) -> dict[str, Any]:
        stored = json.dumps(payload, ensure_ascii=False)
        permissions = json.dumps(payload.get("permissions", []), ensure_ascii=False)
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO local_auth_sessions (
                    session_id, account_id, account_label, created_at, expires_at, revoked_at, permissions_json, payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    account_id = excluded.account_id,
                    account_label = excluded.account_label,
                    expires_at = excluded.expires_at,
                    revoked_at = excluded.revoked_at,
                    permissions_json = excluded.permissions_json,
                    payload_json = excluded.payload_json
                """,
                (
                    payload["session_id"],
                    payload["account_id"],
                    payload["account_label"],
                    payload["created_at"],
                    payload["expires_at"],
                    payload.get("revoked_at"),
                    permissions,
                    stored,
                ),
            )
            self.connection.commit()
        return payload

    def get_local_auth_session(self, session_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                "SELECT payload_json FROM local_auth_sessions WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return json.loads(row["payload_json"]) if row else None

    def revoke_local_auth_session(self, session_id: str, revoked_at: str) -> dict[str, Any] | None:
        payload = self.get_local_auth_session(session_id)
        if payload is None:
            return None
        payload["revoked_at"] = revoked_at
        payload["status"] = "revoked"
        return self.upsert_local_auth_session(payload)

    def put_workflow_run(self, payload: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            self.connection.execute(
                """
                INSERT INTO workflow_runs (
                    run_id,
                    template_key,
                    status,
                    created_at,
                    updated_at,
                    input_json,
                    output_json,
                    steps_json,
                    artifact_refs_json,
                    blocked_reasons_json,
                    audit_events_json,
                    manual_confirmation_required,
                    manual_confirmation_policy,
                    payload_json
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    template_key = excluded.template_key,
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    input_json = excluded.input_json,
                    output_json = excluded.output_json,
                    steps_json = excluded.steps_json,
                    artifact_refs_json = excluded.artifact_refs_json,
                    blocked_reasons_json = excluded.blocked_reasons_json,
                    audit_events_json = excluded.audit_events_json,
                    manual_confirmation_required = excluded.manual_confirmation_required,
                    manual_confirmation_policy = excluded.manual_confirmation_policy,
                    payload_json = excluded.payload_json
                """,
                (
                    payload["run_id"],
                    payload["template_key"],
                    payload["status"],
                    payload["created_at"],
                    payload["updated_at"],
                    json.dumps(payload.get("input", {}), ensure_ascii=False),
                    json.dumps(payload.get("output", {}), ensure_ascii=False),
                    json.dumps(payload.get("steps", []), ensure_ascii=False),
                    json.dumps(payload.get("artifact_refs", []), ensure_ascii=False),
                    json.dumps(payload.get("blocked_reasons", []), ensure_ascii=False),
                    json.dumps(payload.get("audit_events", []), ensure_ascii=False),
                    1 if payload.get("manual_confirmation_required") else 0,
                    payload.get("manual_confirmation_policy"),
                    json.dumps(payload, ensure_ascii=False),
                ),
            )
            self.connection.commit()
        return self.get_workflow_run(payload["run_id"]) or payload

    def get_workflow_run(self, run_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self.connection.execute(
                """
                SELECT payload_json
                FROM workflow_runs
                WHERE run_id = ?
                """,
                (run_id,),
            ).fetchone()
        return None if row is None else json.loads(row["payload_json"])

    def list_recent_workflow_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._lock:
            rows = self.connection.execute(
                """
                SELECT payload_json
                FROM workflow_runs
                ORDER BY created_at DESC, run_id DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [json.loads(row["payload_json"]) for row in rows]
