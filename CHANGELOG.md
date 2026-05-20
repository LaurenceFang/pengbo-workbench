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
- T60 adds a no-key demo evaluation path, explicit `/settings/demo-mode`
  readiness state, sample guidance for key surfaces, Vite dev origin allowance,
  and a repeatable `npm run smoke:demo-no-key` validation script.
- T61 refreshes the local unsigned Windows packaging baseline, documents the
  first-reviewer release checklist, and hardens MSI/NSIS installed startup
  validation around the onedir sidecar layout.
- T62 upgrades README product proof with source-safe screenshots and a practical
  reviewer journey across Dashboard, Research, Data Sources, Workflow Studio,
  and Manual local-security boundaries.
- T63 adds a contributor entry kit with setup expectations, safe contribution
  boundaries, first-issue candidates, and issue templates that avoid hosted,
  signed-release, live-trading, and credential-support promises.
- T64 defines the primary research flow across Asset, Data Sources, Research,
  evidence comparison, local report export, and audit handoffs before the next
  page-polish tasks.
- T65 makes the Asset page a clearer symbol-first research entry with local data
  status, portfolio exposure, related brief state, and direct Research, evidence,
  report, and Data Sources actions.
- T66 adds a shared data-status strip across Asset, Research, and Data Sources
  so provider freshness, credentials, cache/degraded state, and read-only or
  execution boundaries use consistent cautious language.
- T67 upgrades Research briefs with an additive structured decision review:
  thesis, assumptions, supporting evidence, counter-evidence, risks, watch
  items, provenance, conclusion boundary, and equity/crypto/portfolio/macro
  templates.

## Upcoming

- T68 will align local report exports into evidence packs and finish with the
  first GitHub Release upload after artifact, release-note, and secret/private
  state checks pass.
