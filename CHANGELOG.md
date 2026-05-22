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
- T68 aligns local report exports into evidence-pack Markdown with provider
  status, freshness, evidence-quality labels, audit references where available,
  private-state exclusion language, and a release-artifact check for the first
  GitHub Release upload.
- T69 adds a compact Command Center workspace for common reviewer and operator
  actions: asset search, Research brief entry, provider refresh, local report
  export, audit review, and no-secret readiness checks.
- T69# Temp generates a Hyperframes video walkthrough from real packaged
  desktop frames covering local unlock, AAPL selection, 12-1 Momentum factor
  selection, Top-N Factor Rotation selection, and a simulated backtest result.
- T70 adds a local-only first-run onboarding checklist that explains no-key
  demo mode, provider setup, local unlock, privacy and diagnostics boundaries,
  and confirmation-gated execution before reviewers enter sensitive workspaces.
- T71-T73 add provider capability governance, normalized credential states, and
  provider freshness/cache policy metadata so Connections, Data Sources,
  provenance, and evidence-pack exports can distinguish fresh, cached, stale,
  refresh-failed, offline, credential-required, and unsupported evidence.
- T74 adds a structured data-quality status contract for completeness,
  timeliness, source confidence, and limitations across Data Sources,
  Research, Portfolio, Screeners, Factor Lab, provenance payloads, and local
  evidence-pack exports.
- T75 aligns provenance UI and Research evidence-pack export language: Research
  now exposes audit IDs and linked portfolio provenance, while Portfolio summary
  and holding surfaces show additive valuation, transaction, benchmark, and
  performance source references.
- T76 audits existing provider contracts and corrects visible provider
  metadata: Public Market Data now names Yahoo/Binance-public coverage, RSS
  Events points to Google News RSS, CoinGecko demo/pro credentials are
  described consistently, and CoinGecko history is shown as unsupported until
  implemented.
- T77 validates Data Sources in the packaged desktop EXE: the page now shows a
  packaged catalog summary for nine read-only providers, the data-source report
  includes the full provider contract table, and
  `npm run smoke:data-sources:packaged` records source-safe evidence for
  catalog contracts, credential state, freshness/cache readiness, provenance,
  exports, configured-key state, and unsupported capability boundaries.
- T78 adds a default-off local AI runtime probe. The backend can report AI
  disabled state or perform a short-timeout Ollama localhost probe, with
  source-safe evidence recorded without downloading models or exposing secrets.
- T79 adds the AI permission boundary before generation or UI promotion:
  AI-specific session permissions, route classifications, local-unlock-gated
  Research context previews, redacted notes, and `ai_assistant` audit events.
- T80 adds the local Research Assistant backend generation path: disabled AI
  returns an audited blocked response, while enabled local mode produces
  grounded summaries, questions, risks, limitations, citations, and Markdown
  from existing Research evidence.
- T81 embeds the assistant into the Research workflow with explicit context
  preview and generation controls, visible citations/limitations/blocked
  states, and a save-to-notes handoff without creating a separate chatbot
  workspace.
- T82 adds evidence-grounded prompt templates for research summary, thesis,
  counter-thesis, earnings review, portfolio risk, provider limitation, and
  report rewrite. The Research assistant UI can select templates, and
  regression coverage keeps output inside local evidence boundaries.
- T83 adds explicit cloud LLM opt-in controls. Cloud mode is disabled by
  default, status only exposes configured/not-configured flags, Research must
  select Cloud and acknowledge the current redacted context preview before any
  request can leave the machine, and Settings/Manual now surface the boundary.
- T84 validates the AI Research assistant in the packaged release EXE with a
  serial smoke covering local-disabled, local-enabled, cloud-disabled,
  cloud-opt-in-without-key, stale evidence, blocked evidence, redaction,
  audit, and export flows.
- The first GitHub Release is published as
  [v0.1.0](https://github.com/LaurenceFang/pengbo-workbench/releases/tag/v0.1.0)
  with approved Windows desktop artifacts.

## Upcoming

- T85 will study cautious China-market data-source options.
