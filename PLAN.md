# Pengbo Workbench Current Plan

Pengbo Workbench is a Windows-first, local-first desktop financial research
terminal. It uses Tauri, React, FastAPI, SQLite, and DuckDB to keep the primary
workflow on the user's machine instead of turning the project into a hosted SaaS
account.

## Product Position

The near-term goal is one reliable research loop:

1. Choose an asset, market theme, or data source.
2. Inspect freshness, provenance, credentials, and local cache state.
3. Build a research brief with evidence.
4. Connect the brief to portfolio, factor, or strategy context.
5. Export a local report with explicit assumptions and safety boundaries.

Pengbo is not trying to clone every Bloomberg surface at once. The first public
line should be useful, understandable, local, auditable, and honest about what
is implemented.

## Current Runtime Boundary

- The desktop shell starts a local FastAPI sidecar on loopback.
- SQLite stores user-facing app state.
- DuckDB stores local analytical/cache snapshots.
- Stronghold and environment injection are used for provider secret material;
  raw secrets must not be stored in SQLite, DuckDB, logs, diagnostics, exports,
  or API responses.
- Non-Binance data providers are read-only.
- Binance execution remains default-off, risk-gated, kill-switch gated,
  audited, and explicitly user-confirmed.
- No hosted accounts, remote sync, public API, team permissions, or public
  network exposure are part of the current product.

## Current Workspaces

- Dashboard: runtime readiness, market pulse, watchlist, and workflow handoffs.
- Asset: quote/history, provider capability, filings, fundamentals, and charts.
- Research: durable local briefs, notes, analysis modules, and exports.
- Screeners: preset-driven and variant-tuned screening.
- Portfolio: offline-first holdings, transactions, analytics, and allocation.
- Factor Lab: local research-only factor runs and handoffs.
- Strategy Lab: local backtests, paper ledgers, Binance intents, and evidence.
- Workflow Studio: template-driven workflows with explicit manual boundaries.
- Data Sources: packaged source-catalog coverage, provenance, cache state, and export.
- Connections: provider capability, credential status, and local secret bridge.
- Settings: runtime paths, preferences, diagnostics, and version evidence.
- Manual: product guidance and safety boundaries.

## Roadmap Focus

The security-accountability sequence T53-T56 is complete. T57 added the explicit
Apache-2.0 source license and public repository boundary.

The active product-trust sequence is:

- T58: version governance cleanup. Completed.
- T59: no-secret GitHub Actions CI baseline. Completed.
- T60: demo mode and no-key startup. Completed.
- T61: release artifact naming and checklist. Completed.
- T62: README product proof upgrade. Completed.
- T63: contributor entry kit. Completed.
- T64: research flow definition. Completed.
- T65: asset-page research entry. Completed.
- T66: data-status strip consistency. Completed.
- T67: research-brief quality. Completed.
- T68: report evidence packs and first GitHub Release upload. Completed.
- T69: command center for frequent reviewer and operator actions. Completed.
- T69# Temp: real packaged-desktop video walkthrough. Completed.
- T70: first-run onboarding for reviewer setup and safety boundaries. Completed.
- T71: provider capability matrix. Completed.
- T72: provider credential state model. Completed.
- T73: provider freshness and cache policy. Completed.
- T74: data-quality status contract. Completed.
- T75: provenance UI/export sync. Completed.
- T76: existing provider audit. Completed.
- T77: Data Sources packaged signoff. Completed.
- T78: local LLM runtime probe. Completed.
- T79: AI permission boundary. Completed.
- T80: research assistant backend. Completed.
- T81: research assistant UI. Completed.
- T82: evidence-grounded prompt layer. Completed.
- T83: cloud LLM explicit opt-in. Completed.
- T84: AI research packaged signoff. Completed.
- T85: China-market data source study. Completed.
- T86: connector manifest contract. Completed.
- T87: connector test harness. Completed.
- T88: A-share read-only connector v1. Completed.
- T89: HK/China macro connector v1. Completed.
- T90: China-market research template. Completed.
- T91: connector packaged signoff. Completed.
- T92: credential audit trail hardening. Completed.
- T93: sensitive workspace lock rules. Completed.
- T94: security packaged signoff. Completed.
- T95+: next-stage master task pool selected for UI redesign, first useful
  research loop, multi-model AI, data depth, professional workflows, Quant
  Factor Lab, release hardening, safety, and commercialization.

The current research-flow map is tracked in
[docs/research-flow-definition.md](docs/research-flow-definition.md).
The cautious China-market source plan is tracked in
[docs/china-market-source-study.md](docs/china-market-source-study.md).

## Validation Principle

Pengbo is desktop software, so important release-readiness claims should be
validated against the real packaged executable when the task touches packaged
runtime behavior. Browser-only checks are useful for fast UI feedback but are
not sufficient for packaged desktop signoff.

The current local unsigned packaging checklist is tracked in
[docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).
