from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path


HIDDEN_IMPORTS = [
    "backend.app.cli",
    "backend.app.api.factory",
    "backend.app.api.routes",
    "backend.app.providers.filings",
    "backend.app.providers.fundamentals",
    "backend.app.storage.duckdb_store",
    "backend.app.storage.sqlite_store",
    "edgar",
    "uvicorn.lifespan.on",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets.auto",
    "yfinance",
]

EXCLUDED_MODULES = [
    "black",
    "ccxt",
    "IPython",
    "matplotlib",
    "PyQt5",
    "PyQt6",
    "PySide6",
    "pytest",
    "scipy",
    "shiboken6",
    "sklearn",
    "torch",
    "torchaudio",
    "torchvision",
]

INTERESTING_WARNING_KEYWORDS = [
    "fatal: bad revision 'head'",
    "ccxt",
    "curl_cffi",
    "edgar.ai",
    "financetoolkit",
    "gevent",
    "orjson.loads",
    "eventlet",
    "readability",
    "PySide6",
    "shiboken6",
    "scipy",
    "sklearn",
    "torch",
    "yfinance",
]

OPTIONAL_WARNING_KEYWORDS = [
    "missing module named gevent",
    "missing module named 'gevent.core'",
    "missing module named 'gevent.hub'",
    "missing module named 'gevent.event'",
    "missing module named orjson.loads",
    "missing module named eventlet",
    "missing module named readability",
    "missing module named markdownify",
]

