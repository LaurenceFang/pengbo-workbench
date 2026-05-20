# Research Flow Definition

Updated: 2026-05-20

T64 defines the primary Pengbo research journey before the next UI polish tasks.
The goal is one visible loop that a user, reviewer, or contributor can optimize
around instead of treating Dashboard, Asset, Research, Data Sources, Workflow
Studio, Factor Lab, Strategy Lab, and exports as disconnected surfaces.

This document is a product-flow map. It does not change runtime behavior, API
contracts, credential handling, packaging, hosted support, public API exposure,
or live-trading behavior.

## Primary Journey

1. Start from Dashboard, search, or an existing workspace handoff.
2. Open an Asset workspace for the symbol or market object.
3. Inspect data status: provider availability, freshness, stale/cache state,
   credential requirements, and read-only versus execution-sensitive capability.
4. Open or create a Research brief for the same symbol.
5. Review the brief snapshot: asset overview, fundamentals, filings, analysis
   modules, source context, and notes.
6. Compare evidence: screener matches, factor runs, strategy backtests, paper
   sessions, Binance intent state, execution blocks, and audit summary.
7. Write the thesis, assumptions, risk notes, and user-owned conclusions in the
   brief notes.
8. Export a local report with provenance, evidence, stale/degraded state, and
   safety boundaries.
9. Revisit audit or workflow evidence only when the research decision depends on
   security-sensitive or execution-sensitive history.

The first release should make this loop reliable for a no-key reviewer and for a
local user with optional provider credentials. It should not require private
keys, hosted accounts, public network exposure, signed releases, or live order
submission.

## Existing Surface Map

| Step | Current surface | Current API or state | What it already proves |
| --- | --- | --- | --- |
| Choose symbol | Dashboard, Asset search, Research search, command palette | `/api/v1/search/assets`, `selectedAssetId` | A user can choose a supported local catalog asset without credentials. |
| Inspect asset | Asset workspace | `/api/v1/assets/{symbol}/workspace` | Quote, history, overview, ratios, filings, provider capability, and stale state are available in one symbol view. |
| Inspect data status | Asset, Connections, Data Sources | `/api/v1/connections/catalog`, `/api/v1/data-sources/status` | Provider coverage, credential requirements, cache behavior, freshness, provenance, read-only status, and unsupported states can be shown without committing secrets. |
| Create brief | Research, Workflow Studio | `/api/v1/research/briefs`, `screener_to_research`, `data_sources_to_research` | A durable local brief can be created from a symbol, screener context, or data-source context. |
| Refresh brief | Research | `/api/v1/research/briefs/{brief_id}/refresh` | EDGAR-gated or provider-backed snapshots can be refreshed after credentials are configured. |
| Compare evidence | Research evidence chain | `/api/v1/research/evidence/{symbol}` | Factor, screener, strategy, paper session, Binance intent, and audit summaries can be composed into one read-only context. |
| Export report | Research, Data Sources, Strategy, Workflow Studio | `/api/v1/research/briefs/{brief_id}/export`, `/api/v1/data-sources/reports/export`, `/api/v1/strategies/reports/{artifact_id}/export`, `evidence_report_export` | Local Markdown reports can include provenance, assumptions, evidence, and safety boundaries. |
| Review audit | Research evidence chain, Workflow Studio, Strategy Lab, security audit | `/api/v1/security/audit`, `/api/v1/execution/binance/audit`, workflow run audit events | Security-sensitive and execution-sensitive events remain local, redacted, and reviewable when they matter to evidence. |

## Entry Points

- Dashboard: good for no-key reviewers and runtime readiness, but it should
  hand off into the research loop without becoming another research page.
- Asset: should become the most practical first step for a symbol-driven user.
  T65 should make its research entry, data-status summary, and report handoff
  more obvious.
- Research: owns durable briefs, notes, evidence comparison, and research export.
  It should stay the canonical place for thesis, assumptions, and conclusion.
- Data Sources: owns provider provenance, read-only source health, cache state,
  and source report export. It should explain whether a source can support the
  current research loop.
- Screeners: provide candidates and rationale. Their handoff should create or
  open a brief without hiding the preset or variant context.
- Factor Lab and Strategy Lab: provide research-only or simulated evidence.
  Their outputs should feed the evidence chain without presenting factor scores
  or backtests as performance guarantees.
- Workflow Studio: orchestrates safe templates and evidence exports. It can
  prepare Binance intents, but submit remains explicit, user-confirmed, audited,
  risk-gated, and default-off.

## Output Model

The primary research output is a local evidence-backed Markdown report. A good
report should contain:

- Symbol, generated time, refreshed time, and stale or degraded state.
- Data-source provenance and credential-required notes where relevant.
- Brief thesis, assumptions, user notes, and risk boundaries.
- Structured analysis modules with source labels.
- Evidence chain summaries for factor, screener, backtest, paper, execution
  intent, and audit context when those artifacts exist.
- Clear language such as observed, cached, simulated, blocked, audited,
  unavailable, or credential_required. Avoid return guarantees or financial
  advice phrasing.

Data-source and strategy exports can remain separate files, but T68 should make
their relationship to the research report obvious: they are supporting evidence
packs, not unrelated diagnostics.

## Boundaries

- Non-Binance providers remain read-only.
- Binance live execution remains default-off, risk-gated, kill-switch gated,
  audited, and explicitly user-confirmed.
- Workflow Studio may create a Binance intent artifact but must not silently
  submit an order.
- Provider secrets, Stronghold vaults, runtime databases, local diagnostics,
  smoke logs, generated reports, packaged binaries, and installers remain
  outside the public source boundary.
- Audit surfaces should summarize redacted local events. They should not expose
  raw secrets, private provider responses, or account identifiers.
- T64 does not introduce hosted accounts, public API operation, remote sync,
  OAuth, team permissions, signing, update channels, or release publication.

## Current Dead Ends

- Asset has rich quote, history, fundamentals, and filings state, but it does
  not yet feel like the obvious first step into a research brief and final
  report.
- Data status is visible in several places, but the same provider/freshness/
  credential/degraded semantics are not yet presented as one consistent strip.
- Research has evidence-chain content, but the thesis, assumptions, conclusion,
  and risk-boundary structure still depends too much on free-form notes.
- Export flows exist for research, data sources, strategy, and workflow
  evidence, but the product story does not yet present them as one coherent
  report/evidence-pack system.
- Audit evidence exists across security, execution, and workflow records, but
  the user journey needs clearer guidance for when audit matters to research
  versus when it is simply background operational evidence.
- Data Sources can feed Research through workflow automation, but the Data
  Sources page itself does not yet make "create research brief from this source"
  feel like a first-class action.

## Follow-Up Mapping

- T65 - Asset Page Research Entry Polish: make Asset the practical symbol-first
  start of the research loop with visible data status, related brief state, and
  direct Research/report actions.
- T66 - Data Status Strip Everywhere: define and reuse one compact status strip
  for provider, freshness, read-only/trading capability, credential reason, and
  degraded/cache state.
- T67 - Research Brief Quality Upgrade: structure the brief around thesis,
  assumptions, evidence, notes, conclusion, and risk boundaries while preserving
  current export and evidence contracts.
- T68 - Report Export Evidence Pack: align research, data-source, strategy, and
  workflow exports into a coherent local evidence-pack story.
