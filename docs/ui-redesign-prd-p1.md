# Pengbo UI Redesign PRD — P1 Core Research Loop

Status: T96-T104 implemented / M1 acceptance pending; T105/T106 incomplete

This correction follows the registered `E:\彭博\Pengbo_UI_Rebuild.svg` baseline.
T104 standardizes the route-aware Context Inspector contract; T105 and T106 are
intentionally outside this pass.
Scope: Dashboard, Command Center, Asset, Data Sources and Research
Baseline: T98–T101 contracts

## Problem

Pengbo already has the required workspaces, APIs, local cache and security gates, but the page-level experience does not make the research path obvious. Users need to understand where to start, whether data is trustworthy, what the next action is and how a result becomes an auditable local report.

## Goal

Design and implement one coherent local-first loop:

```text
start → find symbol → inspect source/freshness → create brief → review evidence → export local report
```

The loop must work with live, cached, degraded, offline, credential-required and locked states without implying real-time data or automatic trading.

## P1 pages

| Page | Primary job | Primary action | Required states |
|---|---|---|---|
| Dashboard | Make the next research action obvious | 开始研究 | ready, setup required, offline, demo, empty |
| Command Center | Find an asset, brief or action | 搜索并打开 | empty, found, no result, blocked, offline |
| Asset | Decide whether an asset is worth further research | 创建研究简报 | live/observed, cached, degraded, credential-required, unavailable |
| Data Sources | Understand source capability and freshness | 查看来源/进入 Connections | online, cached, stale, credential-required, unavailable, read-only |
| Research | Produce an evidence-aware local brief | 导出本地报告 | empty brief, evidence present, incomplete, locked, export success/blocked/failed |

## Non-goals

- No new API, ViewKey, provider, hosted account, remote sync or public network surface.
- No new live-trading or silent execution path.
- No secrets, Stronghold contents, real credentials or private local paths in Figma, fixtures, screenshots or logs.
- Do not turn Dashboard into an engineering monitoring console.
- Do not turn Research into an evidence-free general chat window.
- Do not complete Portfolio, Factor Lab, Strategy Lab or Workflow Studio in P1; preserve their existing handoffs for later waves.

## Product rules

- One primary action per page.
- Every empty or blocked state explains why and provides one safe next step.
- Cached/offline data must show freshness and provenance; never label it as live.
- Locked sensitive views show LocalUnlockGate and hide selected asset, evidence, credentials and execution context.
- Research output reserves space for evidence, provenance, limitations, data status and AI-generation notes.
- Cross-page actions carry existing `selectedAssetId`, `selectedResearchBriefId` and `pendingResearchSource` context.

## Given / When / Then acceptance

### Core path

- Given the user opens Dashboard, when the app is ready, then the page shows runtime status, current focus asset and one clear research CTA.
- Given the user searches from Dashboard or Command Center, when an asset is selected, then Asset opens with the same selected asset and visible source status.
- Given the user opens Asset or Data Sources, when data is cached, degraded or unavailable, then the page explains the limitation and does not imply live freshness.
- Given the user creates a Research brief, when Research opens, then the selected asset, source context and brief context are retained.
- Given the user exports a report, when export succeeds, is limited, blocked or fails, then the UI explains the local result and next step.

### Security and boundaries

- Given a sensitive ViewKey is locked, when it renders, then no sensitive workspace content or context rail details are exposed.
- Given a provider requires credentials, when the user views its status, then the UI offers the existing Connections path without exposing secrets.
- Given a write or execution action is blocked, when the user views the state, then the reason and safe recovery path are visible and no bypass is offered.

### Responsive and accessibility

- At 1440/1600px, Sidebar, Toolbar, Workspace and Inspector/Context Rail are readable together.
- At 1180px, the Inspector can collapse or become a Sheet without losing the primary action.
- At 960px, the layout becomes single-column and preserves selected asset, brief context and blocked reasons.
- Keyboard focus, labels, `aria-pressed`, `nav-<ViewKey>` anchors and Escape-to-close behavior remain valid.

## Design-to-code handoff

Each Figma frame must record its ViewKey, React entry, state variant, viewport, theme, density, primary action, locked behavior and mapped component. The code must reuse:

- `AppShell`, `AppSidebar`, `AppToolbar`, `ContextRail`;
- `src/navigation.ts` and existing app-store handoffs;
- semantic T98 tokens and T101 theme/density behavior;
- T102 primitives, T103 DataTable, T104 Inspector and T105 state components.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run web:build
npm.cmd run check:t102-106
npm.cmd run check:design-tokens
npm.cmd run check:navigation-ia
npm.cmd run check:app-shell
npm.cmd run check:i18n
npm.cmd run smoke:app-shell
node scripts/p1_render_smoke.mjs
```

The P1 implementation is not complete until all five pages render at 1600×1000 without runtime console errors, expected 403 security blocks are recorded separately, and the core path can be followed without changing existing API or security contracts.
