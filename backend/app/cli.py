from __future__ import annotations

import argparse
import logging
from pathlib import Path

import uvicorn

from .api.factory import create_app
from .runtime import RuntimeSettings


def _configure_logging(log_dir: Path) -> None:
    log_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        handlers=[
            logging.FileHandler(log_dir / "sidecar.log", encoding="utf-8"),
            logging.StreamHandler(),
        ],
        force=True,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Pengbo Workbench sidecar")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--data-dir")
    parser.add_argument("--log-dir")
    parser.add_argument("--runtime-mode", default="web-dev")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = RuntimeSettings.from_env()
    settings.host = args.host
    settings.port = args.port
    if args.data_dir:
        settings.data_dir = Path(args.data_dir).expanduser().resolve()
    if args.log_dir:
        settings.log_dir = Path(args.log_dir).expanduser().resolve()
    settings.runtime_mode = args.runtime_mode
    settings.ensure_directories()
    _configure_logging(settings.log_dir)
    logging.info(
        "Starting Pengbo sidecar host=%s port=%s mode=%s data_dir=%s log_dir=%s",
        settings.host,
        settings.port,
        settings.runtime_mode,
        settings.data_dir,
        settings.log_dir,
    )

    try:
        uvicorn.run(
            create_app(settings),
            host=settings.host,
            port=settings.port,
            log_level="info",
            log_config=None,
        )
    except Exception:
        logging.exception("Pengbo sidecar failed during startup")
        raise


if __name__ == "__main__":
    main()
