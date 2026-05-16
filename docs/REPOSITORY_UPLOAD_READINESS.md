# Repository Upload Readiness

Updated: 2026-05-16

This document defines the public-repository boundary for Pengbo Workbench. The goal is to upload source and documentation without leaking local runtime data, provider secrets, smoke artifacts, generated binaries, or machine-specific state.

## Commit By Default

- Source code under `src/`, `backend/app/`, `backend/tests/`, `scripts/`, and `src-tauri/src/`.
- Configuration and manifests needed to rebuild locally: `package.json`, `package-lock.json`, TypeScript configs, Vite config source, `backend/requirements.txt`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, Tauri capabilities, and icons.
- Product and engineering documentation: `README.md`, `IMPLEMENTATION_TASKS.md`, `PLAN.md`, `open-source-bloomberg-terminal-report.md`, and curated files under `docs/`.
- Small checked-in fixtures or seed definitions that are required by tests or local demo flows.

## Do Not Commit

- Provider secrets or identity values, including EDGAR identity, Binance API key/secret, FRED key, CoinGecko keys, `PENGBO_TRANSLATION_API_KEY`, and future broker credentials.
- Stronghold vaults, local credential stores, `.env*` files, PEM/key material, and any file whose purpose is storing secrets.
- Local runtime data: `.pengbo-runtime/`, AppData-backed SQLite/DuckDB stores, diagnostics, generated reports, and desktop automation state.
- Generated dependency/build output: `node_modules/`, `dist/`, `.pyinstaller/`, Python caches, TypeScript build info, `src-tauri/target/`, Tauri bundles, MSIs, NSIS installers, PDBs, DLLs, EXEs, and Rust build products.
- Generated sidecar payloads under `src-tauri/binaries/`. Recreate them with `npm run sidecar:build`.

## Optional Diagnostic Evidence

- Public repository default: do not commit `logs/` or `logs/*-latest.json`; summarize important smoke evidence in `IMPLEMENTATION_TASKS.md` instead.
- Private release-review branch: selected redacted smoke JSON files may be committed only after checking that they contain no secrets, local account identifiers, real email addresses, or machine-specific data beyond acceptable build paths.
- `logs/provider-capability-signoff-latest.json` can include an EDGAR credential summary from smoke validation. Confirm the address is a synthetic test identity before sharing any redacted evidence.
- `logs/sidecar-build-latest.json` is referenced by the Tauri package config as a generated local resource. It is created by `npm run sidecar:build`, may include machine-local build paths, and must not be treated as source for public upload.
- Screenshots or UIAutomation captures should be treated as diagnostic artifacts, not source. Commit only curated, non-sensitive images that are directly referenced by documentation.

## Pre-Upload Checklist

1. Confirm `.gitignore` excludes runtime data, generated binaries, caches, secrets, logs, and packaged artifacts.
2. Confirm `README.md` describes the local-first architecture, workspace map, safety boundaries, and rebuild commands.
3. Confirm `docs/SECURITY_ARCHITECTURE.md` remains aligned with the public-upload boundary.
4. Confirm no raw secrets appear in committed docs or source comments.
5. Confirm `PENGBO_TRANSLATION_API_KEY` and any future translation provider keys are handled as secrets.
6. Confirm `logs/*.json` is ignored and not staged or tracked before the first public commit.
7. If initializing Git locally, inspect `git status --short --ignored` before the first commit and remove any accidental generated artifacts from the candidate set.

## Rebuild Notes

The public source tree is expected to rebuild generated desktop assets locally:

```powershell
npm install
py -m pip install -r backend/requirements.txt
npm run sidecar:build
npm run tauri:build
```

Packaged smoke scripts should be run serially because they share the release executable and AppData-backed runtime directory.
