from __future__ import annotations

import os
import sys
import traceback
from datetime import UTC, datetime
from pathlib import Path


BOOTSTRAP_LOG_NAME = "sidecar-bootstrap.log"


def _resolve_log_dir(argv: list[str]) -> Path:
    for index, arg in enumerate(argv):
        if arg == "--log-dir" and index + 1 < len(argv):
            return Path(argv[index + 1]).expanduser().resolve()
        if arg.startswith("--log-dir="):
            return Path(arg.split("=", 1)[1]).expanduser().resolve()

    env_log_dir = os.getenv("PENGBO_LOG_DIR")
    if env_log_dir:
        return Path(env_log_dir).expanduser().resolve()

    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / "logs"

    repo_root = Path(__file__).resolve().parents[1]
    return repo_root / ".pengbo-runtime" / "logs"


def _write_bootstrap_error() -> None:
    log_dir = _resolve_log_dir(sys.argv[1:])
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / BOOTSTRAP_LOG_NAME

    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(f"\n[{datetime.now(UTC).isoformat()}] bootstrap failure\n")
        handle.write(f"argv: {sys.argv}\n")
        traceback.print_exc(file=handle)


def main() -> None:
    try:
        from backend.app.cli import main as run_main
    except Exception:
        _write_bootstrap_error()
        raise

    try:
        run_main()
    except Exception:
        _write_bootstrap_error()
        raise


if __name__ == "__main__":
    main()
