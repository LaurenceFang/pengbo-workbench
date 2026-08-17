# Pengbo 全量 UI 重构交接规格

Status: T96-T104 implemented / M1 acceptance pending; T105/T106 incomplete
Scope: T102-T106 plus all existing ViewKey pages
Baseline: T98 Design Tokens, T99 Navigation IA, T100 AppShell, T101 Light Mode First

The registered `E:\彭博\Pengbo_UI_Rebuild.svg` is the immutable visual acceptance
baseline for this correction. T104 closes the route-aware InspectorContext
contract; it does not implement the T105 state dictionary or T106 screenshot
baseline.

Figma status: the new editable Foundation board exists at [Pengbo Workbench — T102–T106 UI Rebuild](https://www.figma.com/design/SxyuMBUa9U9Seoe1CwGeEv). P1/P2/P3 page-node writes are pending because the current Figma Starter MCP account has reached its tool-call limit; the PRD and this handoff are the source-safe implementation contract until that limit is lifted.

## Product boundary

- Preserve Tauri + React + FastAPI + SQLite/DuckDB and existing `/api/v1/*` contracts.
- Preserve seven navigation groups, fourteen existing `ViewKey` pages, `nav-<ViewKey>` anchors, selected-asset/research handoffs, local unlock and audit semantics.
- Do not add hosted accounts, remote sync, public API promises, provider secrets, or new live-trading paths.
- Non-Binance providers remain read-only; Binance execution remains default-off, risk-gated, kill-switch-gated, audited and explicitly confirmed.

## ViewKey registry

| ViewKey | React entry | Navigation group | Unlock gate |
|---|---|---|---|
| `dashboard` | `src/views/dashboard-view.tsx` | Home | No |
| `commandCenter` | `src/views/command-center-view.tsx` | Home | No |
| `asset` | `src/views/asset-view.tsx` | Markets | No |
| `watchlist` | `src/views/watchlist-view.tsx` | Markets | No |
| `research` | `src/views/research-view.tsx` | Research | Yes |
| `portfolio` | `src/views/portfolio-view.tsx` | Portfolio | Yes |
| `dataSources` | `src/views/data-sources-view.tsx` | Markets | Yes |
| `factorLab` | `src/views/factor-lab-view.tsx` | Factor Lab | Yes |
| `strategyLab` | `src/views/strategy-lab-view.tsx` | Factor Lab | Yes |
| `workflowStudio` | `src/views/workflow-studio-view.tsx` | Automation | Yes |
| `screeners` | `src/views/screeners-view.tsx` | Automation | No |
| `connections` | `src/views/connections-view.tsx` | Settings | Yes |
| `settings` | `src/views/settings-view.tsx` | Settings | Yes |
| `manual` | `src/views/manual-view.tsx` | Settings | No |

The repository contains fourteen `ViewKey` values and the navigation contract currently verifies seven groups covering all fourteen.

## Page handoff template

Every page design and implementation record must specify:

```text
ViewKey / React entry
User goal / primary action / non-goals
API methods and TypeScript response types
State owner and handoff fields
loading / ready / empty / cached / offline / degraded / credential-required / locked / blocked / error
Reusable primitives and forbidden duplicate controls
Locked and read-only behavior
1440 / 1180 / 960 responsive behavior
Figma file, page, node-id and frame name
Required DOM anchors and acceptance commands
```

## Shared UI mapping

| Design responsibility | React/CSS target |
|---|---|
| Shell | `AppShell`, `AppSidebar`, `AppToolbar`, `ContextRail` |
| Tokens/theme/density | `src/styles.css`, `data-theme`, `density-standard/compact` |
| Primitives | `src/components/ui-kit.tsx`, `src/components/button.tsx` |
| Shared states | `PanelState`, `InlineState`, `DataStatusStrip`, `EmptyState` |
| DataTable | `DataTable`, stable row keys, fixed identifier column, overflow handling |
| Inspector | `InspectorPanel`, evidence/data-status/parameter sections |
| Navigation | `src/navigation.ts`, `nav-group-*`, `nav-<ViewKey>` |

## P1 Core Research Loop

Implement and verify in this order:

1. Dashboard: clear research entry, runtime/setup state, market pulse and first CTA.
2. Command Center: asset/page/action search with empty, found and blocked states.
3. Asset: quote/fundamentals/source freshness, cached/degraded states and research handoff.
4. Data Sources: provider health, freshness, provenance, credential-required and read-only states.
5. Research: brief creation, evidence chain, AI context, limitations and local export.

P1 is complete only when the five pages share the same Shell, primitives, status language, DataTable and Inspector behavior without changing business/API contracts.

## State matrix

| State | Required UI behavior |
|---|---|
| loading | Explain what is loading; prevent duplicate submissions. |
| ready/live | Show usable data, source and freshness. |
| empty | Explain why there is no data and offer one next action. |
| cached/offline | Say that data is cached/local; never imply live freshness. |
| degraded/unavailable | Explain missing coverage and recovery options. |
| credential-required | Link to Connections without exposing secrets. |
| locked | Show LocalUnlockGate; hide sensitive context and data. |
| blocked | Explain the safety/policy reason; never offer a bypass. |
| error | Preserve the real error class and offer retry/diagnostics. |

## Verification commands

```powershell
npm.cmd run typecheck
npm.cmd run web:build
npm.cmd run check:t102-106
npm.cmd run check:design-tokens
npm.cmd run check:navigation-ia
npm.cmd run check:app-shell
npm.cmd run check:theme-preference
npm.cmd run check:i18n
npm.cmd run smoke:app-shell
node scripts/p1_render_smoke.mjs
```

Visual evidence must record viewport, theme, density, language, runtime/data mode, expected security blocks, console errors and screenshot paths. Expected 403 responses from local security endpoints are not equivalent to skipped verification; they must be recorded separately from real failures.

## Migration waves

- P1: Dashboard, Command Center, Asset, Data Sources, Research.
- P2: Watchlist, Portfolio, Connections, Settings, Manual.
- P3: Screeners, Factor Lab, Strategy Lab, Workflow Studio.
- Final T106 gate: all fourteen pages, responsive screenshots, key states, navigation, unlock, theme/density and console/network evidence.
