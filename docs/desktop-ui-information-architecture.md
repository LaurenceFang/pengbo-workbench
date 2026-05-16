# Desktop UI Information Architecture

Status: T38 delivery spec  
Date: 2026-04-30  
Scope: structural UI architecture only. This document does not change runtime behavior, visual styling, localization dictionaries, provider behavior, or trading execution behavior.

## Goals

- Turn the current working desktop shell into a clear financial-terminal information architecture before visual redesign begins.
- Keep the current `Tauri + React + FastAPI + SQLite/DuckDB` architecture and the existing `/api/v1/*` contracts.
- Define where navigation, global status, command entry, active workspace content, and cross-page context should live.
- Give `T39`, `T40`, and `T41` a concrete implementation checklist so styling, localization, and page polish do not fight the shell structure.

## Current Structure Confirmed

- `src/App.tsx` owns the app shell, left navigation, topbar, global search, command-palette launch, runtime/provider setup banners, and active workspace rendering.
- `src/store/app-store.ts` owns the current frontend global context: active view, selected asset, selected research brief, selected screener/factor/strategy/paper contexts, command palette state, and command feedback.
- `src/views/*.tsx` owns page-specific workflows:
  - `dashboard-view.tsx`
  - `asset-view.tsx`
  - `research-view.tsx`
  - `factor-lab-view.tsx`
  - `strategy-lab-view.tsx`
  - `screeners-view.tsx`
  - `portfolio-view.tsx`
  - `connections-view.tsx`
  - `settings-view.tsx`
- `src/components/command-palette.tsx` owns the keyboard-first action surface.
- `src/components/shared.tsx` owns reusable status, chart, and inline-state primitives.
- `src/styles.css` owns the current global shell and page styling.

## Target Shell

The target desktop shell has four stable regions.

1. Left primary navigation
   - Current items: Dashboard, Asset, Research, Factor Lab, Strategy Lab, Screeners, Portfolio, Connections, Settings.
   - Reserved future items: Workflow Studio and Data Sources.
   - Each item must have a stable `ViewKey`, icon, short label, and automation-safe `aria-label`.
   - Navigation should remain a global workspace switcher, not a page-local tab system.

2. Top status and command area
   - Shows the current workspace title and compact status summary.
   - Keeps global asset search and command-palette launch visible.
   - Shows runtime health and provider summary without forcing users into Connections for every status check.
   - Must be able to surface command feedback and blocked-action feedback without page-specific banners taking over the shell.

3. Main workspace
   - Renders only one primary workspace at a time.
   - The shell owns the vertical scroll container; each page owns internal density, tables, charts, tabs, and local empty/error states.
   - Dashboard may show onboarding/setup banners, but other pages should avoid duplicating global runtime recovery UI unless the page-specific action is blocked.

4. Right context area
   - Reserved for cross-page context, not page decoration.
   - It should carry the current symbol, research brief, factor run, backtest, paper session, Binance intent, and provider health summary.
   - First implementation can be collapsible or narrow; the key rule is that this area should not be rebuilt independently by every page.

## Workspace Map

| Workspace | Primary job | Main content | Right-context needs |
| --- | --- | --- | --- |
| Dashboard | Runtime and market overview | Watchlist, runtime state, setup recovery, overview charts | Active symbol, provider summary, recent command feedback |
| Asset | Single-asset workspace | Quote, fundamentals, filings, charts, research handoff | Active symbol, provider availability, related brief/factor evidence |
| Research | Briefs and notes | Brief list/detail, notes, analysis modules, evidence chain, export | Active symbol, active brief, source artifacts |
| Factor Lab | Local factor research | Factor families, run setup, ranked results, diagnostics | Active factor run, selected symbol, handoff to Research |
| Strategy Lab | Backtests, paper trading, Binance intent prep | Backtest setup/results, paper sessions, execution intent/risk/audit | Active backtest, paper session, Binance intent, kill-switch state |
| Screeners | Preset and variant screening | Presets, variants, tuning, run results, factor evidence | Selected screener preset/variant/run, active symbol |
| Portfolio | Holdings and performance | Transactions, holdings, analytics, allocation, offline/degraded states | Active holding symbol, valuation freshness, portfolio handoff draft |
| Connections | Providers and credentials | Provider status, capability matrix, save/test/clear flows | Provider health, credential-required states |
| Settings | Runtime and preferences | Runtime diagnostics, onboarding, default view, preferences | Language/density preferences, diagnostics status |
| Workflow Studio | Future workflow orchestration | Templates, steps, run history, blocked reasons, artifact links | Active workflow run, manual-required Binance confirmation state |
| Data Sources | Future data-source control room | Provider coverage, freshness, credentials, source domains | Source health, provenance, credential requirements |

