# Pengbo Workbench Release Checklist

Updated: 2026-06-03

This checklist records the local first-reviewer packaging path for Pengbo Workbench `0.1.0`.

## Release Status

- Channel: local unsigned Windows pre-release.
- Upload status: first GitHub Release uploaded at `https://github.com/LaurenceFang/pengbo-workbench/releases/tag/v0.1.0`.
- Signing status: unsigned.
- Auto-update status: not configured.
- Distribution boundary: local reviewer artifact only, not a hosted service or production binary channel.

## Local Artifacts

Regenerate artifacts locally before sharing them:

```powershell
npm run sidecar:build
npm run tauri:build
```

Expected local artifact paths:

- `src-tauri/target/release/pengbo-workbench.exe`
- `src-tauri/target/release/bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/nsis/Pengbo Workbench_0.1.0_x64-setup.exe`

Generated binaries, installers, sidecar payloads, smoke logs, runtime data, diagnostics, Stronghold vaults, and provider credentials stay outside source control.

## Validation Sequence

Run source and boundary checks first:

```powershell
py -m pip install -r backend/requirements.txt
py -m pytest backend/tests
npm run check:version
npm run check:public-boundary
npm audit --audit-level=moderate
npm run typecheck
npm run build
npm run smoke:demo-no-key
```

Then refresh and validate the desktop artifacts:

```powershell
npm run sidecar:build
npm run tauri:build
npm run smoke:packaged-startup
npm run smoke:installed-startup
npm run smoke:installed-startup:nsis
npm run smoke:gateway-hardening:packaged
npm run smoke:security:packaged
npm run smoke:evidence-report
npm run smoke:data-sources:packaged
npm run check:release-artifacts
git diff --check
```

Packaged smoke checks should run serially because they start, stop, install, and uninstall the same desktop application and sidecar process.

## Current T61 Evidence

The T61 packaging pass refreshed the EXE, MSI, and NSIS outputs locally and validated:

- packaged EXE startup
- MSI installed startup
- NSIS installed startup
- no-key demo startup
- local loopback sidecar boundary
- installed onedir sidecar layout

The installed bundle must resolve the sidecar at `binaries\pengbo-sidecar\pengbo-sidecar.exe`. A root-level `pengbo-sidecar.exe` without its `_internal` directory is invalid because it can trigger a Python DLL load error.

## Reviewer Notes

Pengbo Workbench is local-first desktop software. The sidecar should bind to `127.0.0.1`, and non-Binance providers remain read-only. Binance live execution remains default-off, risk-gated, kill-switch gated, audited, and explicitly user-confirmed.

This checklist is a packaging readiness artifact, not a promise of signed production distribution.

## T68 GitHub Release Gate

Before uploading the first GitHub Release:

- Confirm `npm run check:public-boundary` passes.
- Confirm `npm run check:release-artifacts` passes.
- Upload only the approved Windows artifacts listed above plus release notes.
- Do not upload runtime data, logs, diagnostics bundles, Stronghold vaults, provider credentials, unlock secrets, session tokens, SQLite/DuckDB databases, AppData state, or source-ignored private folders.
- Record the GitHub Release URL in `IMPLEMENTATION_TASKS.md` after upload.

## T68 Evidence

- Refreshed artifacts:
  - `src-tauri/target/release/pengbo-workbench.exe` at `16,393,216 bytes`
  - `src-tauri/target/release/bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi` at `124,547,556 bytes`
  - `src-tauri/target/release/bundle/nsis/Pengbo Workbench_0.1.0_x64-setup.exe` at `89,355,099 bytes`
- Packaged evidence report smoke passed with full factor/backtest/paper/execution evidence links, `evidence_audit_count=2`, export creation, and restart restore.
- Packaged Data Sources smoke passed with five read-only providers and report export creation.
- MSI and NSIS installed startup smokes passed with root sidecar absent, single-instance behavior, and adopt-existing behavior.

## T94 Security Signoff Gate

Before the next real release cycle, confirm the packaged security signoff smoke passes after the sidecar bundle is rebuilt:

```powershell
npm run sidecar:build
npm run smoke:security:packaged
```

The smoke evidence is written to `logs/security-signoff-packaged-smoke-latest.json` and must remain source-safe. It verifies local unlock/session flow, sensitive route locking, Research and Data Sources export redaction, security audit events, route classification, gateway rejection behavior, and SQLite plaintext-secret absence without adding hosted accounts, remote sync, public API exposure, or non-roadmap live trading scope.
