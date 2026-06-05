# T97 Figma UI System

Status: Completed in desktop Chrome Figma file.

Figma source:

- Starts from the T96 desktop Chrome Figma file:
  `https://www.figma.com/design/54nRRjH5vjNbrrP6pMZmyW/Untitled?node-id=12-178`
- Final T97 UI system board:
  `https://www.figma.com/design/54nRRjH5vjNbrrP6pMZmyW/Untitled?node-id=14-2`

## Purpose

T97 turns the T96 roadmap into a concrete UI system board for the Pengbo
Workbench redesign foundation. It is a design-system planning artifact only:
it must not change runtime behavior, provider contracts, security boundaries,
packaging, hosted account promises, public API exposure, remote sync, or
live-trading scope.

The board is meant to guide:

- T98 Design Tokens v1.
- T99 Navigation IA Collapse.
- T100 AppShell Redesign.
- T102 Component Library Base.
- T103 DataTable Component.
- T104 Inspector Panel.
- T105 Chinese Empty States.
- T106 Screenshot Baseline.

## Product Brief

Pengbo remains a local-first desktop financial research workbench. The UI
system should feel like a professional macOS desktop tool: dense, calm,
legible, Chinese-first, keyboard-friendly, and evidence-oriented. It should not
look like a marketing landing page, a web dashboard template, or a single-hue
theme demo.

## Grounding Sources

- `IMPLEMENTATION_TASKS.md`, T97 Recommended Next Task.
- `docs/t96-figma-master-roadmap.md`, especially the T96-T115 first-batch chain.
- `docs/desktop-ui-information-architecture.md`, Target Shell and Workspace Map.
- `src/App.tsx`, current shell, navigation, topbar, sensitive-view gating, and
  workspace rendering.
- `src/store/app-store.ts`, global state keys for active view, selected asset,
  research handoff, factor/strategy/screener context, language, and density.
- `src/components/shared.tsx`, current reusable status, panel, metric, chart, and
  data status primitives.
- `src/styles.css`, current shell, density, panel, table, and button class
  surface.

## Required Figma Frames

The T97 board should contain eight readable frames. Each frame is 1440x900 so
it can be reviewed at ordinary Figma zoom levels without becoming a wall of
tiny text.

1. `00 T97 UI System Cover`
   - Scope and explicit local-first boundary.
   - Links T97 to T98-T106.
2. `01 Product Shell`
   - macOS-style workbench shell: sidebar, topbar, command/search, workspace,
     and right inspector.
   - Shows where local runtime/provider status lives.
3. `02 Navigation IA`
   - Collapsed future navigation model:
     Home, Research, Markets, Portfolio, Factor Lab, Automation, Settings.
   - Maps current views to future groups without introducing new behavior.
4. `03 Screen Templates`
   - Dashboard, Asset Cockpit, Research Canvas, Data Sources, and Settings
     templates.
   - Shows stable zones and ownership.
5. `04 Component System`
   - Primary controls, icon buttons, search field, segmented control, tabs,
     badges, evidence chips, provider status, cards, sheets, and popovers.
6. `05 Data Table And Inspector`
   - Dense financial table rules: fixed columns, row density, sort/filter
     affordances, status cells, source/freshness indicators.
   - Right inspector areas for evidence, AI context, provider status, exports,
     and parameters.
7. `06 State System`
   - Loading, empty, offline, cached, limited, blocked, permission blocked,
     error, credential required, and audited states.
   - States must use clear Chinese-first copy and explicit next actions.
8. `07 React Mapping`
   - Figma primitive to React target mapping for T98-T106.
   - References current files and future extraction targets.

## Visual Rules

- Use light mode as the primary visual target.
- Keep cards and panels to 8px radius or less unless a specific control needs a
  smaller radius.
- Use multi-hue status language: teal/blue for information, green for ready,
  amber for degraded, red for blocked/risk, slate for neutral surfaces.
- Use stable dimensions for shell, nav, table rows, toolbars, and inspector
  panels.
- Avoid viewport-scaled type and avoid negative letter spacing.
- Keep Chinese and English labels within text-length budgets.
- Avoid decorative gradient blobs, oversized hero sections, and nested cards.

## Component Contract

| Figma primitive | React target | Notes |
| --- | --- | --- |
| App shell regions | `src/App.tsx` extraction in T100 | Sidebar, topbar, workspace scroll, right inspector. |
| Navigation item | `navigation` map in `src/App.tsx`, T99 | Future groups collapse current views without removing routes. |
| Status badge | `StatusBadge` in `src/components/shared.tsx` | Preserve online/offline/connecting semantics. |
| Inline state | `InlineState`, `PanelState` | Use for page-local empty/error/blocked states. |
| Data status strip | `DataStatusStrip` | Use observed/cached/degraded/credential_required/blocked/audited tones. |
| Metric card | `MetricCard` | Preserve tone up/down/neutral. |
| Data table | T103 extraction target | Fixed columns, stable row height, horizontal overflow. |
| Inspector panel | T104 extraction target | Evidence, AI context, provider health, exports, parameters. |
| Search / command | `CommandPalette`, topbar search | Keyboard-first global action surface. |
| Density tokens | `src/styles.css` density variables | Standard and compact modes remain explicit. |

## Safety Boundary

T97 must not include:

- Secrets, credentials, API keys, tokens, or private local paths.
- Runtime SQLite/DuckDB databases.
- Generated logs, diagnostics bundles, Stronghold vaults, installers, or packaged
  binaries.
- Hosted account promises, public API commitments, remote sync, or new
  live-trading flows.

## Completion Evidence

- Final Figma node:
  `https://www.figma.com/design/54nRRjH5vjNbrrP6pMZmyW/Untitled?node-id=14-2`.
- Evidence screenshot: `logs/t97-ui-system-readable-frame-confirm.png`.
- The selected T97 board is a `Frame` with dimensions `12380 x 1040`.
- The board visibly includes eight readable 1440x900 sections:
  - `00 T97 UI System`
  - `01 Product Shell`
  - `02 Navigation IA`
  - `03 Screen Templates`
  - `04 Component System`
  - `05 Table And Inspector`
  - `06 State System`
  - `07 React Mapping`
- Supporting source-safe assets:
  - `docs/t97-figma-ui-system.md`
  - `docs/t97-ui-system-board.svg`
  - `scripts/figma_t97_ui_system.js`