## Global Context Rules

Keep cross-page context in `src/store/app-store.ts` or a small store/preferences layer that composes with it. Do not scatter these values into page-local state when multiple pages need them.

- `activeView`: shell-owned workspace key.
- `selectedAssetId`: shell-visible active symbol.
- `selectedResearchBriefId` and `pendingResearchSource`: Research handoff context.
- `selectedScreenerPresetKey`, `selectedScreenerVariantKey`, `selectedScreenerUniverseSource`, and `lastScreenerRunResult`: screener context.
- `selectedFactorRunId` and `lastFactorRunResult`: factor context.
- `selectedStrategyBacktestId`, `lastStrategyBacktestResult`, `selectedStrategyPaperSessionId`, and `lastStrategyPaperSession`: strategy and paper context.
- Future `selectedBinanceIntentId`: should be added when Strategy Lab or Workflow Studio needs cross-page intent context.
- Future `selectedWorkflowRunId`: should be added with Workflow Studio.
- Future `selectedDataSourceKey`: should be added with Data Sources.
- Future `language` and `density`: should come from persisted settings/preferences and hydrate the frontend store, not from hardcoded page defaults.

Provider health remains backend-owned but shell-visible. The frontend shell should compose `/health`, `/connections/status`, and later capability/data-source summaries into a compact status model.

## Responsive Rules

- Minimum packaged desktop window should prioritize: left navigation, top status, active workspace, then optional right context.
- At narrow widths, the right context area may collapse into a drawer or below-workspace summary.
- Do not rely on viewport-scaled font sizes; use stable type sizes and tighter layout density.
- Chinese and English labels must both fit. For long labels, prefer wrapping or tooltip disclosure over shrinking text until it becomes unreadable.
- Tables and grids should use stable column rules, horizontal overflow where needed, and explicit empty/degraded states.
- Command entry, status badges, navigation labels, and primary action buttons need text-length budgets before T40 localization starts.

## File Ownership For Follow-Up Work

- `src/App.tsx`
  - T39/T41: extract shell subcomponents only if it reduces complexity.
  - Owns shell regions, navigation map, topbar, global setup/recovery banners, active workspace rendering, and command palette placement.

- `src/store/app-store.ts`
  - T39/T40/T43/T47: add future global context keys for density, language hydration, workflow run, data source, and Binance intent selection.
  - Keep context typed and explicit.

- `src/styles.css`
  - T39: introduce design tokens, density rules, shell layout rules, shared panel/table/button/status styles.
  - Avoid one-off page-only styling for reusable terminal primitives.

- `src/components/shared.tsx`
  - T39/T41: promote shared badges, inline states, panel headers, table states, metric strips, and risk/provider states.

- `src/components/command-palette.tsx`
  - T39/T43: keep command entry global; add Workflow/Data Sources actions later without adding live-submit shortcuts.

- `src/views/*.tsx`
  - T41: page-level polish after shell tokens and localization foundation exist.
  - Pages should consume global context and emit handoffs; they should not recreate shell navigation or runtime status.

- `backend/app/models.py` and settings service
  - T40: extend preferences for language/density only when localization work begins.
  - Preserve existing API compatibility.

## T39 Checklist

- Define CSS tokens for background, panels, borders, text hierarchy, charts, status/risk states, focus states, and compact/standard density.
- Refresh shell regions first: sidebar, topbar, command entry, runtime/provider status, workspace scroll, and optional right context.
- Keep visual language multi-hue and work-focused; avoid a single dark-blue/purple gradient theme.
- Capture desktop screenshots for Dashboard, Asset, Research, Strategy Lab, Portfolio, and Connections after styling.

## T40 Checklist

- Add persisted `zh-CN` / `en-US` language preference.
- Move navigation labels, shell copy, buttons, table labels, empty/error states, and common workflow copy into dictionaries.
- Add locale-aware helpers for date, number, percent, currency, and relative time.
- Preserve automation anchors and stable `aria-label` values.

## T41 Checklist

- Polish high-traffic pages after T39/T40 foundation exists.
- Verify both languages at minimum packaged window size.
- Keep behavior stable; page work should be visual/layout/localization polish, not new backend capability.
- Add visual smoke anchors only where packaged signoff needs durable evidence.

## Non-Goals

- No live trading behavior changes.
- No new provider or data-source behavior.
- No backend API shape changes.
- No visual theme implementation in T38.
- No localization dictionary implementation in T38.
- No page-level redesign in T38 beyond this structural specification.

