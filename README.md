# Pengbo Workbench

Pengbo Workbench is a local-first desktop financial terminal built with Tauri, React, FastAPI, SQLite, and DuckDB. It combines research, screening, portfolio analysis, factor exploration, strategy simulation, workflow automation, and read-only data-source inspection in one packaged desktop shell.

The current product is designed for local desktop use. It is not a hosted web service, and the local FastAPI sidecar is expected to bind to `127.0.0.1`.

## Workspaces

- Dashboard: runtime readiness, market pulse, watchlist, and handoffs into the main workflows.
- Asset: quote/history views, provider capability state, filings/fundamentals context, and multi-period charts.
- Research: durable local briefs, structured analysis modules, notes, exports, and handoffs from screeners and data sources.
- Screeners: preset-driven and variant-tuned screening with bounded user controls.
- Portfolio: offline-first holdings, transactions, valuation states, analytics, and allocation views.
- Factor Lab: research-only factor runs across equities, ETFs/index proxies, indexes, and crypto.
- Strategy Lab: local backtests, paper trading ledgers, Binance execution intents, risk evidence, and audit context.
- Workflow Studio: template-driven local workflows with explicit manual boundaries.
- Data Sources: read-only source catalog, provenance, credential status, cache behavior, and report export.
- Manual: product guidance, safety boundaries, workflow explanations, and translation status.

## Safety Boundaries

- Non-Binance providers are read-only and must not create live trading paths.
- Binance live execution remains default-off, risk-gated, kill-switch gated, and user-confirmed.
- Workflow Studio may create a Binance intent artifact, but submit requires an explicit user-owned confirmation step.
- Provider secrets, Stronghold data, local databases, smoke artifacts, and generated binaries should not be committed to a public repository.
- API source code can be committed; API keys, tokens, secrets, local identities, and provider credentials must not be committed.
- Current sensitive values include EDGAR identity, Binance API key/secret, FRED key, CoinGecko key, and `PENGBO_TRANSLATION_API_KEY`.
- Stronghold is a local single-user desktop secret store. It is not a multi-user permission system and does not protect against higher-privilege processes on the same machine.
- Public network exposure, multi-user accounts, sessions, and hosted operation are deferred until the relevant security tasks are explicitly selected and implemented.

See [docs/SECURITY_ARCHITECTURE.md](docs/SECURITY_ARCHITECTURE.md) and [docs/REPOSITORY_UPLOAD_READINESS.md](docs/REPOSITORY_UPLOAD_READINESS.md) for the current local-first boundary.

## Local Development

Install JavaScript dependencies:

```powershell
npm install
```

Install Python dependencies in your preferred virtual environment:

```powershell
py -m pip install -r backend/requirements.txt
```

Run the web shell and local sidecar in separate terminals:

```powershell
npm run dev
npm run backend:dev
```

Build the web shell:

```powershell
npm run typecheck
npm run build
```

Build the Python sidecar payload used by the Tauri bundle:

```powershell
npm run sidecar:build
```

Build the packaged desktop app:

```powershell
npm run tauri:build
```

## Validation

Common validation commands:

```powershell
py -m unittest discover -s backend/tests -p "test_*.py"
npm run typecheck
npm run build
```

Packaged smoke checks should be run serially because they start and stop the same release executable and may backup/restore the same AppData-backed runtime directory:

```powershell
npm run smoke:packaged-startup
npm run smoke:data-sources:packaged
npm run smoke:workflow-studio:packaged
```

Run only the smoke checks relevant to the files changed in a given task. Documentation-only and ignore-only changes normally do not require packaged smoke validation.

## Repository Upload Notes

This repository should be uploaded as source plus documentation, not as a packaged release directory. Generated outputs such as `dist/`, `src-tauri/target/`, `src-tauri/binaries/`, local runtime data, logs, diagnostics, secrets, and Stronghold stores are intentionally ignored for public upload.

`src-tauri/tauri.conf.json` references `../logs/sidecar-build-latest.json` as a local package resource. That file is produced by `npm run sidecar:build`, may contain machine-local build paths, and should be regenerated locally rather than committed as source.

If a fresh checkout needs packaged desktop artifacts, rebuild them locally with `npm run sidecar:build` and `npm run tauri:build`.
