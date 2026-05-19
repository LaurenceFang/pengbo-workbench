# Pengbo Workbench Release Checklist

Updated: 2026-05-20

This checklist records the local first-reviewer packaging path for Pengbo Workbench `0.1.0`.

## Release Status

- Channel: local unsigned Windows pre-release.
- Upload status: no GitHub Release has been created or uploaded.
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
