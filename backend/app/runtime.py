from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path


def _resolve_runtime_dir(path_value: str | None, default_path: Path) -> Path:
    if path_value:
        return Path(path_value).expanduser().resolve()
    return default_path.expanduser().resolve()


def _resolve_optional_path(path_value: str | None) -> Path | None:
    if not path_value:
        return None
    return Path(path_value).expanduser().resolve()


@dataclass(slots=True)
class RuntimeSettings:
    host: str
    port: int
    data_dir: Path
    log_dir: Path
    runtime_mode: str
    build_summary_path: Path | None
    edgar_identity: str | None
    binance_api_key: str | None
    binance_secret: str | None
    binance_password: str | None
    fred_api_key: str | None = None
    coingecko_demo_api_key: str | None = None
    coingecko_pro_api_key: str | None = None
    translation_provider: str | None = None
    translation_api_key: str | None = None
    translation_base_url: str | None = None

    @property
    def sqlite_path(self) -> Path:
        return self.data_dir / "sqlite" / "pengbo.sqlite3"

    @property
    def duckdb_path(self) -> Path:
        return self.data_dir / "duckdb" / "pengbo.duckdb"

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}/api/v1"

    @property
    def diagnostics_dir(self) -> Path:
        return self.data_dir / "diagnostics"

    @property
    def sidecar_stdout_path(self) -> Path:
        return self.log_dir / "sidecar-stdout.log"

    @property
    def sidecar_stderr_path(self) -> Path:
        return self.log_dir / "sidecar-stderr.log"

    @property
    def sidecar_last_error_path(self) -> Path:
        return self.log_dir / "sidecar.last-error.log"

    @property
    def sidecar_bootstrap_path(self) -> Path:
        return self.log_dir / "sidecar-bootstrap.log"

    def ensure_directories(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.diagnostics_dir.mkdir(parents=True, exist_ok=True)
        self.sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        self.duckdb_path.parent.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_env(cls) -> "RuntimeSettings":
        if getattr(sys, "frozen", False):
            runtime_root = Path(sys.executable).resolve().parent / ".pengbo-runtime"
        else:
            repo_root = Path(__file__).resolve().parents[2]
            runtime_root = repo_root / ".pengbo-runtime"

        data_dir = _resolve_runtime_dir(
            os.getenv("PENGBO_DATA_DIR"),
            runtime_root / "data",
        )
        log_dir = _resolve_runtime_dir(
            os.getenv("PENGBO_LOG_DIR"),
            runtime_root / "logs",
        )
        return cls(
            host=os.getenv("PENGBO_HOST", "127.0.0.1"),
            port=int(os.getenv("PENGBO_PORT", "8765")),
            data_dir=data_dir,
            log_dir=log_dir,
            runtime_mode=os.getenv("PENGBO_RUNTIME_MODE", "web-dev"),
            build_summary_path=_resolve_optional_path(os.getenv("PENGBO_BUILD_SUMMARY_PATH")),
            edgar_identity=os.getenv("EDGAR_IDENTITY"),
            binance_api_key=os.getenv("PENGBO_BINANCE_API_KEY"),
            binance_secret=os.getenv("PENGBO_BINANCE_SECRET"),
            binance_password=os.getenv("PENGBO_BINANCE_PASSWORD"),
            fred_api_key=os.getenv("PENGBO_FRED_API_KEY") or os.getenv("FRED_API_KEY"),
            coingecko_demo_api_key=os.getenv("PENGBO_COINGECKO_DEMO_API_KEY"),
            coingecko_pro_api_key=os.getenv("PENGBO_COINGECKO_PRO_API_KEY"),
            translation_provider=os.getenv("PENGBO_TRANSLATION_PROVIDER"),
            translation_api_key=os.getenv("PENGBO_TRANSLATION_API_KEY"),
            translation_base_url=os.getenv("PENGBO_TRANSLATION_BASE_URL"),
        )