ACCEPTED_WARNING_RULES: tuple[tuple[str, str], ...] = (
    (
        "missing module named 'scipy.stats' - imported by pandas.core.nanops",
        "pandas optional SciPy stats helpers stay excluded from the packaged sidecar",
    ),
    (
        "excluded module named scipy - imported by pandas.core.missing (delayed), yfinance.scrapers.history (delayed)",
        "the packaged fundamentals flow keeps SciPy excluded while yfinance still exposes delayed history hooks",
    ),
    (
        "missing module named 'scipy.sparse' - imported by pandas.core.dtypes.common",
        "pandas sparse-array helpers are optional and remain outside the packaged desktop contract",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build Pengbo Python sidecar binary")
    parser.add_argument("--target", default="x86_64-pc-windows-msvc")
    return parser.parse_args()


def _build_command(
    repo_root: Path,
    dist_root: Path,
    work_root: Path,
    spec_root: Path,
) -> list[str]:
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        str(repo_root / "backend" / "sidecar_bootstrap.py"),
        "--name",
        "pengbo-sidecar",
        "--noconsole",
        "--clean",
        "--noconfirm",
        "--distpath",
        str(dist_root),
        "--workpath",
        str(work_root),
        "--specpath",
        str(spec_root),
        "--paths",
        str(repo_root),
        "--collect-all",
        "duckdb",
        "--collect-data",
        "certifi",
        "--collect-data",
        "edgar",
    ]

    for hidden_import in HIDDEN_IMPORTS:
        command.extend(["--hidden-import", hidden_import])
    for excluded_module in EXCLUDED_MODULES:
        command.extend(["--exclude-module", excluded_module])

    return command


def _extract_warning_lines(build_output: str, warn_file: Path) -> list[str]:
    lines: list[str] = []
    keywords = tuple(INTERESTING_WARNING_KEYWORDS)

    for raw_line in build_output.splitlines():
        normalized = raw_line.strip()
        if not normalized:
            continue
        lowered = normalized.lower()
        if any(keyword in lowered for keyword in keywords):
            lines.append(normalized)

    if warn_file.exists():
        warn_text = warn_file.read_text(encoding="utf-8", errors="replace")
        for raw_line in warn_text.splitlines():
            normalized = raw_line.strip()
            if not normalized:
                continue
            lowered = normalized.lower()
            if any(keyword in lowered for keyword in keywords):
                lines.append(normalized)

    deduplicated: list[str] = []
    for line in lines:
        if line not in deduplicated:
            deduplicated.append(line)
    return deduplicated


def _classify_warning_lines(lines: list[str]) -> tuple[list[str], list[str], list[dict[str, str]]]:
    optional_keywords = tuple(OPTIONAL_WARNING_KEYWORDS)
    actionable: list[str] = []
    optional_noise: list[str] = []
    accepted_noise: list[dict[str, str]] = []

    for line in lines:
        lowered = line.lower()
        matched_rule = next(
            (
                reason
                for prefix, reason in ACCEPTED_WARNING_RULES
                if lowered.startswith(prefix.lower())
            ),
            None,
        )
        if matched_rule is not None:
            accepted_noise.append({"line": line, "reason": matched_rule})
            continue
        if any(keyword in lowered for keyword in optional_keywords):
            optional_noise.append(line)
        else:
            actionable.append(line)

    return actionable[:12], optional_noise[:12], accepted_noise[:12]


def _write_report(
    report_path: Path,
    *,
    target: str,
    size_bytes: int,
    duration_seconds: float,
    warning_summary: list[str],
    warning_categories: dict[str, list[str]],
    warning_notes: dict[str, list[dict[str, str]]],
) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "target": target,
        "size_bytes": size_bytes,
        "duration_seconds": round(duration_seconds, 2),
        "warning_summary": warning_summary,
        "warning_categories": warning_categories,
        "warning_counts": {key: len(value) for key, value in warning_categories.items()},
        "warning_notes": warning_notes,
    }
    report_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    build_root = repo_root / ".pyinstaller"
    dist_root = build_root / "dist"
    work_root = build_root / "build"
    spec_root = build_root / "spec"
    output_root = repo_root / "src-tauri" / "binaries"

    output_root.mkdir(parents=True, exist_ok=True)
    build_root.mkdir(parents=True, exist_ok=True)

    build_started_at = time.perf_counter()
    result = subprocess.run(
        _build_command(repo_root, dist_root, work_root, spec_root),
        cwd=repo_root,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    build_duration = time.perf_counter() - build_started_at

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise SystemExit(result.returncode)

    source_exe = dist_root / "pengbo-sidecar.exe"
    source_dir = dist_root / "pengbo-sidecar"
    if source_dir.exists():
        source_exe = source_dir / "pengbo-sidecar.exe"
    target_exe = output_root / f"pengbo-sidecar-{args.target}.exe"
    target_dir = output_root / "pengbo-sidecar"
    if target_dir.exists():
        shutil.rmtree(target_dir)
    if source_dir.exists():
        shutil.copytree(source_dir, target_dir)
    shutil.copy2(source_exe, target_exe)

    warning_lines = _extract_warning_lines(
        f"{result.stdout}\n{result.stderr}",
        work_root / "pengbo-sidecar" / "warn-pengbo-sidecar.txt",
    )
    actionable_warnings, optional_warning_noise, accepted_warning_noise = _classify_warning_lines(warning_lines)
    warning_summary = actionable_warnings
    if not warning_summary:
        warning_summary = [item["line"] for item in accepted_warning_noise] or optional_warning_noise
    _write_report(
        repo_root / "logs" / "sidecar-build-latest.json",
        target=args.target,
        size_bytes=target_exe.stat().st_size,
        duration_seconds=build_duration,
        warning_summary=warning_summary,
        warning_categories={
            "actionable": actionable_warnings,
            "accepted_packaging_noise": [item["line"] for item in accepted_warning_noise],
            "optional_dependency_noise": optional_warning_noise,
        },
        warning_notes={
            "accepted_packaging_noise": accepted_warning_noise,
        },
    )

    print(f"sidecar_path={target_exe}")
    print(f"sidecar_size_bytes={target_exe.stat().st_size}")
    print(f"build_duration_seconds={build_duration:.2f}")
    if warning_summary:
        print("warning_summary:")
        for line in warning_summary:
            print(f"- {line}")
    else:
        print("warning_summary: clean")
    if optional_warning_noise:
        print("optional_dependency_noise:")
        for line in optional_warning_noise:
            print(f"- {line}")
    if accepted_warning_noise:
        print("accepted_packaging_noise:")
        for item in accepted_warning_noise:
            print(f"- {item['line']} :: {item['reason']}")


if __name__ == "__main__":
    main()
