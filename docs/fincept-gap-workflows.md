# Post-T37 Product Roadmap

Updated: 2026-04-29

This document records the refined post-T37 priorities for Pengbo Workbench. The focus is no longer a broad Fincept catch-up task. The next work is split into smaller, independently shippable tasks:

1. Desktop UI redesign and polish.
2. Chinese/English language switching.
3. Automated workflow execution.
4. Broader read-only data-source coverage.

Hard constraint: live trading remains Binance-only. Equity, ETF, macro, derivatives, news, economics, China/Asia data, and non-Binance crypto workflows may support research, analysis, backtesting, paper trading, reports, and alerts, but must not submit live orders.

## UI And Localization

The current desktop UI is functional but not polished enough for a professional finance terminal. The UI work is intentionally split so architecture, visual system, localization, and page polish can be reviewed separately.

### T38 - Desktop UI Information Architecture

- Redesign the shell structure: navigation, top status, main workspace, right context panel, command entry, and global context state.
- Map all current and future pages into the new structure.
- Define global context for active symbol, research brief, factor run, backtest, paper session, Binance intent, provider state, and language.
- No styling or behavior rewrite in this task.

### T39 - Desktop Visual Design System Refresh

- Define visual tokens for colors, spacing, typography, table density, charts, status badges, risk states, and action buttons.
- Rebuild shared shell components before page-specific polish.
- Add compact and standard density modes.
- Verify screenshots across important pages.

### T40 - Chinese/English Localization Foundation

- Add a real frontend i18n layer with `zh-CN` and `en-US`.
- Persist language preference in Settings.
- Move navigation, buttons, empty states, status copy, errors, table labels, and workflow copy into translation dictionaries.
- Add locale-aware date, number, percent, currency, and relative-time formatting.
- Gradually move backend user-visible messages toward stable codes/message keys while preserving API compatibility.

### T41 - Core Page UI Polish Pass

- Apply the new design system and localization foundation to Dashboard, Asset, Research, Strategy Lab, Portfolio, Connections, and Settings.
- Keep behavior stable while improving layout, density, copy, and state presentation.
- Verify both Chinese and English text fit without overlap.

## Workflow Automation

The workflow goal is automatic execution of safe research and analysis chains, not silent autonomous live trading. Workflows may create Binance preset live-order intents and show a confirmation modal; live order submission happens only after the user explicitly clicks approve and the existing Binance risk gates pass.

### T42 - Workflow Engine Backend

- Add a local workflow service that calls existing services.
- Persist workflow runs in SQLite with template key, step status, inputs, outputs, artifact IDs, timestamps, errors, and blocked reasons.
- Seed templates:
  - screener result to research brief
  - research brief to factor run
  - factor run to strategy backtest
  - backtest to paper session
  - paper session to Binance execution intent
  - evidence report export
- Add action policy categories: `read_only`, `local_analysis`, `local_simulation`, `binance_intent`, and `user_confirmed_binance_submit`.
- Ensure workflow automation cannot change live mode, clear kill switches, or silently acknowledge risk; it can only present a prepared Binance preset live order for explicit user approval.

### T43 - Workflow Studio UI

- Add a dedicated Workflow Studio surface.
- Show templates, required inputs, dependencies, step preview, progress, logs, blocked reasons, artifact links, and prepared Binance preset live-order confirmations.
- Support rerun of failed steps and export of workflow evidence.
- Allow Workflow Studio to surface the protected confirmation modal, with submit performed only after explicit user approval and successful Binance risk checks.

### T44 - Workflow Packaged Signoff

- Add packaged smoke automation for workflow creation, step execution, restart restore, Binance preset live-order confirmation boundary, and evidence export.
- Prove workflow automation can create Binance preset live-order intents and show confirmation-required state, but does not submit until explicit simulated user approval is provided.

## Data Source Expansion

The data-source goal is to improve information coverage and provenance. New providers are read-only unless they are already part of the protected Binance execution family.

### T45 - Data Source Expansion Foundation

- Extend the provider capability catalog with asset coverage, credential requirements, rate-limit notes, cache behavior, locale/region, freshness, provenance, and supported data domains.
- Define interfaces for market data, macro data, China/Asia data, crypto public data, news/events, fundamentals, and research signals.
- Ensure no new provider introduces a live trading API.

### T46 - Initial Data Source Connector Pack

- Add a first connector pack:
  - FRED for macro series.
  - DBnomics/OECD/World Bank or IMF for broader economics.
  - AkShare for China/Asia market and macro coverage where stable.
  - CoinGecko for crypto public market context.
  - RSS/event-source ingestion for market news and company/event monitoring.
- Prefer free/public sources first; API-key sources can be optional.
- Provider failures must degrade into cache/unavailable states instead of breaking pages.

### T47 - Data Sources UI And Signoff

- Add or expand a Data Sources surface for coverage, credentials, freshness, source domains, and recent fetch status.
- Expose macro, China/Asia, crypto public, news/event, and fundamentals sources in a user-understandable way.
- Add packaged smoke coverage for provider capability rendering and at least one new source-backed research or data view.

## Non-Goals

- No migration from Tauri/React to Qt/C++ for this phase.
- No live equity, ETF, options, futures, forex, or non-Binance broker trading.
- No autonomous AI live trading.
- No cloud sync, team collaboration, or multi-user permission system.
- No claim that factor, strategy, AI, or workflow outputs are financial advice.
