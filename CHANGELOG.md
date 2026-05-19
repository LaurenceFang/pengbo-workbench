# Changelog

All notable public-facing changes for Pengbo Workbench are summarized here.

Pengbo uses `0.1.x` for the current local-first desktop pre-release line. The
app is not a hosted service, public API, remote account system, or signed binary
release channel yet.

## 0.1.0 - Current Pre-Release Baseline

- Local-first Tauri desktop shell with a FastAPI sidecar, SQLite, and DuckDB.
- Research, watchlist, screeners, portfolio, Factor Lab, Strategy Lab, Workflow
  Studio, Data Sources, Connections, Settings, and Manual workspaces.
- Binance live execution remains default-off, risk-gated, kill-switch gated,
  audited, and explicitly user-confirmed.
- T53-T56 completed the local security-accountability base: local unlock and
  idle lock, account-scoped credential metadata, local session permissions, and
  public-exposure gateway hardening.
- T57 added the Apache-2.0 source license and public repository boundary.
- T58 makes version metadata visible and consistent before CI, release, and demo
  mode work begins.
- T59 adds a no-secret GitHub Actions CI baseline for version consistency,
  public-boundary scanning, dependency audit, frontend checks, and backend tests.

## Upcoming

- T60 will define local release artifact naming and release checklist evidence.
- T61 will add a no-key demo/sample mode suitable for public evaluation.
