# Pengbo Workbench Task Board

Updated: 2026-07-07

## Current Assessment

- The packaged desktop runtime and sidecar now rebuild successfully with refreshed release artifacts.
- `T13 - Packaging Noise Reduction` is now implemented and package-validated, with the latest packaged sidecar at `117,868,930 bytes` and the latest sidecar build duration at `60.03s`.
- `T15 - Provider Live Signoff` remains functionally complete at the packaged runtime/provider layer for both EDGAR and Binance.
- `T16 - Desktop Runtime Status Reconciliation` is now implemented and package-validated, including the 2026-04-18 packaged startup hotfix: desktop startup no longer self-thrashes while health is still settling, PyInstaller onefile sidecar bootstrap exit is reconciled against live `/health`, the Tauri fallback path no longer drops to relative `/api/v1`, and packaged WebView requests now accept the Tauri 2 `http://tauri.localhost` origin.
- `T12 - Offline-First Portfolio Hardening` is now implemented and package-smoke validated across online, offline-with-cache, and offline-cold-cache scenarios.
- `T17 - Packaged Startup Regression Automation` is now implemented and smoke-validated, with a repeatable packaged startup script, log-backed single-instance coverage, and adopt-existing verification recorded in `logs/packaged-startup-smoke-latest.json`.
- `T95 - Next Stage Master Task Pool Selection` is now completed with a staged backlog for UI redesign, first useful research loop, multi-model AI, data depth, professional workflows, Quant Factor Lab, release hardening, safety, and commercialization.
- `T96 - Figma Master Roadmap` is now completed. The desktop Chrome Figma file at `https://www.figma.com/design/54nRRjH5vjNbrrP6pMZmyW/Untitled?node-id=12-178` contains a source-safe five-screen readable roadmap frame covering cover, overview, execution order, first-batch detail, and design principles for T96-T195; supporting specs and generation assets are in `docs/t96-figma-master-roadmap.md`, `docs/t96-master-roadmap-full.svg`, `docs/t96-master-roadmap.svg`, and `scripts/figma_t96_master_roadmap.js`.
- `T97 - Figma UI System` is now completed. The desktop Chrome Figma file at `https://www.figma.com/design/54nRRjH5vjNbrrP6pMZmyW/Untitled?node-id=14-2` contains a source-safe eight-section UI system board defining shell, navigation, workspace templates, component primitives, data table and inspector rules, operational states, and React mapping for T98-T106; supporting specs and generation assets are in `docs/t97-figma-ui-system.md`, `docs/t97-ui-system-board.svg`, and `scripts/figma_t97_ui_system.js`.
- `T98 - Design Tokens v1` is now implemented and validated. `src/styles.css` has a light-first semantic token system with a complete dark mapping, local/offline typography, 4px spacing rhythm, standard/compact density contracts, reduced-motion support, and foreground/background/border triplets for 12 operational and financial states. The contract is documented in `docs/design-tokens-v1.md`, checked by `npm run check:design-tokens`, and visually covered in `logs/design-tokens-screenshots/design-tokens-smoke-latest.json`.
- `T99 - Navigation IA Collapse` is now implemented and validated. The sidebar exposes seven task-oriented groups backed by `src/navigation.ts`, all 14 existing `ViewKey` workspaces remain reachable through stable automation anchors, multi-workspace groups use an accessible single-open disclosure pattern, and sensitive workspace gates plus command destinations remain unchanged. The contract is documented in `docs/navigation-ia-t99.md` and verified by `npm run check:navigation-ia` plus `npm run smoke:navigation-ia`.
- `T100 - AppShell Redesign` is now implemented and validated. The desktop frame has explicit `AppSidebar`, `AppToolbar`, central Workspace, and collapsible `ContextRail` regions; the Sidebar consumes the T99 contract, the Context Rail hides sensitive context while locked, and responsive evidence covers 1600x1000 standard plus 1280x820 compact layouts. The contract is documented in `docs/app-shell-t100.md` and verified by `npm run check:app-shell` plus `npm run smoke:app-shell`.
- `T101 - Light Mode First` is now implemented and validated. New and legacy preferences resolve safely to light mode, Settings provides immediate light/dark preview and persistence, and the T100 AppShell restores a saved dark preference after backend restart without changing workspace state. The contract is documented in `docs/light-mode-first-t101.md` and verified by `npm run check:theme-preference` plus `npm run smoke:theme-preference`.
- `T19 - Portfolio Offline Regression Automation` is now implemented and smoke-validated, with a repeatable packaged portfolio script recording `live`, `cached`, and `unavailable` semantics in `logs/portfolio-offline-smoke-latest.json`.
- `T21 - Installed Bundle Startup Automation` is now implemented and smoke-validated for the MSI-installed desktop lifecycle, with a repeatable installed-app startup result recorded in `logs/installed-bundle-startup-smoke-latest.json`.
- `T23 - NSIS Installed Startup Automation` is now implemented and smoke-validated for the NSIS-installed desktop lifecycle, with a repeatable installed-app startup result recorded in `logs/installed-bundle-startup-smoke-nsis-latest.json`.
- `T22 - Portfolio Packaged UI State Signoff` is now implemented and smoke-validated, with a repeatable packaged-shell UI signoff result recorded in `logs/portfolio-ui-signoff-latest.json`.
- `T18 - Localization Hardening` is now implemented and web-build validated, with source-level mojibake cleanup and Chinese-first desktop copy restored across the shared shell, portfolio workflows, connections, settings, dashboard, asset, and runtime/API fallback messaging.
- `T20 - Residual Packaging Warning Trim` is now implemented and build-validated, with residual SciPy warning lines moved out of `warning_categories.actionable` into an auditable `accepted_packaging_noise` bucket plus reasoned notes in `logs/sidecar-build-latest.json`.
- `T14 - Screener Quality Expansion` is now implemented and validated, with a controlled expanded screener universe, score-ranked results, explanations, missing-metric reporting, and dedicated backend/API coverage in `backend/tests/test_screener_service.py`.
- `T24 - Screener Configurable Profiles` is now implemented and build-validated, with preset-scoped screener variants, SQLite-backed tuning persistence, activation-aware `/api/v1/screeners/*` compatibility, and a three-column desktop workflow for variant management plus controlled tuning.
- `T25 - Screener Variant Packaged Signoff` is now implemented and smoke-validated, with a repeatable packaged lifecycle result recorded in `logs/screener-variant-signoff-latest.json` plus stable ASCII screener automation anchors for preset, variant, summary, and run-attribution evidence.
- `T26 - Research Workspace` is now implemented and smoke-validated, with a dedicated `research` desktop workspace, persisted brief snapshots and notes, local Markdown export, screener-to-research handoff, portfolio handoff, and a repeatable packaged result recorded in `logs/research-workspace-smoke-latest.json`.
- `T27 - Analysis Module Registry` is now implemented and package-smoke validated, with a reusable backend analysis registry, four structured research modules, shared frontend analysis cards, and packaged evidence recorded in `logs/research-workspace-smoke-latest.json`.
- `T28 - Provider Capability Catalog` is now implemented and build-validated, with a shared backend capability layer, additive `/api/v1/connections/catalog` coverage, unified asset/research applicability semantics, and a provider capability matrix in the desktop connections surface.
- `T29 - Command Palette And Report Export` is now implemented and build-validated, with a global keyboard-first command palette, shared screener context in the app store, cross-workspace asset/research/portfolio/provider/export actions, and command feedback surfaced in the shared shell.
- `T30 - Provider Capability Packaged Signoff` is now implemented and smoke-validated, with a repeatable packaged capability signoff result recorded in `logs/provider-capability-signoff-latest.json`, stable ASCII automation anchors across Connections plus additive asset/research anchors, and packaged runtime verification of `credential_required -> available -> credential_required` capability transitions.
- `T31 - Credential Workflow And Crypto Capability Smoke Hardening` is now implemented and smoke-validated, including desktop-UI EDGAR save/clear through the real Stronghold-backed form plus the `BTC/USDT` unsupported crypto sample.
- `T32 - Desktop WebView Credential Input Automation Adapter` is now implemented and smoke-validated, with deterministic EDGAR identity input automation, Stronghold persistence readback, post-restart `available` evidence, and clear-back-to-`credential_required` coverage in `logs/provider-capability-signoff-latest.json`.
- `T33 - Portfolio Analytics And Professional Charting` is now implemented and package-smoke validated, with additive `/api/v1/portfolio/summary.analytics`, average-cost PnL, time-window analytics, allocation breakdowns, and packaged evidence recorded in `logs/portfolio-offline-smoke-latest.json` plus `logs/portfolio-ui-signoff-latest.json`.
- `T34 - Local Factor Research Lab` is now implemented and package-smoke validated, with additive `/api/v1/factors/*`, persisted DuckDB factor snapshots, a dedicated Factor Lab workspace, research handoff, and packaged evidence recorded in `logs/factor-lab-smoke-latest.json`.
- `T35 - Strategy Backtesting And Paper Trading` is now implemented and package-smoke validated, with additive `/api/v1/strategies/*`, persisted strategy backtest snapshots, local paper-trading ledgers, a dedicated Strategy Lab workspace, report export, and packaged evidence recorded in `logs/strategy-lab-smoke-latest.json`.
- `T36 - Automated Binance Execution And Risk Controls` is now implemented and package-smoke validated, with additive `/api/v1/execution/binance/*`, default-off live mode, Binance-only execution intents, risk gates, kill switch state, audit trail, mock-covered submit flow, and packaged evidence recorded in `logs/binance-execution-smoke-latest.json`.
- `T37 - Factor-Aware Research, Screening, And Execution Reports` is now implemented and package-smoke validated, with additive evidence snapshots across factor, screener, backtest, paper session, Binance intent/risk/audit, and packaged evidence recorded in `logs/evidence-report-smoke-latest.json`.
- `T38 - Desktop UI Information Architecture` is now completed as a structural specification, with the target shell, workspace map, global context rules, responsive rules, and T39/T40/T41 implementation checklist recorded in `docs/desktop-ui-information-architecture.md`.
- `T39 - Desktop Visual Design System Refresh` is now implemented and validated, with additive design-system tokens, standard/compact density rules, a restrained multi-hue terminal visual layer, and repeatable screenshots recorded in `logs/visual-design-screenshots/visual-design-smoke-latest.json`.
- `T40 - Chinese/English Localization Foundation` is now implemented and validated, with additive persisted `language` and `density` preferences, a typed frontend dictionary, localized shell/Settings/Command Palette copy, readable runtime API error copy, and focused evidence recorded in `logs/localization-smoke-latest.json`.
- `T41 - Core Page UI Polish Pass` is now implemented and validated, with a denser terminal-style surface across Dashboard, Asset, Research, Strategy Lab, Portfolio, Connections, and Settings, expanded high-traffic i18n copy, shared panel/chart/status primitives, restrained page-level layout styling, and bilingual screenshot evidence recorded in `logs/page-polish-screenshots/page-polish-smoke-latest.json`.
- `T42 - Workflow Engine Backend` is now implemented and validated, with additive `/api/v1/workflows/*` endpoints, SQLite-backed workflow run history, six safe template-driven workflows, explicit step/audit/provenance records, and Binance intent flows stopped at `manual_required` before any submit.
- `T43 - Workflow Studio UI` is now implemented and validated, with a dedicated Workflow Studio workspace, template catalog/input/timeline/artifact/manual-boundary UI, workflow-aware command entry, artifact navigation into existing workspaces, focused smoke evidence in `logs/workflow-studio-smoke/workflow-studio-smoke-latest.json`, and expanded bilingual page screenshots in `logs/page-polish-screenshots/page-polish-smoke-latest.json`.
- `T44 - Workflow Packaged Signoff` is now implemented and validated against the real release desktop EXE, with refreshed `pengbo-workbench.exe`, `pengbo-sidecar.exe`, MSI, and NSIS artifacts plus packaged Workflow Studio UIAutomation evidence in `logs/workflow-studio-packaged-smoke-latest.json`.
- `T45 - Data Source Expansion Foundation` is now implemented and build-validated, with an additive provider source metadata registry, catalog-level freshness/provenance/testability/read-only fields, unified read-only provider test health, and lightweight Connections source-contract rendering.
- `T46 - Initial Data Source Connector Pack` is now implemented and build-validated, with read-only World Bank, DBnomics, RSS Events, FRED, and CoinGecko data-source paths, cache-aware fallback semantics, optional-key handling for FRED/CoinGecko, and focused connector regression coverage in `backend/tests/test_data_source_service.py`.
- `T47 - Data Sources UI And Signoff` is now implemented and package-smoke validated, with first-class Data Sources workspace status/provenance/report export UI, additive `/api/v1/data-sources/reports/export`, bilingual page-polish evidence, and packaged EXE signoff recorded in `logs/data-sources-packaged-smoke-latest.json`.
- `T48 - Data Source Credential And Research Workflow Repair` is now implemented and package-smoke validated, closing the visible follow-up list: Research refreshes EDGAR-gated briefs after credential save, FRED/CoinGecko have desktop Stronghold-backed credential panels and sidecar env injection, and Workflow Studio now includes a read-only `data_sources_to_research` template that creates a Research brief artifact.
- `T49 - Terminal Experience Repair And Product Manual` is now implemented and validated, closing the user-reported chart-period, screener-variant, research-layout, manual, Factor Lab asset-type/factor, and translation-tooling gaps with fresh web, backend, and packaged evidence.
- `T50 - Security Architecture And Global Audit Foundation` is now implemented as the first security-hardening pass: `docs/SECURITY_ARCHITECTURE.md` defines the local-first threat boundary, data classification, secret handling rules, execution gates, and public-exposure prerequisites; the backend now stores redacted `security_audit_events` and exposes `/api/v1/security/audit` for cross-module credential/execution security events.
- `T51 - Startup Time Reduction` is now implemented and package-smoke validated. The packaged launch path no longer blocks Tauri setup on sidecar health, the Tauri-mode sidecar keeps health/settings startup light before full service initialization, cold-start adopt-existing probes use a short timeout, bundled sidecar shutdown avoids visible console windows, and the latest packaged startup smoke records `health_ready_seconds=2.88s`, `failures=[]`, `single_instance_ok=true`, `adopt_existing_ok=true`, and `shutdown_sidecar_exited_ok=true` in `logs/packaged-startup-smoke-latest.json`.
- `T52 - Git Upload Readiness And Repository Normalization` is now implemented, security-remediated after independent Claude Code review, and selected for first public GitHub upload. The public-upload boundary is documented in `README.md` and `docs/REPOSITORY_UPLOAD_READINESS.md`, root and Tauri ignore rules exclude generated/runtime/secret artifacts, CORS methods are explicit, generated sidecar build logs are documented as local ignored resources, and no API/runtime contract was changed.
- `T53 - Local Unlock PIN And Idle Lock` is now implemented and package-smoke validated. Sensitive desktop surfaces now require a local unlock factor, failed unlock attempts are tracked with lockout support, idle relock is audited, Tauri credential commands verify unlock state, and packaged evidence is recorded in `logs/local-security-packaged-smoke-latest.json`.
- `T54 - Account-Scoped Provider Credential Model` is now implemented and package-smoke validated. Provider credential readiness metadata is scoped to explicit local profiles, the existing `/api/v1/...` compatibility routes still work, Stronghold secret material remains outside SQLite, and packaged evidence is recorded in `logs/account-scoped-credentials-smoke-latest.json`.
- `T55 - Future Public Auth And Session Layer` is now implemented as a local-only session boundary: the backend persists redacted session metadata, the desktop API client attaches `X-Pengbo-Session`, sensitive credential/execution/export/audit routes require session-bound permissions, and `/api/v1/security/route-classification` gives T56 a route-level exposure map.
- `T56 - Public Exposure Gateway And Sidecar Hardening` is now implemented and package-smoke validated. The sidecar refuses non-loopback bind addresses, CORS origins are centralized, unsafe origins and invalid methods are rejected before route handling, sensitive gateway failures are audited with redaction, rate-limit hooks are present, and the public-exposure posture is documented in `docs/public-exposure-gateway-t56.md`.
- `T92 - Credential Audit Trail Hardening` is now implemented. Security audit redaction now covers sensitive keys, bearer headers, query params, URL-encoded key/value strings, local notes, exported Research/Data Sources/Strategy reports, and portfolio transaction notes without storing raw markers in SQLite.
- `T93 - Sensitive Workspace Lock Rules` is now implemented. Local unlock now gates Research, Factor Lab, Workflow Studio, Strategy/Data Sources report exports, Portfolio records, runtime settings, AI-control writes, assistant contexts, and the matching frontend workspaces.
- `T94 - Security Packaged Signoff` is now package-smoke validated. `npm run smoke:security:packaged` records local unlock/session/gateway/export/audit/route-classification/redaction evidence in `logs/security-signoff-packaged-smoke-latest.json` with `failures=[]`.
- `T57 - License And Open Source Boundary` is now implemented as the first product-trust task after T56. The repository now has an Apache-2.0 source license, README and security/upload docs describe the public source boundary, package and Tauri metadata agree on `Apache-2.0`, generated runtime/log/secret/build artifacts remain outside the public source set, and no API/runtime/trading behavior changed.
- `T58 - Version Governance Cleanup` is now implemented. Version metadata is aligned across package, package-lock, Tauri, Cargo, backend sidecar constants, `/health`, `/settings/runtime`, Settings UI, README, CHANGELOG, and the cleaned public `PLAN.md`; `npm run check:version` now enforces the source/runtime version story, and the prior transitive `postcss` audit advisory is resolved.
- `T59 - GitHub Actions CI Baseline` is now implemented as a no-secret source-level CI workflow. The workflow covers version consistency, public-boundary scanning, npm audit, frontend typecheck/build, and backend unit tests without provider credentials, packaged EXE smoke, Tauri release builds, signing, or live-trading permissions.
- `T60 - Demo Mode And No-Key Startup` is now implemented. Fresh no-key runtimes expose `/api/v1/settings/demo-mode`, dashboard/sample evaluation guidance, portfolio and data-source sample states, visible missing-credential boundaries, Vite dev-origin allowance, and repeatable no-key smoke evidence in `logs/demo-no-key-smoke-latest.json`.
- `T61 - First Release Packaging` is now implemented as a local unsigned Windows packaging baseline. The refreshed EXE, MSI, and NSIS artifacts are produced locally, `docs/RELEASE_CHECKLIST.md` records the validation sequence, and MSI/NSIS installed startup smokes now verify the onedir sidecar path without the root `pengbo-sidecar.exe` DLL-loading trap.
- `T61# Temp - Manual Security Reset Refresh` is completed as a temporary T61 follow-up: the in-app Manual and Settings security copy now explain local PIN/passphrase reset behavior before T62 product-proof work.
- `T62 - README Product Proof Upgrade` is now implemented. The README includes a practical reviewer journey and source-safe product screenshots generated from a temporary no-secret runtime, while generated logs, runtime databases, credentials, installers, and packaged binaries remain outside the public source boundary.
- `T63 - Contributor Entry Kit` is now implemented. New contributors have a dedicated setup and validation guide, safe first-issue candidates, and issue templates that keep credentials, Stronghold vaults, runtime data, generated logs, binaries, installers, hosted support, signed releases, and live trading outside the default public contribution path.
- `T64 - Research Flow Definition` is now implemented. The product has a grounded primary research journey from Asset/Data Sources into Research briefs, evidence comparison, local report export, and redacted audit handoffs, with follow-up gaps mapped into T65-T68.
- `T65 - Asset Page Research Entry Polish` is now implemented. The Asset page has an additive research-entry panel with local data status, portfolio exposure, related brief state, and direct Research, evidence, report, and Data Sources actions while preserving backend contracts and sensitive boundaries.
- `T66 - Data Status Strip Everywhere` is now implemented. Asset, Research, and Data Sources share a compact frontend data-status strip for provider freshness, credential state, cache/degraded state, read-only or execution boundary, and cautious observed/cached/degraded/credential_required/blocked/audited wording.
- `T67 - Research Brief Quality Upgrade` is now implemented. Research briefs now include an additive structured decision review with equity, crypto, portfolio, and macro templates, thesis, assumptions, supporting evidence, counter-evidence, risks, watch items, provenance, and a cautious conclusion boundary while preserving existing brief routes and handoffs.
- `T68 - Report Export Evidence Pack` is now implemented. Research, Data Sources, and Strategy exports expose evidence-pack summaries, provider/freshness/evidence-quality boundaries, audit references where available, and explicit private-state exclusion notes; refreshed desktop EXE/MSI/NSIS artifacts are validated and uploaded to the first GitHub Release at `https://github.com/LaurenceFang/pengbo-workbench/releases/tag/v0.1.0`.
- `T69 - Command Center V1` is now implemented. The desktop shell has a compact Command Center workspace for asset search, Research brief entry, provider refresh, local report export, audit review, and no-secret safe readiness checks while preserving existing workspace flows and local permission gates.
- `T69# Temp - Packaged Desktop Video Walkthrough` is now completed. A Hyperframes MP4 was generated from real `pengbo-workbench.exe` walkthrough frames covering local unlock with `000000`, AAPL asset selection, 12-1 Momentum factor selection, Top-N Factor Rotation strategy selection, and a simulated backtest result.
- `T70 - First-Run Product Onboarding` is now implemented. First-time reviewers get a local-only, skippable checklist for demo mode, provider setup, local unlock, privacy/diagnostics boundaries, and confirmation-gated execution, with a Settings reset action for repeated walkthroughs.
- `T71 - Provider Capability Matrix` is now implemented. `/api/v1/connections/catalog` remains compatible while exposing endpoint coverage, asset coverage, regions, credential needs, freshness, read/write status, execution boundaries, decision notes, and explicit unsupported reasons from the shared provider registry.
- `T72 - Provider Credential State Model` is now implemented. Connections and provider tests expose normalized credential states, labels, redacted reasons, and next actions for missing, configured, invalid, disabled, read-only, trading-gated, and blocked provider paths while keeping existing health fields compatible.
- `T73 - Provider Freshness And Cache Policy` is now implemented. Provider catalog, Data Sources runtime status, provenance payloads, and evidence-pack exports expose additive TTL, stale-after, refresh behavior, offline fallback, cache-age, and freshness-state fields for fresh, cached, stale, refresh-failed, offline, credential-required, unavailable, unsupported, and unknown evidence.
- `T74 - Data Quality Status Contract` is now implemented. Data Sources, Research, Portfolio, Screeners, Factor Lab, provenance payloads, and evidence-pack exports expose additive data-quality status for completeness, timeliness, source confidence, limitations, notes, and machine tags while preserving existing stale, missing, health, and evidence-note fields.
- `T75 - Provenance UI And Export Sync` is now implemented. Research evidence and decision review surfaces expose audit IDs and portfolio provenance, Portfolio summary and holdings expose additive provenance tiles/references, and Research evidence-pack Markdown exports now carry the same portfolio provenance plus audit IDs.
- `T76 - Existing Providers Audit` is now implemented. Provider catalog/runtime drift was corrected for Public Market Data, Google News RSS Events, and CoinGecko demo/pro credential support; CoinGecko history is now honestly unsupported until a dedicated endpoint exists; tests lock provider registry coverage, read-only/no-live-trading boundaries, freshness/provenance, and keyed credential behavior.
- `T78 - Local LLM Runtime Probe` is now implemented and validated, with default-off AI runtime settings, additive `/api/v1/ai/runtime/status` and `/api/v1/ai/runtime/probe` endpoints, short-timeout Ollama probing, and source-safe evidence recorded in `logs/ai-local-runtime-probe-latest.json`.
- `T79 - AI Permission Boundary` is now implemented and validated, with an additive AI permission map, route classifications, local-unlock-gated Research context previews, redacted note handling, and `ai_assistant` audit events before any assistant UI ships.
- `T80 - Research Assistant Backend` is now implemented and validated, with an additive local-only Research assistant generation endpoint that returns grounded summaries, questions, risks, limitations, citations, blocked states, and redacted audit evidence from structured Research evidence.
- `T81 - Research Assistant UI` is now implemented and build-validated, with the assistant embedded inside the Research workflow, explicit context preview/generation actions, visible citations/limitations/blocked states, and save-to-notes handoff without adding a separate chatbot workspace.
- `T82 - Evidence-Grounded Prompt Layer` is now implemented and validated, with selectable assistant prompt templates, shared strict language rules, hallucination-prone regression coverage, and offline Research fixtures that keep generation inside local evidence boundaries.
- `T83 - Cloud LLM Explicit Opt-In` is now implemented and validated, with cloud mode default-off, local-env-only cloud configuration, explicit per-request confirmation, stale context-preview blocking, Settings/Manual visibility, and no cloud test calls or committed API keys.
- `T84 - AI Research Packaged Signoff` is now implemented and validated, with `npm run smoke:ai-research:packaged` proving local-disabled, local-enabled, cloud-disabled, cloud-opt-in-without-key, stale evidence, blocked evidence, redaction, audit, and export flows in the release EXE.
- Post-T84 UX follow-up: Dashboard now owns AI Control as the visible enablement surface, with explicit local/cloud mode selection, local Ollama endpoint visibility, cloud interface presets for ChatGPT/OpenAI, Gemini, Grok, Claude, DeepSeek, Qwen/DashScope, and custom endpoints, plus permission-gated `/api/v1/settings/ai-control` persistence that never stores API keys.
- `T57` through `T94` are added as the post-security product-trust roadmap and must not supersede the `T53 -> T54 -> T55 -> T56` security sequence.
- Refined the post-T37 roadmap around the user's actual priorities: desktop UI redesign first, Chinese/English language switching, automated workflow execution, and broader data-source coverage.
- Re-reviewed the locally downloaded `E:\Fincept Terminal` repo on 2026-05-11 as a direct product benchmark. After excluding bundled runtimes, Qt libraries, installer payloads, and downloaded artifacts, Fincept still has roughly `4,584` effective project files and about `4,456` source/documentation files; Pengbo currently has roughly `161` project files and about `94` source/script/documentation files after excluding generated/runtime folders. The key gap is not build size, but visible terminal product breadth: more first-class workspaces, workflow/node automation, data-source center, and screen-level product depth.
- The T38-T47 roadmap sequence is now closed through packaged Data Sources signoff. All live trading remains restricted to Binance, while non-Binance assets stay research, analysis, backtest, paper-trading, report, or alert only.

## Latest Planning Update

- Replanned the post-T52 sequence on 2026-05-18 after reviewing the external product assessments and local task board state.
- Completed `T53 - Local Unlock PIN And Idle Lock` on 2026-05-18 and promoted `T54 - Account-Scoped Provider Credential Model` as the current recommended next task, followed by `T55` and `T56` in strict order before any public, account, remote, or team-facing mode.
- Completed `T54 - Account-Scoped Provider Credential Model` on 2026-05-18 and promoted `T55 - Future Public Auth And Session Layer` as the current recommended next task, followed by `T56` before any public, remote, or team-facing mode.
- Added the future product-trust roadmap from `T57` through `T94`; these tasks cover open-source boundary, CI, release, demo mode, research-flow polish, data-source governance, local AI research assistance, China-market connectors, and security packaged signoff.
- The new `T57+` roadmap is intentionally queued after the security-accountability sequence and should not be implemented before T53-T56 unless the task board is explicitly re-prioritized.

- Executed `T55 - Future Public Auth And Session Layer` on 2026-05-19 against the current checkout.
- Added local-only auth session metadata, session expiry/revocation, session-bound permissions, redacted session audit events, frontend `X-Pengbo-Session` attachment, and sensitive route gates for security audit, provider profile clearing, Binance account reads, Binance execution changes/intents/submit/kill-switch, and local report exports.
- Added `/api/v1/security/route-classification` so T56 has a concrete route/surface/exposure/permission map before sidecar gateway hardening.
- Validation passed: `py -m pytest backend\tests`, `npm run typecheck`, and `npm run build`.
- Merged the completed `codex/t53-local-unlock-idle-lock` branch into `main` before closing T55, so the current `main` line now contains T53 local unlock, T54 account-scoped credentials, and T55 local session permissions together.
- Added a T53/T55 local-unlock UX repair on 2026-05-19 after packaged smoke initialized the real desktop runtime with an automation passphrase. Users can now change the local PIN/passphrase from Settings, reset local unlock from Settings or the lock screen without deleting credentials/portfolio/research data, and reinitialize a new PIN immediately after reset. Validation passed: `py -m pytest backend\tests`, `npm run typecheck`, and `npm run build`.

- Executed `T56 - Public Exposure Gateway And Sidecar Hardening` on 2026-05-19 against the current checkout.
- Added a gateway hardening middleware with loopback bind validation, centralized allowed CORS origins, unsafe-origin rejection, invalid-method rejection, sensitive-prefix rate-limit hooks, and redacted gateway audit events.
- Documented the current public-exposure posture in `docs/public-exposure-gateway-t56.md`; no route is promoted to a public candidate by T56.
- Added packaged gateway evidence in `logs/gateway-hardening-packaged-smoke-latest.json` with `health_ready=true`, `loopback_listener_only=true`, `unsafe_origin_rejected=true`, `invalid_method_rejected=true`, `sensitive_route_requires_session=true`, `allowed_origin_ok=true`, `redacted_gateway_audit_ok=true`, and `failures=[]`.
- Packaged startup evidence also remains green in `logs/packaged-startup-smoke-latest.json` with `health_ready=true`, `settings_runtime_ok=true`, `connections_status_ok=true`, `single_instance_ok=true`, `adopt_existing_ok=true`, `shutdown_sidecar_exited_ok=true`, and `failures=[]`.
- Validation passed: `py -m pytest backend\tests`, `npm run typecheck`, `npm run build`, `npm run tauri:build`, `npm run smoke:gateway-hardening:packaged`, and `npm run smoke:packaged-startup`.

- Executed `T57 - License And Open Source Boundary` on 2026-05-19 against the current checkout.
- Added `LICENSE` using Apache-2.0 and aligned `package.json` plus `src-tauri/Cargo.toml` license metadata to `Apache-2.0`.
- Updated `README.md`, `docs/SECURITY_ARCHITECTURE.md`, `docs/REPOSITORY_UPLOAD_READINESS.md`, and `docs/public-exposure-gateway-t56.md` so public readers can distinguish checked-in source/docs from local runtime data, credentials, Stronghold vaults, generated smoke logs, diagnostics, sidecar binaries, installers, and packaged bundles.
- Reconciled the security architecture doc with the implemented T53-T56 local security posture while preserving the current boundary: no hosted service, public API, OAuth, multi-user account system, remote sync, or new live-trading path.
- Validation passed: license metadata scan, public-boundary tracked-file scan, ignore coverage review, `git diff --check`, and `npm run typecheck`.
- No unresolved license/upload-boundary blocker was found. `npm audit --json` reported one existing moderate transitive `postcss < 8.5.10` advisory (`GHSA-qx2v-qp2m-jg93`), which was recorded as a public-trust follow-up and later resolved during T58.
- `T58 - Version Governance Cleanup` is now promoted as the next recommended task.

- Executed `T58 - Version Governance Cleanup` on 2026-05-19 against the current checkout.
- Added `backend/app/version.py` as the backend version source, exposed `app_version` and `sidecar_version` through `/api/v1/health` and `/api/v1/settings/runtime`, and surfaced the values in the Settings runtime panel.
- Added `scripts/check_version_consistency.mjs` plus `npm run check:version` to verify `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and backend sidecar metadata all report `0.1.0`.
- Added `CHANGELOG.md` and rewrote the previously garbled `PLAN.md` into a current public product plan aligned with the local-first, security-accountable roadmap.
- Updated `README.md` and `docs/REPOSITORY_UPLOAD_READINESS.md` so version governance and changelog evidence are part of the public source boundary.
- Updated the lockfile so transitive `postcss` resolves to `8.5.14`; `npm audit --json` now reports zero vulnerabilities.
- Validation passed: `npm run check:version`, `npm audit --json`, `npm run typecheck`, `py -m pytest backend\tests`, and `npm run build`. The frontend build still reports the existing large-chunk warning but completes successfully.
- No new blocker was found. `T59 - GitHub Actions CI Baseline` is now promoted as the next recommended task.

- Executed `T59 - GitHub Actions CI Baseline` on 2026-05-19 against the current checkout.
- Added `.github/workflows/ci.yml` with push-to-main, pull request, and manual dispatch triggers. The workflow runs separate source/frontend and backend jobs on `ubuntu-latest`.
- Added `scripts/check_public_boundary.mjs` plus `npm run check:public-boundary` to reject tracked runtime data, logs, diagnostics, generated frontend/Tauri artifacts, Stronghold/credential/secret files, installers, binaries, private keys, and obvious assigned provider secrets.
- The frontend/source CI job runs `npm ci --ignore-scripts`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, and `npm run build`.
- The backend CI job installs `backend/requirements.txt` with Python 3.11 and runs `python -m pytest backend/tests`.
- Updated `README.md`, `CHANGELOG.md`, `PLAN.md`, and `docs/REPOSITORY_UPLOAD_READINESS.md` to document the no-secret CI boundary and keep packaged EXE smoke, Tauri release builds, installer validation, signing, hosted update checks, provider credentials, and live trading out of T59.
- Validation passed locally: `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, `py -m pytest backend\tests`, and `git diff --check`. The frontend build still reports the existing large-chunk warning but completes successfully.
- Remote CI follow-up on 2026-05-20 fixed the first backend CI failure: GitHub Actions installed `backend/requirements.txt`, but `pytest` was not listed, so `python -m pytest backend/tests` failed with `No module named pytest`. Added `pytest==8.4.2`, kept backend CI dependencies in `backend/requirements.txt`, and opted the workflow into the Node 24 action runtime with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true`.
- Follow-up validation passed locally: `py -m pip install -r backend/requirements.txt`, `py -m pytest backend/tests`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, and `git diff --check`. `python` is not on the local Windows PATH, so local Python validation used the Windows `py` launcher; CI remains on Linux `python -m ...`.
- Remote validation passed on GitHub Actions run #2 for commit `f83caf8`: `Backend unit tests` and `Frontend and source checks` completed successfully.
- No new blocker was found. `T60 - Demo Mode And No-Key Startup` is now promoted as the next recommended task.

- Executed `T60 - Demo Mode And No-Key Startup` on 2026-05-20 against the current checkout.
- Added `/api/v1/settings/demo-mode` so source, desktop, and smoke validation can distinguish sample/no-key evaluation surfaces from credential-gated surfaces.
- Added dashboard no-key demo guidance, portfolio sample-only empty-state guidance, and Data Sources credential-missing sample context while keeping `credential_required` and `missing_credentials` visible.
- Allowed the Vite dev origins `http://127.0.0.1:5173` and `http://localhost:5173` through the local gateway so a fresh web-dev checkout can evaluate the no-key path without session-origin 403s; loopback-only and unsafe-origin rejection remain in place.
- Added `scripts/demo_no_key_smoke.ps1` plus `npm run smoke:demo-no-key`; the smoke starts a temporary no-key runtime, verifies dashboard seeded context, demo readiness, FRED/CoinGecko missing-credential visibility, empty real portfolio transactions, and blocked Binance private-account access.
- Updated README, CHANGELOG, and PLAN with the no-key demo evaluation path and T61 release-packaging handoff.
- Validation passed: `py -m pytest backend/tests`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, `npm run smoke:demo-no-key`, Playwright dashboard screenshot check, and `git diff --check`. The frontend build still reports the existing large-chunk warning but completes successfully.
- No new blocker was found. `T61 - First Release Packaging` is now promoted as the next recommended task.
- Executed `T61 - First Release Packaging` on 2026-05-20 against the current checkout.
- Refreshed the local release EXE, MSI, and NSIS outputs without uploading a GitHub Release.
- Fixed the installed-bundle sidecar packaging trap exposed by the first T61 smoke: Tauri no longer installs a root `pengbo-sidecar.exe` copied without its `_internal` directory, and installed smoke now prefers and asserts the onedir sidecar under `binaries\pengbo-sidecar`.
- Added `docs/RELEASE_CHECKLIST.md` so the first reviewer packaging path, smoke evidence, unsigned/local status, and repo boundary are documented in one place.
- Validation passed for T61 packaging: `npm run tauri:build`, `npm run smoke:packaged-startup`, `npm run smoke:installed-startup`, and `npm run smoke:installed-startup:nsis`.
- `T62 - README Product Proof Upgrade` is now the next recommended task.

- Started `T61# Temp - Manual Security Reset Refresh` on 2026-05-20 after reviewing the in-app Manual and Settings security copy.
- Scope: fix the visible Manual mojibake, add explicit local PIN/passphrase reset guidance, and make Settings reset copy clear that reset only clears local unlock state while preserving credentials, portfolio, research records, and local databases.
- Completed `T61# Temp - Manual Security Reset Refresh` on 2026-05-20.
- Rewrote the in-app Manual page copy into readable Chinese, added a dedicated `本地安全` section, and documented local PIN/passphrase initialization, idle relock, manual lock, reset entry points, and the reset data boundary.
- Updated Settings local-security copy so the reset control clearly says it only clears local unlock state and does not delete provider credentials, portfolios, research records, workflow records, or local databases.
- Validation passed: `npm run typecheck`, `npm run build`, and `npm run smoke:page-polish`. The build still reports the existing large-chunk warning but completes successfully.
- No backend security behavior, credential storage, provider route, live-trading path, packaging config, or GitHub Release flow changed in this temporary task.

- Executed `T62 - README Product Proof Upgrade` on 2026-05-20.
- Added README product-proof copy that explains the first reviewer journey across Dashboard, Research, Data Sources, Workflow Studio, and Manual/local-security boundaries.
- Added source-safe screenshots under `docs/product-screenshots/` generated from a temporary no-secret local runtime. The screenshot set deliberately excludes local paths, real provider credentials, Stronghold material, generated logs, diagnostics, installers, and packaged binaries.
- Updated README, CHANGELOG, PLAN, and this task board so T62 is complete and T63 is promoted next.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.
- No backend behavior, security model, credential storage, packaging config, GitHub Release flow, hosted account path, public network exposure, or live-trading route changed in T62.

- Executed `T63 - Contributor Entry Kit` on 2026-05-20.
- Added `CONTRIBUTING.md` with Windows-first setup, source-level baseline checks, no-key demo validation, packaged-smoke boundaries, safe contribution areas, sensitive areas, PR expectations, and first-issue candidates.
- Added `.github/ISSUE_TEMPLATE/bug-report.md` and `.github/ISSUE_TEMPLATE/first-issue.md` with explicit warnings not to paste secrets, Stronghold material, local runtime data, real account identifiers, unredacted logs, or live-trading details.
- Updated README, CHANGELOG, PLAN, and this task board so T63 is complete and T64 is promoted next.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- No runtime behavior, backend route, security model, credential storage, packaging config, GitHub Release flow, hosted support path, public API path, signed-release path, or live-trading path changed in T63.

- Executed `T64 - Research Flow Definition` on 2026-05-20.
- Added `docs/research-flow-definition.md` to define the primary journey: choose a symbol or source, inspect data status, create or open a Research brief, compare evidence, write thesis/assumptions/risk notes, export a local report, and review audit context only when it affects research evidence.
- Mapped existing surfaces and APIs across Asset, Research, Data Sources, Workflow Studio, factor/strategy evidence, local report export, security audit, execution audit, and workflow audit events.
- Captured current dead ends and follow-up mapping for T65 Asset entry polish, T66 data-status strip consistency, T67 Research brief quality, and T68 report evidence packs.
- Updated README, CHANGELOG, PLAN, and this task board so T64 is complete and T65 is promoted next.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- No runtime behavior, backend route, security model, credential storage, packaging config, hosted support path, public API path, signed-release path, or live-trading path changed in T64.

- Executed `T65 - Asset Page Research Entry Polish` on 2026-05-20.
- Added an Asset page research-entry panel that shows local data status, portfolio exposure, and related Research brief state for the selected symbol.
- Added direct Asset actions for opening or creating the Research brief, reviewing evidence, preparing a report, and checking Data Sources, all through existing frontend store/API flows.
- Added stable automation anchors for `asset-research-entry`, `asset-open-research`, `asset-data-status`, and `asset-next-action` states.
- Updated `docs/research-flow-definition.md`, README, CHANGELOG, PLAN, and this task board so T65 is complete and T66 is promoted next.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.
- No backend route, Research API contract, credential storage, Stronghold behavior, local-security/session/gateway model, packaging config, hosted support path, public API path, signed-release path, or live-trading path changed in T65.

- Executed `T66 - Data Status Strip Everywhere` on 2026-05-20.
- Added a shared `DataStatusStrip` frontend component for compact provider, freshness, credential, degraded/cache, read-only, live-trading boundary, and audit/evidence status.
- Replaced the Asset research-entry status summary with the shared strip while preserving the `asset-data-status`, `asset-research-entry`, `asset-open-research`, and `asset-next-action` anchors from T65.
- Added a Research brief `research-data-status` strip that summarizes provider, stale/cache state, credential-required coverage, degraded coverage, and evidence/audit note count.
- Reworked the Data Sources provider status panel to use the same strip with provider health, credential setup, freshness/cache state, read-only state, and live-trading boundary.
- Updated `docs/research-flow-definition.md`, README, CHANGELOG, PLAN, and this task board so T66 is complete and T67 is promoted next.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.
- No backend route, provider data model, Research API contract, credential storage, Stronghold behavior, local-security/session/gateway model, packaging config, hosted support path, public API path, signed-release path, or live-trading path changed in T66.

- Executed `T67 - Research Brief Quality Upgrade` on 2026-05-20.
- Added an additive `decision_review` section to Research briefs with reusable equity, crypto, portfolio, and macro templates.
- Structured each review around thesis, assumptions, supporting evidence, counter-evidence, risks, watch items, source provenance, and a cautious conclusion boundary.
- Made stale, unsupported, simulated, blocked, and audited evidence explicit in the backend brief snapshot, frontend Research view, and Markdown export.
- Preserved existing `/api/v1/research/briefs*` routes, existing notes/export behavior, evidence-chain compatibility, and Asset-to-Research handoffs.
- Updated `docs/research-flow-definition.md`, README, CHANGELOG, PLAN, and this task board so T67 is complete and T68 is promoted next.
- Validation passed: `py -m pytest backend/tests`, `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.
- T68 must finish by preparing and uploading the first GitHub Release after the evidence-pack export and secret/private-state checks pass.
- No credential storage, Stronghold behavior, local-security/session/gateway model, packaging config, hosted support path, public API path, signed-release path, or live-trading path changed in T67.

- Started `T68 - Report Export Evidence Pack` on 2026-05-20.
- Added evidence-pack summaries to Research exports, Data Sources exports, and Strategy backtest/paper exports.
- Added provider/freshness/evidence quality, audit-reference, and private-state exclusion language to exported Markdown so local reports can be reviewed without implying hidden credentials or private runtime state.
- Added `scripts/check_release_artifacts.mjs` plus `npm run check:release-artifacts` to verify only approved Windows release artifacts are used for the first GitHub Release upload.
- Added `docs/releases/v0.1.0.md` as the first release-note body.
- Updated `docs/RELEASE_CHECKLIST.md` with the T68 GitHub Release gate.
- Repaired packaged smoke scripts to use the current onedir sidecar path under `src-tauri/target/release/binaries/pengbo-sidecar/pengbo-sidecar.exe` instead of the removed root sidecar path.
- Refreshed desktop artifacts with `npm run tauri:build`: `pengbo-workbench.exe` `16,393,216 bytes`, MSI `124,547,556 bytes`, and NSIS `89,355,099 bytes`.
- Packaged evidence report smoke passed with `factor_run_id=factor-63e074feca5c`, `backtest_run_id=strategy-c81b06573d2d`, `paper_session_id=paper-6067a12f016a`, `intent_id=intent-9a7f53b9f7ee`, `brief_id=brief-02df6905a019`, `evidence_audit_count=2`, `export_exists=true`, and `restored_after_restart=true`.
- Packaged Data Sources smoke passed with `provider_count=5`, `report_source_count=5`, `report_export_exists=true`, and `failures=[]`.
- MSI and NSIS installed startup smokes passed with `root_sidecar_absent_ok=true`, `single_instance_ok=true`, `adopt_existing_ok=true`, and `failures=[]`.
- Validation passed: `py -m pytest backend/tests`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, `npm run sidecar:build`, `npm run tauri:build`, `npm run check:release-artifacts`, `npm run smoke:packaged-startup`, `npm run smoke:evidence-report`, `npm run smoke:data-sources:packaged`, `npm run smoke:installed-startup`, `npm run smoke:installed-startup:nsis`, and `git diff --check`.
- GitHub Release: `https://github.com/LaurenceFang/pengbo-workbench/releases/tag/v0.1.0`.

- Re-reviewed the live `Tauri + React + FastAPI + SQLite/DuckDB` desktop architecture against the current packaged-smoke workflow before extending the roadmap.
- Treated `FinceptTerminal` as a product-pattern reference rather than a migration target; the local `Pengbo Workbench` stack remains the implementation baseline.
- Closed `T26 - Research Workspace` as the first product-expansion sprint after the packaging-signoff lane.
- Closed `T27 - Analysis Module Registry` as the reusable composition layer that now sits between the research workspace and later capability/command surfaces.
- Closed `T28 - Provider Capability Catalog` as the shared provider-awareness layer across connections, asset, and research surfaces.
- Closed `T29 - Command Palette And Report Export` as the shared action layer that now sits above asset, research, screener, portfolio, and provider workflows without adding a second API surface.
- Closed `T30 - Provider Capability Packaged Signoff` as the packaged regression layer for the newer capability-driven desktop behavior.
- Closed `T31 - Credential Workflow And Crypto Capability Smoke Hardening` and `T32 - Desktop WebView Credential Input Automation Adapter` as the final provider-capability automation hardening pass.
- No new blocker task was added in the T33 execution pass; the next engineering sprint is now selected from the product roadmap gap exposed after portfolio analytics rather than another provider-capability unblocker.
- Added the next product roadmap sequence, `T33 -> T34 -> T35 -> T36 -> T37`, based on the latest GitHub/open-source review of OpenBB, FinceptTerminal, Ghostfolio, Wealthfolio, rotki, Qlib, Lean, Alphalens, FinSight, and TradingView Lightweight Charts.
- The next roadmap stage should move Pengbo toward a local Bloomberg-like research and execution terminal: deeper portfolio analytics first, then local factor research, strategy backtesting, paper trading, Binance-only automated crypto execution, and evidence-backed reports.
- Quant exploration is intended to reach automated order placement only for Binance trading, and only after local research, backtesting, paper trading, risk controls, audit logs, kill switches, and explicit user-owned Binance credential setup are in place. The assistant must not place live trades for the user during development or validation.
- Equity, ETF, macro, and non-Binance assets remain research/backtest/paper-trading or read-only analysis surfaces unless a later task explicitly changes scope; the current live trading target is Binance only.
- First-release factors must be limited to well-studied factor families such as momentum, value, quality/profitability, investment/conservative growth, and low-volatility/risk; any execution workflow must label these as research signals, not guaranteed profit sources.
- The planning path still preserves the current `/api/v1/assets/*`, `/api/v1/screeners/*`, and `/api/v1/portfolio/*` contracts by composing new work through additive analytics, research, chart, factor, strategy, paper-trading, and Binance-execution surfaces instead of rewriting stable payload shapes.
- Closed `T34 - Local Factor Research Lab` as the validated local factor evidence layer that now feeds Research without enabling any order placement or broker request path.
- Closed `T35 - Strategy Backtesting And Paper Trading` as the local simulation layer that converts factor snapshots into explicit backtests, paper ledgers, and reports while still prohibiting live order paths.
- Closed `T36 - Automated Binance Execution And Risk Controls` as the default-off Binance-only execution layer with intent creation, pre-trade risk gates, kill switch state, mock-covered adapter submit, comparable live ledger payloads, and durable audit events.
- Closed `T37 - Factor-Aware Research, Screening, And Execution Reports` as the evidence-chain reporting layer that now links factor signals, screener rationale, backtest assumptions, paper ledgers, Binance execution intents, risk blocks, and audit references without expanding live trading scope.
- Closed `T38 - Desktop UI Information Architecture` as the structural desktop-shell blueprint before visual styling, localization, page polish, workflow, or data-source work begins.
- Closed `T39 - Desktop Visual Design System Refresh` as the shared visual foundation for the shell, panels, controls, tables, charts, badges, and density rules before localization and page-by-page polish.
- Replaced the broad Fincept follow-up plan with smaller tasks: UI information architecture, visual design refresh, localization, workflow backend, workflow UI, workflow packaged signoff, data-source foundation, concrete data-source connectors, and data-source UI/signoff.
- Reaffirmed the trading boundary for the new sequence: workflow automation may create Binance preset live-order intents and reports, then surface a confirmation modal; only an explicit user click may submit the prepared Binance order, and no non-Binance live submit path should be added.
- Re-read the full local `E:\Fincept Terminal` checkout after the user pointed out the product gap. Fincept's reusable ideas for Pengbo are now ranked as: first, a denser terminal-style page and workspace system; second, Workflow Studio / node-like automation with audit and confirmation boundaries; third, a Data Sources Center with connector catalog, freshness, provenance, credential state, and source testing. Fincept remains a product benchmark rather than a migration target; Pengbo keeps the current `Tauri + React + FastAPI + SQLite/DuckDB` baseline.

## Latest Execution Update

- Completed `T53 - Local Unlock PIN And Idle Lock`.
- Added a local-first unlock layer in the sidecar: `/api/v1/security/local/status`, `initialize`, `unlock`, `lock`, `idle-timeout`, and `touch` now track initialized/locked state, salted unlock-factor hash, idle expiry, failed attempts, and lockout metadata without storing raw PIN/passphrase material.
- Gated sensitive backend routes behind the local unlock boundary: provider credential tests/profile clearing, Binance execution config/intents/kill-switch/audit, and global security audit reads now return a locked response until local unlock succeeds.
- Added Tauri command-side unlock checks for provider credential save, clear, and desktop connection testing so Stronghold-backed credential operations cannot be triggered from the desktop runtime while the local security layer is locked.
- Added the desktop unlock UI: sensitive workspaces now show a local initialize/unlock panel, expose a lock action in the shell, refresh activity through `/security/local/touch`, and trigger idle relock through the sidecar.
- Added the Settings security-audit panel for local unlock and sensitive-surface events after unlock.
- Added repeatable packaged validation via `scripts/packaged_local_security_smoke.ps1` and `npm run smoke:local-security:packaged`. The latest result in `logs/local-security-packaged-smoke-latest.json` records `health_ready=true`, `locked_blocked_audit=true`, `failed_unlock_recorded=true`, `idle_relock_ok=true`, `restart_restore_ok=true`, `sqlite_plaintext_secret_found=false`, and `failures=[]`.
- Validation passed:
  - `py -m pytest backend\tests`
  - `npm run typecheck`
  - `npm run tauri:build`
  - `npm run smoke:local-security:packaged`
- Completed `T54 - Account-Scoped Provider Credential Model`.
- Added account-scoped local credential profiles in SQLite with automatic migration of existing `connection_profiles` rows into the default `local_default` profile.
- Preserved existing `/api/v1/connections/status`, `/catalog`, `/test`, and profile-clear compatibility while adding local profile list/create/select endpoints for the desktop credential surface.
- Kept raw credential material in the Tauri Stronghold bridge. Profile-scoped Stronghold keys now use the selected local profile while retaining default-profile fallback compatibility for existing secret keys.
- Added Connections UI affordances for selecting or creating a local profile and showing provider readiness ownership per provider card.
- Extended credential audit events with redacted `profile_id` and `profile_label` context for profile creation, profile selection, provider readiness checks, and profile clearing.
- Added repeatable account-scoped packaged validation via `scripts/packaged_account_scoped_credentials_smoke.ps1` and `npm run smoke:account-credentials:packaged`. The latest result in `logs/account-scoped-credentials-smoke-latest.json` records `health_ready=true`, `default_profile_seen=true`, `profile_created=true`, `profile_switch_ok=true`, `readiness_profile_context_ok=true`, `redacted_audit_ok=true`, `sqlite_plaintext_secret_found=false`, and `failures=[]`.
- Validation passed:
  - `py -m pytest backend/tests/test_account_scoped_credentials.py backend/tests/test_security_audit_service.py`
  - `py -m pytest backend/tests/test_capability_service.py backend/tests/test_data_source_service.py backend/tests/test_execution_service.py backend/tests/test_research_service.py backend/tests/test_account_scoped_credentials.py`
  - `npm run typecheck`
  - `npm run build`
  - `cargo check`
  - `npm run tauri:build`
  - `npm run smoke:account-credentials:packaged`
- The older `smoke:provider-capability-signoff` harness could not be rerun cleanly during this pass because its runtime reset step repeatedly hit an external SQLite file lock from a packaged sidecar process; the T54-specific packaged smoke completed cleanly after strengthening sidecar cleanup and no code-level provider regression was observed in build or focused tests.
- No new blocker task was discovered. `T55 - Future Public Auth And Session Layer` is now promoted as the next recommended task.

- Executed the first public GitHub upload path for `T52 - Git Upload Readiness And Repository Normalization`.
- Created the public repository `LaurenceFang/pengbo-workbench` for the safe source upload target.
- Initialized local Git on `main`, preserved the generated/runtime/log/secret ignore boundary, and added extra ignore coverage for local Claude state, Claude probe logs, local shortcut/link artifacts, and generated smoke screenshots.
- Kept generated sidecar binaries, Tauri release bundles, runtime databases, Stronghold data, smoke JSON logs, Python/Rust/TypeScript caches, local automation state, and machine-local credential files out of the public upload candidate set.
- The initial upload preserves the existing `/api/v1/...` runtime contract and does not promote `T53`, `T54`, `T55`, or `T56`.

- Completed the Claude Code follow-up remediation for `T52 - Git Upload Readiness And Repository Normalization`.
- Reviewed the independent Claude Code security findings and fixed the upload-readiness gaps without changing public API routes, response contracts, database schemas, live-trading behavior, remote repository state, commits, or pushes.
- Tightened FastAPI CORS method policy in `backend/app/api/factory.py` from wildcard methods to explicit `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS`, while preserving the existing local-only origins.
- Extended `README.md` and `docs/REPOSITORY_UPLOAD_READINESS.md` so the public-upload boundary now explicitly distinguishes API source code from API keys/tokens/secrets, lists `PENGBO_TRANSLATION_API_KEY` as a non-committable secret, and explains Stronghold as local single-user secret storage rather than a multi-user permission system.
- Documented the Tauri package resource edge: `src-tauri/tauri.conf.json` references `../logs/sidecar-build-latest.json`, which is generated by `npm run sidecar:build`, may contain machine-local build paths, and must be regenerated locally rather than committed as source.
- Strengthened diagnostic evidence rules: public uploads must keep `logs/` and `logs/*-latest.json` ignored; private review branches may use selected redacted smoke JSON only after confirming no real secrets, account identifiers, real email addresses, or machine-local data beyond acceptable build paths.
- Validation passed:
  - Static search for `PENGBO_TRANSLATION_API_KEY`, `allow_methods`, and `sidecar-build-latest.json`
  - Temporary Git ignore smoke confirming generated/runtime/log paths stay ignored while source/docs/config stay trackable
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run sidecar:build`
  - `npm run tauri:build`
- `T53`, `T54`, `T55`, and `T56` remain deferred and were not promoted.

- Completed `T52 - Git Upload Readiness And Repository Normalization`.
- Repaired the task-board drift where the top-level assessment had already selected T52 but the `Recommended Next Task` section still pointed at the older roadmap-completion review.
- Added `README.md` with the local-first Tauri + React + FastAPI + SQLite/DuckDB architecture summary, workspace map, safety boundaries, local setup/build commands, and packaged-smoke guidance.
- Added `docs/REPOSITORY_UPLOAD_READINESS.md` with public-upload commit categories, do-not-commit boundaries, optional diagnostic evidence rules, pre-upload checklist, and rebuild notes for generated sidecar and Tauri artifacts.
- Expanded the root `.gitignore` and `src-tauri/.gitignore` so public Git candidates exclude dependency folders, build outputs, TypeScript build info, Python/Rust caches, generated Tauri targets, generated sidecar binaries, logs, local runtime data, diagnostics, Stronghold/secret material, installers, EXEs, DLLs, PDBs, and machine-local credential state.
- Preserved the current product/runtime boundary: no new backend route, frontend workflow, database migration, live-trading path, remote repository, commit, or push was added. `T53` through `T56` remain deferred until explicitly selected.
- Validation passed:
  - README/package-script consistency review
  - ignore-boundary review for `node_modules/`, `dist/`, `.pengbo-runtime/`, `.playwright-mcp/`, `.pyinstaller/`, `logs/`, `src-tauri/target/`, and `src-tauri/binaries/`
  - temporary Git ignore smoke outside the project tree: generated/runtime paths ignored while `README.md`, `docs/REPOSITORY_UPLOAD_READINESS.md`, `package.json`, `backend/app/main.py`, `src/App.tsx`, and `src-tauri/Cargo.toml` stayed trackable
  - sensitive-term documentation scan for public-upload guidance
  - `npm run typecheck`
  - `npm run build`

- Completed `T49 - Terminal Experience Repair And Product Manual`.
- Reworked asset charting into a real multi-period K-line surface. The default chart interval is now `30m`; common switches expose `15m`, `1h`, `1d`, and `1wk`, while the aligned more-period selector covers `30m`, `2h`, `4h`, `8h`, `1mo`, and `1y` plus daily/weekly choices. The chart now refetches interval-aware history and keeps current price, last update, and live/cache state visible.
- Extended `/api/v1/prices/history` with compatible `symbol`, `interval`, and `range` parameters covering `15m|30m|1h|2h|4h|8h|1d|1wk|1mo|1y`; unsupported yearly bars are generated through local aggregation when needed, and invalid intervals return `422`.
- Fixed screener variant tuning so system defaults remain read-only, but clicking liquidity preference, trend requirement, or overheat guardrail automatically copies the preset into a custom variant, applies the selected tuning, saves/activates through the existing variant flow, and refreshes the run summary.
- Repaired the Research workspace layout with bounded three-column height. The middle analysis module list and right notes/export rail now scroll internally instead of stretching the whole page indefinitely.
- Added a first-class `manual` workspace and navigation item for the product manual. The manual explains workflows, analysis, screening, factors, backtesting, paper trading, Binance real-order initiation, confirmation gates, and translation status without adding any silent live-trading path.
- Expanded Factor Lab beyond an inert equity-only selector. Asset type is now selectable across stock, ETF/index proxy, index, and crypto; new research-only factor families cover crypto momentum, crypto volume confirmation, crypto overheat guardrails, index trend breadth, index defensive quality, and short-term reversal. Every factor family now carries a one-line `simple_description` for the UI.
- Added the local translation tooling layer: typed translation status/suggestion API endpoints, env-driven optional online adapter settings, a local glossary fallback, and `npm run check:i18n` for dictionary parity, mojibake, and fixed-English candidate scanning.
- Validation passed:
  - `py -m unittest backend.tests.test_asset_history backend.tests.test_factor_service backend.tests.test_translation_service backend.tests.test_settings_service`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run check:i18n`
  - `npm run build`
  - `npm run smoke:page-polish`
  - `npm run tauri:build`
  - `npm run smoke:screener-variant-signoff`
  - `npm run smoke:factor-lab`
- `npm run smoke:page-polish` covered 12 pages and 48 screenshots, including Asset, Research, Screeners, Factor Lab, and Manual in both supported languages with `failures=[]`. The first `npm run tauri:build` attempt hit Windows `PermissionDenied` because an old release EXE and sidecar still held the release directory and port `8765`; after stopping those Pengbo processes, the release EXE, sidecar, MSI, and NSIS artifacts rebuilt successfully. No live Binance submission path was added.

- Completed `T48 - Data Source Credential And Research Workflow Repair`.
- Fixed the EDGAR credential handoff gap where existing Research briefs could stay on `credential_required` after EDGAR was saved and verified. Research briefs now have a refresh endpoint and auto-refresh provider-sensitive snapshots when the filings provider becomes configured; AAPL filings reuse the recent packaged cache to avoid a second slow EDGAR live request during signoff.
- Added desktop Stronghold support for `fred` and `coingecko` secrets in `src-tauri/src/lib.rs`, including restart-safe sidecar environment injection for `PENGBO_FRED_API_KEY`, `PENGBO_COINGECKO_DEMO_API_KEY`, and optional `PENGBO_COINGECKO_PRO_API_KEY`.
- Added keyed-source credential controls to `src/views/data-sources-view.tsx`: FRED and CoinGecko now expose visible save/verify and clear actions from the Data Sources workspace, while preserving read-only and no-live-trading catalog contracts.
- Added the additive Workflow Studio template `data_sources_to_research`; it samples read-only macro/news/crypto sources, carries source provenance into the Research source context, and returns a navigable `research_brief` artifact.
- Strengthened packaged smoke coverage:
  - `scripts/packaged_data_sources_smoke.ps1` now checks the FRED and CoinGecko credential panels.
  - `scripts/packaged_workflow_studio_smoke.ps1` now verifies `data_sources_to_research` completes with a Research brief artifact.
- Validation passed:
  - `py -m unittest backend.tests.test_research_service backend.tests.test_data_source_service backend.tests.test_workflow_service`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:data-sources:packaged`
  - `npm run smoke:workflow-studio:packaged`
  - `npm run smoke:provider-capability-signoff`
  - `npm run smoke:page-polish`
- Note: packaged smoke scripts must be run serially because they intentionally start/stop the same release EXE and backup/restore the same AppData directory; parallel packaged smoke runs can interrupt each other.

- Completed `T47 - Data Sources UI And Signoff`.
- Promoted the Data Sources workspace into a first-class signoff surface: `src/views/data-sources-view.tsx` now exposes provider coverage, domains, credentials, freshness, cache/testability/rate-limit notes, provenance, stale/unavailable state, and explicit `read_only` / `live_trading` contract markers.
- Added stable ASCII automation anchors for packaged validation, including `data-sources-view providers=...`, `data-source-provider provider=... health=...`, `data-source-preview kind=... state=...`, and `data-source-provenance provider=... stale=...`.
- Localized the high-traffic Data Sources copy in `src/i18n/index.ts` while preserving the existing Chinese/English shell preference flow.
- Added the additive report export route `POST /api/v1/data-sources/reports/export`; it writes a read-only Markdown source report with catalog provenance, credential/cache/unavailable summaries, and sampled macro/news/crypto status even when live fetches are missing credentials or unavailable.
- Added `scripts/packaged_data_sources_smoke.ps1` plus `npm run smoke:data-sources:packaged`. The latest packaged result in `logs/data-sources-packaged-smoke-latest.json` started `src-tauri/target/release/pengbo-workbench.exe`, verified `provider_count=5`, confirmed `worldbank/dbnomics/rss_events=ok`, confirmed `fred/coingecko=missing_credentials`, verified Data Sources UIAutomation anchors, checked all five connector catalog entries remain `read_only=true` and `live_trading=false`, and exported `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench\diagnostics\reports\data-sources-2026-05-13T183350.513682z0000.md`.
- Expanded `scripts/page_polish_smoke.mjs` so Data Sources is included in the bilingual page-polish pass; the latest result records `page_count=8`, `screenshot_count=32`, and `failures=[]`.
- Revalidated EDGAR/Binance provider workflow non-regression with `npm run smoke:provider-capability-signoff`; the latest `logs/provider-capability-signoff-latest.json` records `failures=[]` after the baseline, identity-save, post-restart, and identity-clear stages.
- Validation passed:
  - PowerShell parser check for `scripts/packaged_data_sources_smoke.ps1`
  - `py -m unittest backend.tests.test_data_source_service`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run smoke:page-polish`
  - `npm run tauri:build`
  - `npm run smoke:data-sources:packaged`
  - `npm run smoke:provider-capability-signoff`
- `npm run build` and `npm run tauri:build` passed with the existing Vite large-chunk warning only. No new blocker task was discovered. The current T38-T47 roadmap is closed; the next step should be a fresh product-priority review rather than an automatic blocker follow-up.

- Completed `T46 - Initial Data Source Connector Pack`.
- Registered and validated the first read-only connector pack for `worldbank`, `dbnomics`, `rss_events`, `fred`, and `coingecko`, preserving the existing `/api/v1/connections/catalog` compatibility and additive `/api/v1/data-sources/*` route shape.
- Confirmed the data-source runtime keeps optional-key sources explicit: FRED reports `missing_credentials` without `PENGBO_FRED_API_KEY` or `FRED_API_KEY`, and CoinGecko reports `missing_credentials` without `PENGBO_COINGECKO_DEMO_API_KEY` or `PENGBO_COINGECKO_PRO_API_KEY`.
- Strengthened `backend/tests/test_data_source_service.py` so T46 now covers source status listing, World Bank macro fetch plus cached fallback, DBnomics macro fetch plus cached fallback, FRED keyed fetch with API-key masking plus cached fallback, CoinGecko demo-key market fetch plus cached fallback, RSS event fetch plus cached fallback, and public-provider unavailable handling with no cache.
- Safety scan for the T46 data-source files found no submit/risk/kill-switch path; provider registry metadata continues to mark all catalog providers as `read_only=true` and `live_trading=false`.
- Validation passed:
  - `py -m unittest backend.tests.test_data_source_service backend.tests.test_capability_service`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
- `npm run build` passed with the existing Vite large-chunk warning only. No new blocker task was discovered. The next planned task is `T47 - Data Sources UI And Signoff`.

- Completed `T45 - Data Source Expansion Foundation`.
- Added additive source metadata fields to `/api/v1/connections/catalog` while preserving the existing provider/capability fields and route names: asset coverage, data domains, region/locale, credential notes, rate-limit notes, cache policy, freshness, provenance, testability, `read_only`, and `live_trading=false`.
- Refactored the current `market`, `fundamentals`, `edgar`, and `binance` catalog definitions into a provider source registry in `backend/app/services/capability_service.py`, so later read-only connectors can be registered without page-specific capability hacks.
- Unified read-only provider test health in `ConnectionsService`: public sources such as `market` now return and persist a `planned` test result instead of looking like missing credentials, while unknown providers return explicit `unsupported`.
- Updated frontend API types and the Connections provider cards with lightweight source-contract rendering for domains, coverage, freshness, testability, cache policy, and read-only status without adding the dedicated Data Sources workspace reserved for `T47`.
- Validation passed:
  - `py -m unittest backend.tests.test_capability_service`
  - `npm run typecheck`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run build`
- `npm run build` passed with the existing Vite large-chunk warning only. No new blocker task was discovered. `T46 - Initial Data Source Connector Pack` is now also completed; the current next planned task is `T47 - Data Sources UI And Signoff`.

- Completed `T44 - Workflow Packaged Signoff`.
- Added `scripts/packaged_workflow_studio_smoke.ps1` plus `npm run smoke:workflow-studio:packaged` so Workflow Studio is now validated through the real release desktop EXE, not only the Vite web surface.
- Rebuilt the packaged desktop artifacts with `npm run tauri:build`; refreshed artifacts include `src-tauri/target/release/pengbo-workbench.exe` at `16,386,560 bytes`, `src-tauri/target/release/pengbo-sidecar.exe` at `117,919,125 bytes`, `bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi` at `123,420,672 bytes`, and `bundle/nsis/Pengbo Workbench_0.1.0_x64-setup.exe` at `120,943,112 bytes`.
- The packaged smoke starts `Pengbo Terminal`, waits for the sidecar, sets `workflowStudio` as the default view in an AppData backup/restore sandbox, clicks the `paper_to_binance_intent` template in the desktop WebView, invokes the run button, verifies `status=blocked`, verifies `await_user_confirmation status=manual_required policy=user_confirmed_binance_submit`, verifies a `binance_intent` artifact, exports an evidence report from the generated paper-session artifact, restarts the desktop, and verifies the recent workflow run restores.
- Latest packaged result in `logs/workflow-studio-packaged-smoke-latest.json`: `template_count=6`, `run_id=workflow-76da6f749444`, `run_status=blocked`, `manual_required=true`, `manual_policy=user_confirmed_binance_submit`, `binance_intent_artifact_count=1`, `evidence_export_status=completed`, `evidence_export_exists=true`, `recent_restored_after_restart=true`, and `failures=[]`.
- Safety scan still found no Workflow Studio path calling submit/live-mode/kill-switch/risk-acknowledgement mutation; the only hit was the existing command-palette read of `config.live_enabled` for display status.
- Revalidated `T44` with:
  - PowerShell parser check for `scripts/packaged_workflow_studio_smoke.ps1`
  - `npm run typecheck`
  - `npm run tauri:build`
  - `npm run smoke:workflow-studio:packaged`
- No new blocker task was discovered. `T46 - Initial Data Source Connector Pack` is now completed; the current next planned task is `T47 - Data Sources UI And Signoff`.

- Completed `T43 - Workflow Studio UI`.
- Added a first-class `workflowStudio` desktop workspace after Strategy Lab, including persisted default-view compatibility, localized navigation/title copy, command-palette entries, and a template-driven Workflow Studio page.
- Added frontend Workflow API types/client calls for `/api/v1/workflows/templates`, `/api/v1/workflows/runs/recent`, `/api/v1/workflows/runs`, and `/api/v1/workflows/runs/{run_id}`.
- Built the Workflow Studio surface around template catalog, fixed input forms, step timeline, blocked/manual-required state panels, artifact/evidence rail, recent run restore, and artifact navigation into Research, Factor Lab, Strategy Lab, and execution-evidence context.
- Preserved the T42 Binance safety boundary: the T43 UI can show `manual_required` and `binance_intent` artifacts, but does not call Binance submit, change live mode, clear kill switches, or acknowledge risk.
- Added `scripts/workflow_studio_smoke.mjs` plus `npm run smoke:workflow-studio`; the latest result recorded `template_count=6`, `run_label="workflow-studio-view template=paper_to_binance_intent run=workflow-b7a7675c7090 status=blocked"`, `binance_intent_artifact_count=1`, `recent_run_count_after_reload=2`, `console_issue_count=0`, and `failures=[]`.
- Expanded `scripts/page_polish_smoke.mjs` so `npm run smoke:page-polish` now covers Workflow Studio in `zh-CN` and `en-US` at `desktop-min` and `desktop-wide`; the latest result records `page_count=7`, `screenshot_count=28`, and `failures=[]`.
- Revalidated `T43` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run smoke:workflow-studio`
  - `npm run smoke:page-polish`
- `npm run build` passed with the existing Vite large-chunk warning only; no new blocker task was discovered.
- The T43 pass originally advanced the workflow lane to `T44 - Workflow Packaged Signoff`, and `T44`, `T45`, and `T46` are now completed; the current next planned task is `T47 - Data Sources UI And Signoff`.

- Completed `T42 - Workflow Engine Backend`.
- Added `backend/app/services/workflow_service.py` as the template-driven workflow engine that composes existing screener, research, factor, strategy, paper-trading, Binance execution-intent, and report-export services instead of duplicating domain logic.
- Added workflow Pydantic models in `backend/app/models.py`, SQLite persistence in `backend/app/storage/sqlite_store.py`, container wiring in `backend/app/api/factory.py`, and additive `/api/v1/workflows/templates`, `/api/v1/workflows/runs/recent`, `/api/v1/workflows/runs`, and `/api/v1/workflows/runs/{run_id}` routes in `backend/app/api/routes.py`.
- Seeded six safe templates: `screener_to_research`, `research_to_factor`, `factor_to_backtest`, `backtest_to_paper`, `paper_to_binance_intent`, and `evidence_report_export`.
- Enforced explicit action policy categories: `read_only`, `local_analysis`, `local_simulation`, `binance_intent`, and `user_confirmed_binance_submit`.
- Preserved the Binance live-trading boundary: workflow automation can create a Binance intent and expose a `manual_required` confirmation step, but it does not call submit, change live mode, clear kill switches, or silently acknowledge risk.
- Added `backend/tests/test_workflow_service.py` covering template policy categories, service/API run creation, restart-safe history restore, blocked-step inspection, evidence artifacts, and the Binance manual-confirmation boundary.
- Revalidated `T42` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
- `npm run build` passed with the existing Vite large-chunk warning only; no new blocker task was discovered.
- The T42 pass originally advanced the workflow lane to `T43 - Workflow Studio UI`, and `T43`, `T44`, `T45`, plus `T46 - Initial Data Source Connector Pack` are now completed; the current next planned task is `T47 - Data Sources UI And Signoff`.

- Completed `T41 - Core Page UI Polish Pass`.
- Reworked Dashboard into a denser terminal overview with market pulse, focused asset context, runtime/provider readiness, and clearer Research/Asset/Settings handoff copy while keeping the existing dashboard data contract.
- Tightened Asset capability presentation so quote, chart, fundamentals, filings, and provider-coverage states share clearer available / credential-required / temporarily-unavailable / unsupported copy.
- Promoted shared frontend primitives in `src/components/shared.tsx` for localized empty/chart/status states and widened action callback typing so shared panels can safely host async retry handlers.
- Expanded `src/i18n/index.ts` for high-traffic Dashboard, Asset, Settings, shell, command, shared panel, chart, empty/error, table/action, and status copy used by the polished pages.
- Standardized the page-level terminal surface in `src/styles.css`: restrained the decorative backdrop, reduced panel/control radius, tightened density spacing, added Dashboard/Asset page layout helpers, and kept T39 density tokens as the source of truth.
- Added `scripts/page_polish_smoke.mjs` and `npm run smoke:page-polish`; the smoke captures Dashboard, Research, Strategy Lab, Portfolio, Connections, and Settings in both `zh-CN` and `en-US` at `desktop-min` and `desktop-wide`, checks visible mojibake markers, checks clipped controls, and restores the original language/density preferences after capture.
- Captured the latest T41 screenshot evidence in `logs/page-polish-screenshots/page-polish-smoke-latest.json` with `language_count=2`, `viewport_count=2`, `page_count=6`, `screenshot_count=24`, and `failures=[]`.
- Existing visual smoke remains compatible: `logs/visual-design-screenshots/visual-design-smoke-latest.json` still records `viewport_count=2`, `page_count=6`, `screenshot_count=12`, and `failures=[]`.
- Revalidated `T41` with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run smoke:localization`
  - `npm run smoke:visual-design`
  - `npm run smoke:page-polish`
  - `npm run smoke:portfolio-ui-signoff`
- The conditional packaged portfolio UI regression also passed after the Portfolio page copy/layout touch, with `logs/portfolio-ui-signoff-latest.json` recording `health_ready=true` and `failures=[]`.
- No backend schema, provider, workflow, trading, or data-source behavior changed in T41. No new blocker task was discovered; Fincept-like breadth gaps remained intentionally assigned to the existing `T42-T44` Workflow lane and `T45-T47` Data Sources lane instead of being folded into page polish.
- T41 handed off to `T42 - Workflow Engine Backend`, which is now complete.

- Completed `T40 - Chinese/English Localization Foundation`.
- Added additive backend preference fields `language: zh-CN | en-US` and `density: standard | compact` on the existing `/api/v1/settings/preferences` contract without adding a migration table or changing the route shape.
- Added `src/i18n/index.ts` as a typed lightweight localization layer with shared view labels/titles, shell copy, Settings copy, Command Palette copy, and locale-aware number/currency/percent helpers.
- Wired persisted language and density into `src/store/app-store.ts`, `src/App.tsx`, and `src/views/settings-view.tsx`; Settings can switch language/density immediately and save the preference for restart restore.
- Localized the main shell navigation/topbar/setup banners, shared status badge labels, Settings normal flow, and Command Palette common frame while preserving stable ASCII automation anchors such as `nav-*`, `search-asset`, `open-command-palette`, and command-palette labels.
- Restored readable runtime network error text in `src/lib/api.ts` and kept existing backend/API tests compatible.
- Added `backend/tests/test_settings_service.py`, `scripts/localization_smoke.mjs`, and `npm run smoke:localization`; the latest smoke result is recorded at `logs/localization-smoke-latest.json` with `failures=[]`.
- Revalidated `T40` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run smoke:localization`
- No new blocker was discovered during `T40`; the next planned task is `T41 - Core Page UI Polish Pass`, including deeper page-level copy/table/spacing polish across both languages.

- Completed `T39 - Desktop Visual Design System Refresh`.
- Added additive design-system tokens and density rules in `src/styles.css` while preserving existing class names, view behavior, and automation-safe `aria-label` anchors.
- Replaced the old decorative gradient/orb look with a restrained multi-hue financial-terminal surface system covering sidebar/navigation, topbar/status area, command entry, shared panels, tables, metric cards, status badges, risk/cache states, buttons, focus states, chart panels, and responsive shell rules.
- Added the `density-standard` shell class plus `.density-compact` CSS rules so T40 can persist a density preference without redesigning the visual system.
- Added `scripts/visual_design_smoke.mjs`, `npm run smoke:visual-design`, and the Playwright dev dependency for repeatable browser screenshot capture.
- Captured 12 visual screenshots across Dashboard, Asset, Research, Strategy Lab, Portfolio, and Connections at `desktop-min` and `desktop-wide` sizes under `logs/visual-design-screenshots/`.
- Captured the latest T39 result in `logs/visual-design-screenshots/visual-design-smoke-latest.json` with `viewport_count=2`, `page_count=6`, `screenshot_count=12`, and `failures=[]`.
- Revalidated `T39` with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run smoke:visual-design`
  - `npm run smoke:portfolio-ui-signoff`
- No new blocker was discovered during `T39`; the next planned task is `T40 - Chinese/English Localization Foundation`.

- Completed `T38 - Desktop UI Information Architecture`.
- Added `docs/desktop-ui-information-architecture.md` as the T38 delivery artifact.
- The spec maps the current desktop shell across left navigation, top status/command area, one active main workspace, and a reserved right context area.
- The spec covers current workspaces `Dashboard`, `Asset`, `Research`, `Factor Lab`, `Strategy Lab`, `Screeners`, `Portfolio`, `Connections`, and `Settings`, plus future `Workflow Studio` and `Data Sources` surfaces.
- The spec assigns global context ownership to `src/store/app-store.ts` and follow-up shell/layout ownership to `src/App.tsx`, `src/styles.css`, `src/components/shared.tsx`, `src/components/command-palette.tsx`, and `src/views/*.tsx`.
- The spec explicitly keeps T38 structural only: no runtime behavior, provider behavior, API shape, localization dictionary, visual theme, or live trading behavior changed.
- Static validation for T38:
  - Reviewed `src/App.tsx`, `src/store/app-store.ts`, and `src/views/*.tsx` against the documented shell/workspace map.
  - Reviewed the existing T38/T39/T40/T41/T42-T47 task-board sequence before syncing completion.
  - No build or smoke run was required because T38 changed documentation and task-board state only.
- No new blocker was discovered during `T38`; the next planned task is `T39 - Desktop Visual Design System Refresh`.

- Completed `T37 - Factor-Aware Research, Screening, And Execution Reports`.
- Added a read-only backend `EvidenceService` in `backend/app/services/evidence_service.py` and wired it through `backend/app/api/factory.py`, `backend/app/api/routes.py`, and `backend/app/services/research_service.py`.
- Added additive model/API fields without changing existing routes: `ScreenerResult.factor_context`, `ResearchBrief.evidence_context`, extra source IDs on research creation, and `GET /api/v1/research/evidence/{symbol}` with optional `factorRunId`, `backtestRunId`, `paperSessionId`, and `intentId`.
- Research briefs now persist and export an evidence chain covering factor context, screener matches, backtest metrics/assumptions, paper orders/fills/ledger summary, Binance execution status/risk blocks, audit references, and data-quality notes.
- Screener runs now surface recent factor rank/score/bucket/contribution context per result when a matching factor snapshot is available, while preserving all existing screener result fields.
- Strategy report export now includes factor definitions, factor source timestamps, strategy assumptions, paper/live execution ledger references, risk blocks, and audit ids where linked.
- Desktop Research now renders an evidence-chain panel; Screeners show factor evidence on rows; Command Palette adds evidence-chain and evidence-backed report export actions, with no live-order submit command added.
- Added `scripts/packaged_evidence_report_smoke.ps1` plus `npm run smoke:evidence-report`; the packaged smoke creates a factor run, backtest, paper session, blocked Binance intent, evidence-backed research brief, export, and restart restore.
- Captured the latest packaged T37 result in `logs/evidence-report-smoke-latest.json` with `health_ready=true`, `failures=[]`, `factor_run_id=factor-3eb1522eafd5`, `backtest_run_id=strategy-d8b427ea2ae8`, `paper_session_id=paper-324eed9be3be`, `intent_id=intent-5dd776443dc8`, `brief_id=brief-7a735dbb15ba`, all evidence links true, `evidence_audit_count=2`, `export_exists=true`, and `restored_after_restart=true`.
- Revalidated `T37` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - PowerShell parser check for `scripts/packaged_evidence_report_smoke.ps1`
  - `npm run typecheck`
  - `npm run build`
  - `npm run sidecar:build`
  - `npm run tauri:build`
  - `npm run smoke:evidence-report`
- No new blocker was discovered during `T37`; optional next work is a visual walkthrough/report-polish pass, not a required unblocker.

- Completed `T36 - Automated Binance Execution And Risk Controls`.
- Added additive backend execution contracts in `backend/app/models.py`, `backend/app/services/execution_service.py`, `backend/app/storage/sqlite_store.py`, `backend/app/providers/binance.py`, and `backend/app/api/routes.py` without changing existing `/api/v1/assets/*`, `/api/v1/factors/*`, `/api/v1/strategies/backtests/*`, or `/api/v1/strategies/paper/*` response shapes.
- `ExecutionService` now supports `GET /api/v1/execution/binance/config`, `PUT /api/v1/execution/binance/config`, `GET /api/v1/execution/binance/intents/recent`, `POST /api/v1/execution/binance/intents`, `POST /api/v1/execution/binance/intents/{intent_id}/submit`, `POST /api/v1/execution/binance/kill-switch`, and `GET /api/v1/execution/binance/audit`.
- Binance live mode remains default-off; submit is blocked unless live mode is explicitly enabled, risk acknowledgement is recorded, Binance credentials are configured, kill switches are clear, paper evidence is linked when required, and all risk checks pass.
- Risk gates now run before any Binance order request and can block missing credentials, provider unavailable, non-allowlisted symbols, stale data, max order notional, max daily turnover, max position weight, insufficient balance/cash, duplicate client order ids, global kill switch, and per-strategy kill switch.
- Extended `BinanceProvider` with a protected private order adapter method, but tests and packaged smoke do not place real Binance orders; successful submit coverage uses a mock provider and records sanitized broker response fields only.
- SQLite now persists Binance execution config, execution intents, kill-switch state, and audit events, with live order/fill/ledger payloads embedded in intent records for comparison with T35 paper sessions.
- Added Strategy Lab "Live Execution" desktop controls for execution config status, intent creation, risk-submit evidence, blocked checks, kill switch controls, recent intents, and audit trail while preserving the existing backtest and paper-only workflow.
- Added command palette entries for opening Binance execution status and audit context; no command palette action submits a live order.
- Added `backend/tests/test_execution_service.py` for default-off blocking before adapter calls, credentials/provider/stale/notional/daily-turnover/position-weight/balance/duplicate/allowlist/kill-switch risk blocks, eligible mock submit order/fill/ledger/audit persistence, paper-session linkage, and API config/intents/submit/audit/kill-switch flow.
- Added `scripts/packaged_binance_execution_smoke.ps1` plus `npm run smoke:binance-execution`; the packaged smoke verifies default-off config, blocked submit, no live order record, audit persistence, and restart restore.
- Captured the latest packaged Binance execution result in `logs/binance-execution-smoke-latest.json` with `health_ready=true`, `failures=[]`, `config_live_enabled=false`, `intent_id=intent-e78276e996f0`, `submit_status=blocked`, `blocked_checks=["live_mode","risk_acknowledgement"]`, `no_live_order_until_submit=true`, `live_order_recorded=false`, `audit_count_before_restart=2`, `audit_count_after_restart=2`, and `audit_restored_after_restart=true`.
- Revalidated `T36` with:
  - `py -m compileall backend`
  - `py -m unittest backend.tests.test_execution_service`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - PowerShell parser check for `scripts/packaged_binance_execution_smoke.ps1`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:binance-execution`
- No new blocker was discovered during `T36`; the next planned task is `T37 - Evidence-Backed Research And Execution Reports`, using the persisted T36 audit/ledger/report evidence while keeping live execution Binance-only and explicitly gated.

- Completed `T35 - Strategy Backtesting And Paper Trading`.
- Added additive backend strategy contracts in `backend/app/models.py`, `backend/app/services/strategy_service.py`, `backend/app/storage/duckdb_store.py`, `backend/app/storage/sqlite_store.py`, and `backend/app/api/routes.py` without changing the existing `/api/v1/assets/*`, `/api/v1/factors/*`, `/api/v1/research/*`, or `/api/v1/portfolio/*` response shapes.
- `StrategyService` now supports `GET /api/v1/strategies/templates`, `POST /api/v1/strategies/backtests`, `GET /api/v1/strategies/backtests/recent`, `GET /api/v1/strategies/backtests/{run_id}`, `POST /api/v1/strategies/paper/sessions`, `GET /api/v1/strategies/paper/sessions/recent`, `GET /api/v1/strategies/paper/sessions/{session_id}`, and `POST /api/v1/strategies/reports/{artifact_id}/export`.
- Implemented the first strategy template, `top_n_factor_rotation`, with `factorRunId`, `topN`, `rebalanceInterval`, `initialCapital`, `maxPositionWeight`, `cashReservePct`, `benchmarkSymbol`, `transactionCostBps`, and `slippageBps`.
- Backtest v1 uses saved Factor Lab rankings as snapshot-ranked historical simulation evidence, records survivorship/snapshot/stale-history warnings, and stores full run payloads in DuckDB `strategy_backtest_snapshots`.
- Paper trading is local-only and records simulated orders, fills, positions, cash ledger entries, PnL, drawdown, and rule decisions in SQLite strategy paper tables; all execution artifacts carry `paper` / simulated / no-live-order evidence.
- Added `src/views/strategy-lab-view.tsx`, Strategy Lab navigation/settings support, API typings, app-store state, and a Factor Lab handoff button so the desktop can move from factor snapshot to backtest to paper session to Markdown report.
- Added `backend/tests/test_strategy_service.py` for strategy template/API flow, backtest persistence, report export, paper orders/fills/ledger, and no-live-order assertions.
- Added `scripts/packaged_strategy_lab_smoke.ps1` plus `npm run smoke:strategy-lab`; the packaged smoke starts the release EXE, creates a factor run, creates a strategy backtest, restarts the desktop, reloads the backtest, starts a paper session, verifies ledger evidence, and exports a paper report.
- Captured the latest packaged Strategy Lab result in `logs/strategy-lab-smoke-latest.json` with `health_ready=true`, `failures=[]`, `factor_run_id=factor-d567dc44ae18`, `backtest_run_id=strategy-c87ff2ff1b09`, `backtest_restored_after_restart=true`, `equity_curve_count=64`, `trade_count=5`, `position_count=5`, `warning_count=3`, `no_live_orders=true`, `paper_session_id=paper-27aa50c9b0ac`, `paper_order_count=5`, `paper_fill_count=5`, `paper_ledger_count=6`, `paper_no_live_orders=true`, and `export_exists=true`.
- Revalidated `T35` with:
  - `py -m compileall backend`
  - `py -m unittest backend.tests.test_strategy_service`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - PowerShell parser check for `scripts/packaged_strategy_lab_smoke.ps1`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:strategy-lab`
  - `npm run smoke:factor-lab`
  - `npm run smoke:portfolio-offline`
- No new blocker was discovered during `T35`; no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T36 - Automated Binance Execution And Risk Controls`, because strategy backtesting and paper trading are now package-smoke validated and live execution must remain Binance-only, risk-gated, and explicit-user-configured.

- Completed `T34 - Local Factor Research Lab`.
- Added additive backend factor contracts in `backend/app/models.py`, `backend/app/services/factor_service.py`, `backend/app/storage/duckdb_store.py`, and `backend/app/api/routes.py` without changing the existing `/api/v1/assets/*`, `/api/v1/screeners/*`, `/api/v1/research/*`, or `/api/v1/portfolio/*` response shapes.
- `FactorService` now supports `GET /api/v1/factors/families`, `POST /api/v1/factors/runs`, `GET /api/v1/factors/runs/recent`, and `GET /api/v1/factors/runs/{run_id}` for controlled local equity research across `catalog` or `expanded` universes; this research scope does not imply equity live trading.
- First-release factor families are implemented as research-only signals: `momentum_12_1`, `value`, `quality_profitability`, `conservative_growth`, `low_volatility_risk`, and `composite`, with contribution-level evidence and missing-data reasons rather than silent scores.
- Added DuckDB-backed `factor_snapshots` persistence so factor run payloads, source timestamps, diagnostics, ranked rows, score history, and missing-data notes survive packaged desktop restarts.
- Added `src/views/factor-lab-view.tsx`, Factor Lab navigation/settings support, API typings, and app-store state so the desktop can run factor research, open recent snapshots, inspect contributions, view chart context, and hand off a ranked row into Research.
- Extended research brief creation with optional `factorRunId`; saved briefs and Markdown exports now include factor context, contribution evidence, missing inputs, and an explicit research-only/no-order-placement statement.
- Added `backend/tests/test_factor_service.py` for factor ranking, persistence, API coverage, research handoff, and Markdown export coverage.
- Added `scripts/packaged_factor_lab_smoke.ps1` plus `npm run smoke:factor-lab`; the packaged smoke starts the real release EXE, runs a composite factor snapshot, restarts the desktop, reloads the run, creates a factor-backed research brief, and verifies Markdown export.
- Captured the latest packaged Factor Lab result in `logs/factor-lab-smoke-latest.json` with `health_ready=true`, `failures=[]`, `evaluated_count=10`, `result_count=10`, `ranked_count=10`, `selected_symbol=AAPL`, `selected_rank=3`, `selected_percentile=80.0`, `selected_bucket=leader`, `selected_score=84.5`, `selected_contribution_count=5`, `restored_after_restart=true`, `research_factor_context=true`, and `export_exists=true`.
- Revalidated `T34` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - PowerShell parser check for `scripts/packaged_factor_lab_smoke.ps1`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:factor-lab`
- No new blocker was discovered during `T34`; no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T35 - Strategy Backtesting And Paper Trading`, because local factor evidence is now package-smoke validated and the next roadmap gap is converting factor outputs into explicit simulated strategy rules before any Binance live execution work.

- Completed `T33 - Portfolio Analytics And Professional Charting`.
- Added additive backend analytics models to `backend/app/models.py` and `backend/app/services/portfolio_service.py` without breaking the existing `/api/v1/portfolio/summary` fields: `performance`, `benchmarks`, holdings, transactions, and offline/cached/unavailable semantics remain compatible.
- `PortfolioService` now returns `analytics.windows` for `Today`, `MTD`, `YTD`, `1Y`, and `Max`, including total return, maximum drawdown, annualized volatility, Sharpe-style risk-adjusted return, benchmark return, and benchmark-relative return when enough data exists.
- Added average-cost realized/unrealized PnL plus allocation breakdowns by asset, asset class, currency, market, and sector/`Unknown`, with unavailable valuations excluded explicitly rather than hidden.
- Reworked `src/views/portfolio-view.tsx` into a denser professional portfolio workspace with a window segmented control, risk metric strip, allocation tabs, PnL strip, preserved transaction CRUD, preserved `portfolio-*` automation anchors, and repaired Portfolio visible mojibake.
- Added `lightweight-charts` and a reusable `ProfessionalChartPanel` in `src/components/shared.tsx`; the existing SVG `ChartPanel` remains available as the fallback for empty/degraded chart data.
- Extended `scripts/packaged_portfolio_offline_smoke.ps1` so the packaged online, offline-with-cache, and offline-cold-cache scenarios assert that `analytics` exists and uses the `average_cost` PnL method.
- Hardened `scripts/packaged_portfolio_ui_signoff.ps1` to wait on stable ASCII `portfolio-view state=*` and `portfolio-status-pill state=*` markers instead of the old visible heading copy, so future copy edits do not break the signoff loop.
- Captured the latest packaged portfolio offline result in `logs/portfolio-offline-smoke-latest.json` with `health_ready=true`, `failures=[]`, `analytics_windows_count=5`, `analytics_pnl_method=average_cost`, online `AAPL` valuation `live`, offline-with-cache valuation `cached`, and offline-cold-cache valuation `unavailable` with `missing_symbols=["AAPL"]`.
- Captured the latest packaged portfolio UI result in `logs/portfolio-ui-signoff-latest.json` with `health_ready=true`, `failures=[]`, ready `portfolio-view state=ready`, cached/unavailable `portfolio-view state=degraded`, stable holding markers, and enabled transaction-submit markers across all three scenarios.
- Revalidated `T33` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:portfolio-offline`
  - `npm run smoke:portfolio-ui-signoff`
- No new blocker was discovered during `T33`; no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T34 - Local Factor Research Lab`, because portfolio analytics and charting are now package-smoke validated and the next roadmap gap is local factor evidence rather than Binance live execution.

- Completed `T32 - Desktop WebView Credential Input Automation Adapter` and closed the remaining `T31 - Credential Workflow And Crypto Capability Smoke Hardening` acceptance gap.
- Updated `src/views/connections-view.tsx` so the EDGAR identity field is ref-first and automation-safe: packaged WebView input can populate the real field, and the existing `connection-save provider=edgar` button still routes through the normal Tauri Stronghold save path.
- Fixed `src-tauri/src/lib.rs` Stronghold snapshot handling by loading the persisted client state before creating a new client, so saved EDGAR identities are immediately readable and are injected into the restarted sidecar without environment-variable fallback.
- Hardened `scripts/packaged_provider_capability_signoff.ps1` with credential-env isolation, clipboard-backed WebView input, keyboard/mouse activation fallback, typed staged JSON capture, and additive `credential_input_adapter` evidence without logging credential values.
- Captured the latest packaged provider-capability result in `logs/provider-capability-signoff-latest.json` with `health_ready=true`, `failures=[]`, `credential_input_adapter.value_verified=true`, baseline EDGAR filings `credential_required`, after-save and post-restart EDGAR filings `available`, after-clear EDGAR filings `credential_required`, and `BTC/USDT` fundamentals/filings `unsupported`.
- Revalidated T31/T32 with:
  - PowerShell parser check for `scripts/packaged_provider_capability_signoff.ps1`
  - `npm run typecheck`
  - `npm run build`
  - `cargo check --manifest-path src-tauri/Cargo.toml`
  - `npm run tauri:build`
  - `npm run smoke:provider-capability-signoff`
- No new blocker was discovered during T32; no new follow-up task was added from this pass.

- Started `T31 - Credential Workflow And Crypto Capability Smoke Hardening`.
- Reworked `scripts/packaged_provider_capability_signoff.ps1` so the packaged capability smoke now records richer per-stage detail, attempts the EDGAR save/clear flow through the real desktop credential controls, captures post-restart persistence evidence in the same JSON artifact, and switches the unsupported sample from `SPY` back to `BTC/USDT` with `quote_state=temporarily_unavailable` tolerance when packaged Binance quote fetches flap.
- Preserved `logs/provider-capability-signoff-latest.json` as the single artifact path and extended the staged payload shape instead of introducing a second provider smoke format.
- Revalidated the updated smoke entrypoint with:
  - PowerShell parser check for `scripts/packaged_provider_capability_signoff.ps1`
  - `npm run smoke:provider-capability-signoff`
- The full `T31` smoke is still red today because the packaged Tauri WebView does not reliably propagate the current UIAutomation value-writing path into the React-controlled EDGAR identity input, so the `connection-save provider=edgar` action never reaches a persisted `available` state during the fully automated desktop-only pass.
- Added a new follow-up task, `T32 - Desktop WebView Credential Input Automation Adapter`, because the remaining gap is no longer provider semantics or crypto unsupported-state coverage; it is a desktop automation bridge for WebView text input so the real Stronghold-backed credential form can be driven deterministically.
- Advanced the recommended next task to `T32 - Desktop WebView Credential Input Automation Adapter`, then return to finish and close `T31`.

- Completed `T30 - Provider Capability Packaged Signoff`.
- Added stable ASCII automation anchors in `src/views/connections-view.tsx` for provider cards, capability rows, and credential actions, plus additive watchlist and asset/research capability anchors in `src/App.tsx`, `src/views/asset-view.tsx`, and `src/views/research-view.tsx`.
- Added `scripts/packaged_provider_capability_signoff.ps1` plus `npm run smoke:provider-capability-signoff` so packaged provider-capability behavior now has a repeatable release-signoff entry point alongside the earlier startup, portfolio, screener, and research smoke paths.
- Captured the latest packaged provider-capability result in `logs/provider-capability-signoff-latest.json` with `health_ready=true`, no failures, and staged packaged-runtime evidence for `baseline`, `after_identity_save`, and `after_identity_clear`.
- Revalidated `T30` with:
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:provider-capability-signoff`
- Added a new follow-up task, `T31 - Credential Workflow And Crypto Capability Smoke Hardening`, because the packaged signoff is now stable for connections plus AAPL/SPY capability transitions, but two harder edges remain: fully automating Stronghold-backed credential entry/clear flows through desktop UI controls, and restoring a stable crypto unsupported sample to the packaged smoke once the current Binance public-quote SSL failures stop making `BTC/USDT` regressions noisy.
- Advanced the recommended next task to `T31 - Credential Workflow And Crypto Capability Smoke Hardening`, because the provider-capability packaged regression loop now exists and the remaining gap is hardening the most fragile automation edges rather than adding another capability surface.

- Completed `T29 - Command Palette And Report Export`.
- Added `src/components/command-palette.tsx` as a global, keyboard-first command surface with `Ctrl/Cmd + K`, shared result filtering, arrow-key execution, and one reusable entry point for asset, research, screener, portfolio, provider-test, and export actions.
- Extended `src/store/app-store.ts` so the shared shell now owns command-palette visibility, latest command feedback, shared screener context (`selected preset / variant / universe`), and the latest screener run result instead of keeping those command-relevant selections trapped inside the screeners page.
- Reworked `src/views/screeners-view.tsx` to read and write the shared screener preset, variant, universe, and run-result state so command-triggered screener executions land in the same visible workspace state as in-page actions.
- Updated `src\App.tsx` and `src\styles.css` so the top bar now exposes a first-class command-palette launcher plus recent command feedback, while the shared shell renders the palette overlay without disturbing the existing one-active-workspace layout.
- Reused the existing runtime actions rather than adding new backend routes: asset open still flows through the asset workspace, research open/export still flows through `/api/v1/research/*`, provider tests still flow through the shared connection test path, and portfolio draft handoff still flows through the existing form-prefill store contract.
- Revalidated `T29` with:
  - `npm run typecheck`
  - `npm run build`
- No new blocker was discovered during `T29`, so no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T30 - Provider Capability Packaged Signoff`, because the shared command layer is now build-valid and the remaining open gap on the roadmap is packaged-shell confirmation of the newer capability-driven desktop behavior.

- Completed `T28 - Provider Capability Catalog`.
- Added a shared `backend/app/services/capability_service.py` layer that now owns provider capability declarations for `quotes`, `history`, `fundamentals`, `filings`, `account`, `screeners`, and `research` across `market`, `fundamentals`, `edgar`, and `binance`.
- Added additive backend contracts in `backend/app/models.py` and `backend/app/api/routes.py`, including `ProviderCapability`, `ProviderCapabilityProviderItem`, `ConnectionsCatalogResponse`, and `GET /api/v1/connections/catalog`, without changing the existing `/api/v1/connections/status` or `/api/v1/assets/*` route set.
- Reworked `backend/app/services/asset_service.py` so fundamentals and filings availability is now derived from shared applicability rules instead of ad hoc `is_us_equity` / `is_configured` checks, while preserving the existing `AssetWorkspaceResponse.capabilities` shape through additive status/message fields.
- Updated `backend/app/analysis/modules.py` and `src/views/research-view.tsx` so research summaries and module fallbacks now reuse the same capability-derived unsupported, credential-required, and temporarily-unavailable explanations that the asset view consumes.
- Rebuilt `src/views/connections-view.tsx` to show provider health plus a capability matrix on the same cards, and rebuilt `src/views/asset-view.tsx` so fundamentals and filings sections render explicit `available / credential_required / unsupported / temporarily_unavailable` states instead of collapsing everything into generic missing-data copy.
- Added `backend/tests/test_capability_service.py` and extended `backend/tests/test_research_service.py` so the new catalog mapping, asset applicability states, API response shape, and additive research snapshot fields are now covered by backend tests.
- Revalidated `T28` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
- Added a new follow-up task, `T30 - Provider Capability Packaged Signoff`, because `T28` now changes visible connections, asset, and research-shell behavior but this pass only revalidated the shared backend and web-build contract rather than the packaged desktop lifecycle.
- Advanced the recommended next task to `T29 - Command Palette And Report Export`, because the new capability catalog is now reusable and the next highest-value gap is cross-workspace execution rather than more provider semantics work.

- Completed `T27 - Analysis Module Registry`.
- Added a new `backend/app/analysis/` layer with `AnalysisModuleRegistry`, a shared analysis result envelope, and four built-in modules: `asset_quality_snapshot`, `filings_brief`, `screener_match_explainer`, and `portfolio_risk_snapshot`.
- Reworked `backend/app/services/research_service.py` so research briefs now assemble `analysis_modules` through the registry instead of keeping richer analysis composition hard-coded in the service and view.
- Extended the `ResearchBrief` contract with additive `analysis_modules` output while keeping `/api/v1/assets/*`, `/api/v1/screeners/*`, and `/api/v1/portfolio/*` payload shapes unchanged.
- Added `src/components/analysis-cards.tsx` plus shared styles so `src/views/research-view.tsx` now renders structured analysis cards through one deterministic frontend path instead of per-module ad hoc TSX.
- Expanded backend coverage with `backend/tests/test_analysis_registry.py` and extended `backend/tests/test_research_service.py` so registry resolution, module envelopes, API responses, and Markdown export all cover the new analysis contract.
- Enhanced `scripts/packaged_research_workspace_smoke.ps1` so the packaged research signoff now asserts `analysis_module_count=4`, validates the expected module keys, and checks that exported Markdown includes the `## Analysis Modules` section.
- Captured the latest packaged research result in `logs/research-workspace-smoke-latest.json` with:
  - `health_ready=true` against the packaged desktop runtime
  - created `brief-6e2d9c8aac4c` for `AAPL`
  - `analysis_module_count=4`
  - `analysis_module_keys=["asset_quality_snapshot","filings_brief","screener_match_explainer","portfolio_risk_snapshot"]`
  - notes saved before restart and restored after relaunch
  - Markdown export written to `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench\diagnostics\reports\research-aapl-8aac4c.md`
- Revalidated `T27` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:research-workspace`
- No new blocker was discovered during `T27`, so no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T28 - Provider Capability Catalog`, because research analysis composition is now reusable and the next highest-value gap is surfacing provider support and unsupported-state semantics across research, asset, and connections surfaces.

- Completed `T26 - Research Workspace`.
- Added a first-class `research` workspace to the desktop shell, app store, and settings preferences so research is no longer split across dashboard, asset, screener, and portfolio surfaces.
- Added `/api/v1/research/*` endpoints plus a new `research_service` that composes asset context, screener matches, portfolio state, saved notes, and local Markdown export into durable research briefs.
- Added SQLite-backed `research_briefs` persistence so brief snapshots, user-authored notes, and export metadata survive desktop relaunches.
- Built a three-column research workflow in `src/views/research-view.tsx` for asset search and recent briefs, brief context, and notes plus watchlist plus portfolio handoff plus export actions.
- Wired screener-to-research and research-to-portfolio handoff flows so a screener result can open a source-tagged research brief and a research brief can prefill the portfolio transaction form.
- Added `scripts/packaged_research_workspace_smoke.ps1` plus `npm run smoke:research-workspace` so the packaged research lifecycle now has a repeatable release-signoff entry point.
- Captured the latest packaged research result in `logs/research-workspace-smoke-latest.json` with:
  - `health_ready=true` against the packaged desktop runtime
  - created `brief-a735821c40c8` for `AAPL`
  - notes saved before restart and restored after relaunch
  - Markdown export written to `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench\diagnostics\reports\research-aapl-1c40c8.md`
- Revalidated `T26` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:research-workspace`
- No new blocker was discovered during `T26`, so no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T27 - Analysis Module Registry`, because the durable research workspace now exists and the next highest-value gap is reusable structured analysis composition instead of more shell scaffolding.

- Completed `T25 - Screener Variant Packaged Signoff`.
- Added `scripts/packaged_screener_variant_signoff.ps1` plus `npm run smoke:screener-variant-signoff` so the packaged screener-variant lifecycle now has a repeatable release-signoff entry point.
- Added minimal ASCII automation anchors in `src/views/screeners-view.tsx` for preset state, variant state, summary-list evidence, and run attribution, without widening the current `/api/v1/screeners/*` contract.
- Captured the latest packaged screener signoff result in `logs/screener-variant-signoff-latest.json` with:
  - `initial_run` showing `custom-b61133ad` active/selected, summary markers present, and `screener-run-attribution preset=quality-equities variant=custom-b61133ad universe=expanded`
  - `after_restart` restoring the same custom variant, summary markers, and packaged run attribution after a full desktop relaunch
  - `after_delete` falling back to `default`, restoring system-default summary markers, and API run attribution returning `variant_key=default`
- Revalidated `T25` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run tauri:build`
  - `npm run smoke:screener-variant-signoff`
- No new blocker was discovered during `T25`, so no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T26 - Research Workspace`, because packaged screener persistence, relaunch restore, and system-default fallback are now release-signed off.

- Completed `T24 - Screener Configurable Profiles`.
- Added SQLite-backed `screener_preset_variants` persistence so every preset now seeds a read-only system default variant and supports additional user-defined variants with activation state, per-variant last-hit tracking, and preset-local unique names.
- Reworked `backend/app/services/screener_service.py` into a `baseline scorer + controlled tuning mapping` flow for all four presets, keeping the existing `/api/v1/screeners/*` contract stable while adding optional `variantKey`, active-variant fallback, variant-aware hit-count tracking, and generated filter summaries instead of free-form rule text.
- Added variant management endpoints without breaking the existing preset/run routes:
  - `GET /api/v1/screeners/presets/{preset_key}/variants`
  - `POST /api/v1/screeners/presets/{preset_key}/variants`
  - `PUT /api/v1/screeners/presets/{preset_key}/variants/{variant_key}`
  - `POST /api/v1/screeners/presets/{preset_key}/variants/{variant_key}/activate`
  - `DELETE /api/v1/screeners/presets/{preset_key}/variants/{variant_key}`
- Rebuilt `src/views/screeners-view.tsx` into a `preset -> variant -> tuning/result` workflow:
  - left column preset selection
  - middle column variant switching plus `save as custom` creation
  - right column controlled tuning controls, generated summary copy, activation, delete, and run actions
- Removed the old free-form preset filter editing workflow from the desktop screener surface so user changes now stay inside the bounded variant/tuning model rather than drifting into a fragile DSL.
- Expanded `backend/tests/test_screener_service.py` to cover default variant seeding, variant CRUD and activation rules, system-default delete protection, variant-key run behavior, and API coverage for the new variant endpoints.
- Revalidated `T24` with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
- Added a new follow-up task, `T25 - Screener Variant Packaged Signoff`, because `T24` now locks the local persistence and web-build contract, but the packaged desktop still lacks a repeatable signoff flow for custom variant persistence, relaunch restore, and visible active-variant state.
- Advanced the recommended next task to `T25 - Screener Variant Packaged Signoff`, because the next highest-value gap is packaged-shell confirmation that user-created screener variants survive real desktop relaunches and remain clearly attributable in the UI.

- Completed `T14 - Screener Quality Expansion`.
- Expanded the screener contract without changing `/api/v1/screeners/*` routes:
  - added `catalog | expanded` universe selection
  - added result-level `score`, `score_label`, and `explanations`
  - added run-level `evaluated_count` and `universe_label`
- Added a repo-managed controlled expansion universe in `backend/app/data_seed.py` for:
  - large-cap equities and ETFs such as `MSFT`, `GOOGL`, `META`, `AMZN`, `COST`, `LLY`, `SPY`, and `QQQ`
  - major Binance pairs such as `ETH/USDT`, `BNB/USDT`, `SOL/USDT`, `XRP/USDT`, `LINK/USDT`, and `DOGE/USDT`
- Reworked `backend/app/services/screener_service.py` from boolean preset hits into score-based preset profiles, while keeping preset copy in SQLite as display text instead of introducing a DSL.
- Upgraded `src/views/screeners-view.tsx` so the desktop UI now defaults to the expanded universe, surfaces run summary metrics, and renders ranked results with score bands, explanations, missing metrics, and metric highlights.
- Added `backend/tests/test_screener_service.py` to cover expanded-universe selection, score ordering, provider-failure fallback, and API validation for invalid `universeSource`.
- Revalidated the screener upgrade with:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
- Added a new follow-up task, `T24 - Screener Configurable Profiles`, because `T14` intentionally keeps preset `filters` as display-only copy; the next product step is to let users tune supported profile emphasis without opening a free-form DSL surface.
- Advanced the recommended next task to `T24 - Screener Configurable Profiles`, because the screener surface is now materially more useful and the next highest-value gap is constrained user-level profile tuning.

- Completed `T23 - NSIS Installed Startup Automation`.
- Refactored `scripts/installed_bundle_startup_smoke.ps1` into an installer-selectable installed-startup smoke entry point with `InstallerType=msi|nsis`, a dedicated NSIS bundle path, and per-installer default result files.
- Preserved `npm run smoke:installed-startup` for the existing MSI flow and added `npm run smoke:installed-startup:nsis` so the NSIS-installed path can be exercised without changing the established `T21` command.
- Re-ran the MSI-installed startup smoke after the refactor and confirmed `logs/installed-bundle-startup-smoke-latest.json` still records:
  - `install_exit_code=0`
  - `health_ready=true` in `12.84s`
  - `single_instance_ok=true`
  - `adopt_existing_ok=true`
  - `appdata_log_dir_ok=true`
  - `appdata_data_dir_ok=true`
- Captured the new NSIS-installed startup result in `logs/installed-bundle-startup-smoke-nsis-latest.json` with:
  - `install_exit_code=0`
  - `installed_exe_path=C:\Program Files\Pengbo Workbench\pengbo-workbench.exe`
  - `health_ready=true` in `12.31s`
  - `single_instance_ok=true`
  - `adopt_existing_ok=true`
  - `appdata_log_dir_ok=true` for `C:\Users\Laurence\AppData\Local\com.pengbo.workbench\logs`
  - `appdata_data_dir_ok=true` for `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench`
- No new NSIS-specific blocker was discovered during validation, so no extra follow-up task was added from this pass.
- Advanced the recommended next task to `T14 - Screener Quality Expansion`, because installer-level release-readiness automation is now closed across both bundle types.

- Completed `T20 - Residual Packaging Warning Trim`.
- Updated `scripts/build_sidecar.py` so the remaining `scipy.stats`, `scipy`, and `scipy.sparse` lines are classified as `accepted_packaging_noise` with explicit reasons instead of being left in `warning_categories.actionable`.
- Added `backend/tests/test_sidecar_build_report.py` so the packaged-warning classifier keeps treating the residual SciPy trio as documented accepted noise while still surfacing truly new runtime-affecting warnings as actionable.
- Rebuilt the sidecar through `npm run sidecar:build` and captured a new `logs/sidecar-build-latest.json` report with:
  - `warning_counts.actionable=0`
  - `warning_counts.accepted_packaging_noise=3`
  - the legacy `warning_summary` field preserved for compatibility, now pointing at the accepted SciPy residue because no actionable lines remain
- Revalidated the asset workspace contract with `AAPL` still returning overview data plus 6 ratios after the warning reclassification pass.
- Advanced the recommended next task to `T23 - NSIS Installed Startup Automation`, because the warning-cleanup acceptance is now closed and NSIS installer parity is the next remaining release-readiness gap.

- Completed `T18 - Localization Hardening`.
- Rewrote the remaining garbled checked-in desktop shell copy in `src/App.tsx`, `src/components/shared.tsx`, and the main user-facing views so navigation, onboarding, setup reminders, shared status chrome, and page-level headings no longer show mojibake.
- Localized the remaining portfolio-shell English in `src/views/portfolio-view.tsx`, preserving the existing ASCII automation anchors while converting visible status pills, empty/degraded guidance, transaction forms, holdings summaries, and history rows to Chinese-first copy.
- Normalized user-visible runtime/provider fallback messages in `src/lib/api.ts` and `src/lib/runtime.ts` so startup, offline, diagnostics, and credential-edit errors no longer surface garbled text.
- Revalidated the localized shell through `npm run typecheck` and `npm run build`.
- Advanced the recommended next task to `T20 - Residual Packaging Warning Trim`, because the most visible copy/encoding gap is now closed and the next remaining release-readiness item is the residual packaged-warning cleanup left after `T13`.

- Completed `T22 - Portfolio Packaged UI State Signoff`.
- Added `scripts/packaged_portfolio_ui_signoff.ps1` as the packaged portfolio UI signoff entry point and wired `npm run smoke:portfolio-ui-signoff` for repeatable local execution.
- The scripted T22 signoff now reuses the seeded packaged portfolio flow from `T19`, opens the packaged desktop shell, navigates to the portfolio workspace through stable UI automation anchors, and records visible portfolio-shell state for `ready`, `cached`, and `unavailable` scenarios.
- Added minimal automation-only UI anchors to the desktop shell:
  - a stable ASCII navigation label for the portfolio sidebar item
  - packaged portfolio status-pill markers
  - per-holding valuation markers
  - summary note markers
  - transaction-submit availability markers
- Captured the latest packaged UI signoff result in `logs/portfolio-ui-signoff-latest.json` with:
  - `ready` scenario showing `portfolio-status-pill state=live`, `AAPL` at `valuation_status=live`, and transaction submit remaining enabled
  - `cached` scenario showing `portfolio-status-pill state=degraded`, `AAPL` at `valuation_status=cached`, cache-degraded summary notes, and transaction submit remaining enabled
  - `unavailable` scenario showing `portfolio-status-pill state=degraded`, `AAPL` at `valuation_status=unavailable`, missing-valuation plus unavailable-benchmark notes, and transaction submit remaining enabled
- Advanced the recommended next task to `T18 - Localization Hardening`, because the packaged portfolio shell now has repeatable state signoff coverage and the highest remaining release-quality gap is source-level copy/encoding cleanup.

- Completed `T21 - Installed Bundle Startup Automation`.
- Added `scripts/installed_bundle_startup_smoke.ps1` as the MSI-installed startup smoke entry point and wired `npm run smoke:installed-startup` for repeatable local execution.
- The scripted T21 smoke now stages the MSI into an ASCII temp path, silently installs `src-tauri/target/release/bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi`, resolves the installed `pengbo-workbench.exe` and `pengbo-sidecar.exe`, and reuses the T17 startup assertions against the installed app lifecycle.
- Captured the latest installed startup result in `logs/installed-bundle-startup-smoke-latest.json` with:
  - `install_exit_code=0`
  - `installed_exe_path=C:\Program Files\Pengbo Workbench\pengbo-workbench.exe`
  - `health_ready=true` in `11.51s`
  - `single_instance_ok=true`
  - `adopt_existing_ok=true`
  - `appdata_log_dir_ok=true` for `C:\Users\Laurence\AppData\Local\com.pengbo.workbench\logs`
  - `appdata_data_dir_ok=true` for `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench`
- Added a new follow-up task, `T23 - NSIS Installed Startup Automation`, because `T21` now closes the MSI-installed lifecycle gap, but the NSIS-installed startup path is still not covered by a repeatable smoke script.
- Completed `T19 - Portfolio Offline Regression Automation`.
- Added `scripts/packaged_portfolio_offline_smoke.ps1` as the packaged portfolio offline smoke entry point and wired `npm run smoke:portfolio-offline` for repeatable local execution.
- The scripted T19 smoke now covers three seeded packaged portfolio contracts against `src-tauri/target/release/pengbo-workbench.exe` while backing up and restoring the live AppData-backed runtime data dir:
  - `online` seeds one `AAPL` transaction, warms quote/history cache, and verifies holdings plus summary stay live
  - `offline_with_cache` relaunches the packaged EXE behind an invalid proxy env, verifies holdings downgrade to `cached`, benchmarks downgrade to `cached`, and transaction updates still succeed
  - `offline_cold_cache` preserves the seeded SQLite transactions, clears the DuckDB cache, relaunches behind the invalid proxy env, and verifies `missing_symbols=["AAPL"]` plus benchmark `unavailable` semantics while transaction updates still succeed
- Captured the latest packaged portfolio result in `logs/portfolio-offline-smoke-latest.json` with:
  - `health_ready=true`
  - `online` holding `AAPL` at `valuation_status=live`
  - `offline_with_cache` holding `AAPL` at `valuation_status=cached`
  - `offline_cold_cache` holding `AAPL` at `valuation_status=unavailable`
  - `offline_cold_cache.missing_symbols=["AAPL"]`
- Added a new follow-up task, `T22 - Portfolio Packaged UI State Signoff`, because the new T19 smoke locks the API/runtime contract, but packaged-shell rendering of `ready` / `cached` / `unavailable` portfolio states is still only manually validated.
- Completed `T17 - Packaged Startup Regression Automation`.
- Added `scripts/packaged_startup_smoke.ps1` as the packaged startup smoke entry point and wired `npm run smoke:packaged-startup` for repeatable local execution.
- The scripted T17 smoke now covers three packaged startup contracts against `src-tauri/target/release/pengbo-workbench.exe`:
  - cold launch waits for `/health`, then verifies `/settings/runtime` and `/connections/status`
  - second launch keeps a single `pengbo-workbench` instance alive while the original runtime stays healthy
  - standalone-sidecar adoption confirms `adopted_existing=true` is appended to `sidecar-bootstrap.log` when `127.0.0.1:8765` is already healthy
- Captured the latest packaged startup result in `logs/packaged-startup-smoke-latest.json` with:
  - `health_ready=true` in `11.51s`
  - `single_instance_ok=true`
  - `adopt_existing_ok=true`
  - `bootstrap_log_path=C:\Users\Laurence\AppData\Local\com.pengbo.workbench\logs\sidecar-bootstrap.log`
- Added a new follow-up task, `T21 - Installed Bundle Startup Automation`, because the new T17 smoke currently validates the release EXE plus bundled sidecar path, but not a full MSI/NSIS-installed app lifecycle yet.
- Completed `T13 - Packaging Noise Reduction`.
- Replaced the asset fundamentals path that previously depended on `FinanceToolkit` with a lighter Yahoo-backed snapshot path while preserving the current overview/ratio response shape.
- Updated the desktop/provider labeling so fundamentals now surface as `Yahoo Fundamentals` instead of stale `FinanceToolkit` copy.
- Tightened the sidecar build whitelist by dropping explicit `financetoolkit` / `curl_cffi` hidden imports and excluding unused Qt bindings from the packaged desktop sidecar.
- Extended `logs/sidecar-build-latest.json` so warning output is now split into actionable warnings versus optional dependency noise while keeping the legacy `warning_summary` field intact.
- Rebuilt the packaged desktop app successfully after the T13 changes and verified the latest EXE/MSI/NSIS outputs.
- Compared against the previous packaged baseline:
  - sidecar size improved from `160,652,673 bytes` to `117,766,856 bytes`
  - sidecar build time improved from `74.84s` to `59.25s`
  - actionable warning summary dropped from a mixed 12-line noise-heavy list to 3 residual `pandas` / `SciPy` lines
- Completed a packaged cold-launch smoke against `src-tauri/target/release/pengbo-workbench.exe` after the T13 rebuild:
  - `/health` returned `ok` in `tauri` mode
  - `/connections/status` reported `Yahoo Fundamentals` with the expected ready message
  - `/api/v1/assets/AAPL/workspace` returned a live overview with `market_cap="$3.97T"` and 6 ratios
  - `/api/v1/portfolio/summary` still returned successfully after the packaging trim
- Added a new follow-up task, `T20 - Residual Packaging Warning Trim`, to track the remaining `pandas` / `SciPy` warning residue without reopening the now-complete T13 size target.
- Completed `T16 - Desktop Runtime Status Reconciliation`.
- Added `enabled` gating to shared async resources so desktop first-batch requests now wait until runtime/health are reconciled instead of firing against a half-booted sidecar.
- Added a unified desktop connection-state model (`connecting | online | offline`) so the top badge, setup reminder, and first-run messaging no longer treat a single startup miss as hard offline.
- Hardened desktop runtime discovery:
  - `get_runtime_config` now retries with a bounded budget before surfacing offline
  - Tauri fallback no longer regresses to relative `/api/v1`
  - the last resolved desktop base URL is preserved for retry/recovery flows
- Hardened `apiFetch` for desktop runtime recovery:
  - network failures are separated from HTTP errors
  - desktop mode refreshes runtime config and retries once before surfacing an error
  - raw `Failed to fetch` is replaced with sidecar-specific startup/offline messaging
- Gated the packaged `Connections` view so provider status and Binance balance fetches do not race the sidecar during startup.
- Extended Tauri bootstrap logging with runtime status transitions, resolved base URL, and `/health` probe outcomes to make packaged-only startup issues easier to diagnose.
- Rebuilt the packaged desktop app successfully with refreshed EXE plus MSI/NSIS bundles after the `T16` changes.
- Reproduced the remaining packaged `Connecting` incident and traced it to duplicate desktop launches racing the same DuckDB-backed sidecar.
- Added Tauri single-instance enforcement so a second launch focuses the existing window instead of spawning a competing desktop shell and bootstrap attempt.
- Reproduced a second packaged `offline` path caused by an already-running `8765` sidecar being left behind from an earlier desktop session.
- Updated startup/stop behavior so the desktop shell now adopts a healthy default-port sidecar on launch and uses process-tree termination when it owns the spawned sidecar, reducing orphan-process fallout.
- Re-ran the packaged EXE launch flow after the fix and verified the regression no longer reproduces at the process/log/API level.
- Localized the current user-facing desktop shell to Simplified Chinese across navigation, setup banners, shared status states, and the main dashboard / asset / connections / portfolio / screeners / settings surfaces.
- Switched visible number and timestamp formatting to `zh-CN` where the shell already formats values locally, and rebuilt the packaged desktop app with the Chinese UI copy.
- Added a new follow-up task, `T17 - Packaged Startup Regression Automation`, to turn this startup-health path into a repeatable smoke check.
- Reproduced a fresh packaged "program will not open" report and confirmed the EXE window existed while the shell stayed stuck in `connecting/loading`.
- Traced the new packaged startup regression to three issues acting together:
  - desktop startup retry logic in `App.tsx` kept reloading runtime/health too aggressively while first-boot health was still settling
  - the PyInstaller onefile launcher exited before the real FastAPI child, and Tauri treated that launcher exit as sidecar offline
  - FastAPI CORS still missed the Tauri 2 `http://tauri.localhost` / `https://tauri.localhost` origins, so WebView fetches could hit `/health` and still surface as inaccessible
- Tightened desktop startup retry behavior so runtime reloads only continue while the sidecar is not yet online, and otherwise health probes are allowed to settle normally.
- Added Rust-side reconciliation after child exit: if `/health` still succeeds, the runtime stays `online` instead of being dropped to offline because the onefile launcher process exited.
- Expanded packaged FastAPI CORS allow-origins for Tauri 2 localhost pages so `health`, `settings`, and `connections` responses are readable by the packaged WebView.
- Rebuilt the packaged desktop app after the fix and re-verified that the EXE can cold-start through to healthy local-service state instead of remaining stuck on `connecting`.
- Captured one new follow-up for `T18 - Localization Hardening`: some checked-in desktop shell strings still show mojibake and need source-level encoding cleanup, even though the packaged startup regression is now resolved.
- Started `T12 - Offline-First Portfolio Hardening`.
- Current implementation focus:
  - make portfolio summary/holdings resilient when live quote or history fetches fail without usable cache
  - keep transaction CRUD usable during cold offline / degraded runtime states
  - add explicit portfolio `connecting | empty | degraded | ready` rendering instead of surfacing generic fetch failures
- Implemented the first `T12` delivery slice:
  - `PortfolioService` now wraps quote/history access with portfolio-local fallback semantics so summary and holdings degrade instead of throwing when no cache is available
  - portfolio summary/holding payloads now expose `degraded`, `notes`, `missing_symbols`, `benchmark_status`, and per-holding `valuation_status`
  - `PortfolioView` now reuses the existing app-level runtime gate, defers portfolio fetches until `sidecarReady`, and falls back to manual symbol entry when watchlist options are unavailable
- Added a minimal backend regression test for `T12` covering:
  - no-cache quote/history failures degrade summary instead of raising
  - benchmark failure only degrades that benchmark and does not collapse the main portfolio curve
- Current `T12` static verification is passing:
  - `py -m compileall backend`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
- Tightened the portfolio-local quote/history wrappers again after packaged smoke exposed a remaining latency gap: cold offline portfolio requests now fail fast into cache/unavailable semantics instead of waiting for provider-level network timeouts.
- Rebuilt the packaged desktop app with the final `T12` sidecar changes and completed seeded packaged smoke against `src-tauri/target/release/pengbo-workbench.exe`:
  - online: one open `AAPL` position rendered, the portfolio remained usable, and only the `BTC/USDT` benchmark fell back to cache
  - offline with cache: holdings downgraded to `cached`, transactions remained editable/readable, and summary returned deterministic degraded notes instead of failing
  - offline with cold cache: holdings downgraded to `unavailable`, summary returned `missing_symbols=["AAPL"]`, both benchmarks went `unavailable`, and transactions still remained available
- Completed `T12 - Offline-First Portfolio Hardening`.
- Added a new follow-up task, `T19 - Portfolio Offline Regression Automation`, so the seeded online/cached/cold-cache portfolio smoke path becomes repeatable instead of manual.

## Recommended Next Task

### T102 - Component Library Base

Priority: P1
Status: Recommended

Why this is next:

- T98-T101 now provide stable tokens, navigation, shell regions, density modes, and persisted themes.
- The actual T100 shell still composes repeated buttons, inputs, badges, popovers, and sheet-like surfaces directly across workspace views.
- Extracting those primitives next reduces visual drift without changing business workflows.

Scope:

- Inventory repeated controls in the completed T100 shell and current workspace views before extracting them.
- Add typed Button, IconButton, Input, SearchField, SegmentedControl, Sheet, Popover, Tooltip, and Badge primitives.
- Migrate shell-level controls first while preserving every stable automation anchor and T101 theme/density behavior.

Acceptance:

- Primitive variants use T98 semantic tokens and remain legible in both T101 themes and density modes.
- T99 navigation, T100 shell behavior, keyboard focus, labels, and existing automation anchors remain unchanged.
- Migration is incremental and does not alter workspace business logic or API contracts.
- No secrets, runtime databases, generated logs, diagnostics, Stronghold vaults, installers, packaged binaries, hosted account promise, public API, remote sync, or new live-trading path are introduced.

Implementation notes:

- Recalibrate from the completed T100 component boundaries and T101 theme screenshots before editing.
- Keep packaged evidence source-safe. Do not commit secrets, logs, runtime databases, diagnostics bundles, Stronghold vaults, or generated desktop artifacts.

### T101 - Light Mode First Completion Evidence

- Completed 2026-07-07 after T100 CI passed.
- Added a backward-compatible `light | dark` preference to backend models, settings persistence, frontend API types, and Zustand state; missing values default to light.
- Bound theme selection to the T100 `AppShell` root through `data-theme` without remounting workspace content.
- Added a bilingual Settings selector with immediate preview and persistence through the existing preferences save path.
- Preserved T98 semantic theme maps and updated localization smoke ownership after T99/T100 moved density and navigation anchors into explicit components.
- Added `docs/light-mode-first-t101.md`, `scripts/theme_preference_check.mjs`, and `scripts/theme_preference_smoke.mjs`.
- Validation passed: 97 backend tests, zero-vulnerability audit, all static checks, typecheck, production build, localization/design-token/navigation/AppShell smokes, and the dedicated theme restart smoke.
- Visual evidence is source-safe and ignored under `logs/theme-preference-screenshots/`.
- Final desktop delivery passed on 2026-07-07: `npm run tauri:build` regenerated the release EXE plus a `125,286,271` byte MSI and `89,977,668` byte NSIS installer, and `npm run check:release-artifacts` accepted all three Windows artifacts.
- The NSIS installer returned exit code `0` and refreshed the user-level desktop shortcut to `C:\Users\Laurence\AppData\Local\Pengbo Workbench\pengbo-workbench.exe`. That exact installed app was opened and visually verified in its default light theme with the T99 grouped navigation, T100 four-region shell, and its bundled sidecar reporting `status=ok`, `runtime_mode=tauri`, and `online`. The broader installed-startup harness correctly encountered the existing local-security lock (`423`) when probing protected connection data, so no PIN was reset or bypassed. Installers, binaries, generated logs, and runtime state remain outside source control.

### T100 - AppShell Redesign Completion Evidence

- Completed 2026-07-07 after T99 CI passed.
- Added `AppShell`, `AppSidebar`, `AppToolbar`, and `ContextRail` components with explicit automation region markers.
- Reused `src/navigation.ts` directly inside `AppSidebar`; no route or navigation contract was duplicated.
- Kept App orchestration, page rendering, Command Palette, global search, runtime actions, and security gates behaviorally compatible.
- Added a collapsible 280px Context Rail with safe workspace/runtime/asset summaries and locked-context redaction.
- Added responsive fallbacks at 1180px and 960px while preserving a workspace wider than 600px at the 1280px desktop minimum.
- Added `docs/app-shell-t100.md`, `scripts/app_shell_check.mjs`, and `scripts/app_shell_smoke.mjs`.
- Validation passed: AppShell/navigation contracts, typecheck, and real-browser standard/compact shell smoke.
- Visual evidence is source-safe and ignored under `logs/app-shell-screenshots/`.

### T99 - Navigation IA Collapse Completion Evidence

- Completed 2026-07-07 as the navigation contract consumed by T100.
- Added `src/navigation.ts` with exactly seven groups and one-to-one coverage of all 14 existing `ViewKey` workspaces.
- Replaced the flat sidebar with accessible group disclosures while preserving all `nav-<ViewKey>` automation anchors.
- Multi-workspace groups use a single-open accordion; single-workspace groups navigate directly.
- Preserved Command Palette destinations, cross-workspace handoffs, sensitive-view membership, and unlock behavior.
- Added bilingual group labels, T98-token-based standard/compact styling, and reduced-motion-compatible disclosure affordances.
- Added `docs/navigation-ia-t99.md`, `scripts/navigation_ia_check.mjs`, and `scripts/navigation_ia_smoke.mjs`.
- Validation passed: zero-vulnerability audit, version/public-boundary/design-token/navigation/i18n checks, typecheck, build, and navigation smoke.
- Visual smoke evidence is source-safe and ignored under `logs/navigation-ia-screenshots/`.

### T98 - Design Tokens v1 Completion Evidence

- Completed 2026-07-07 as the implementation foundation for T99-T106.
- Replaced the runtime Google Fonts import with local/offline UI and financial-data font stacks.
- Added light-first semantic surfaces plus a complete `html[data-theme="dark"]` mapping while leaving persisted theme selection to T101.
- Added a 4px spacing rhythm, typography, radii, shadows, focus, motion, and reduced-motion tokens.
- Expanded `density-standard` and `density-compact` contracts for shell gaps, data rows, toolbars, cards, and future inspector panels.
- Added foreground/background/border triplets for observed, online, connecting, offline, cached, degraded, credential-required, blocked, audited, gain, loss, and neutral states.
- Added `docs/design-tokens-v1.md`, `scripts/design_tokens_check.mjs`, and `scripts/design_tokens_visual_smoke.mjs`.
- Validation passed: `npm run check:design-tokens`, `npm run typecheck`, `npm run web:build`, and `npm run smoke:design-tokens`.
- Visual evidence covers `light-standard`, `light-compact`, and `dark-standard` in `logs/design-tokens-screenshots/design-tokens-smoke-latest.json` with `failures=[]`.

### T96 - Figma Master Roadmap Completion Evidence

- Completed 2026-06-05 in the desktop Chrome Figma file at `https://www.figma.com/design/54nRRjH5vjNbrrP6pMZmyW/Untitled?node-id=12-178`.
- Added a source-safe 7800x1040 five-screen selected Figma `Frame` containing `00 Cover`, `01 Roadmap Overview`, `02 First Batch Detail: T96-T115`, `03 Execution Order`, and `04 Design Principles`.
- The roadmap frame maps T96-T195 across product, UI, AI, data, quant, workflows, release, safety, and commercial lanes, and preserves the explicit local-first/no-hosted-account/no-public-API/no-remote-sync/no-new-live-trading boundary.
- Evidence screenshot: `logs/t96-readable-cover-zoom-confirm.png`.
- Supporting source-safe artifacts: `docs/t96-figma-master-roadmap.md`, `docs/t96-master-roadmap-full.svg`, `docs/t96-master-roadmap.svg`, and `scripts/figma_t96_master_roadmap.js`.
- Note: the MCP-created Laurence-team file `https://www.figma.com/design/CIunCxsqTaNPGKcQO6wr8y` still returns the Figma Starter plan MCP tool-call limit, so the final populated roadmap lives in the desktop Chrome Figma file above.

### T97 - Figma UI System Completion Evidence

- Completed 2026-06-05 in the desktop Chrome Figma file at `https://www.figma.com/design/54nRRjH5vjNbrrP6pMZmyW/Untitled?node-id=14-2`.
- Added a source-safe 12380x1040 eight-section selected Figma `Frame` containing `00 T97 UI System`, `01 Product Shell`, `02 Navigation IA`, `03 Screen Templates`, `04 Component System`, `05 Table And Inspector`, `06 State System`, and `07 React Mapping`.
- The UI system board defines shell, navigation, workspace templates, component primitives, density expectations, operational states, and React mapping for T98-T106 while preserving the local-first/no-hosted-account/no-public-API/no-remote-sync/no-new-live-trading boundary.
- Evidence screenshot: `logs/t97-ui-system-readable-frame-confirm.png`.
- Supporting source-safe artifacts: `docs/t97-figma-ui-system.md`, `docs/t97-ui-system-board.svg`, and `scripts/figma_t97_ui_system.js`.

## Next Stage Master Task Pool

This pool is the selected T96-T195 backlog for the v0.1.0 to v1.0 product arc. It
should be promoted into executable implementation tasks in order, keeping each
slice locally verifiable and source-safe.

### M1 - UI Foundation: full redesign base (`T96-T106`)

- `T96 - Figma Master Roadmap`: Create a v0.1-to-v1.0 master roadmap page with product, UI, AI, data, quant, release, safety, and commercial lanes.
- `T97 - Figma UI System`: Create the Apple/macOS-style UI system board for shell, screens, components, states, and React mapping.
- `T98 - Design Tokens v1`: Define colors, typography, spacing, radius, shadow, status colors, gain/loss colors, and table density tokens.
- `T99 - Navigation IA Collapse`: Collapse navigation to Home, Research, Markets, Portfolio, Factor Lab, Automation, and Settings.
- `T100 - AppShell Redesign`: Implement the desktop shell with sidebar, toolbar, main workspace, and right inspector.
- `T101 - Light Mode First`: Make a clean light theme the default while preserving dark mode as a supported mode.
- `T102 - Component Library Base`: Extract Button, IconButton, Input, SearchField, SegmentedControl, Sheet, Popover, Tooltip, and Badge components.
- `T103 - DataTable Component`: Build the financial data table with fixed columns, sorting, filtering, stable widths, and virtual scrolling.
- `T104 - Inspector Panel`: Standardize the right-side panel for evidence, AI context, data status, exports, and parameters.
- `T105 - Chinese Empty States`: Add polished Chinese empty states, next-step copy, and clear calls to action across major surfaces.
- `T106 - Screenshot Baseline`: Add screenshot regression baselines for the redesigned shell and core pages.

### M2 - First Useful Loop: first research success path (`T107-T115`)

- `T107 - First Run Demo Flow`: Let a no-key user complete a sample research flow on first launch.
- `T108 - Home Dashboard Simplification`: Reframe Dashboard as the daily research entry point instead of an engineering status board.
- `T109 - Global Command Center`: Add command search for symbols, pinyin, page jumps, workflow starts, and AI actions.
- `T110 - Asset Cockpit v1`: Add an asset cockpit with data status, key facts, related research, and one-click brief creation.
- `T111 - Research Canvas v1`: Redesign Research into brief list, document canvas, evidence chain, and AI inspector.
- `T112 - Evidence Timeline`: Show provider, cache, freshness, audit, and workflow artifacts as a readable evidence timeline.
- `T113 - One Click Research Brief`: Create a research brief directly from Asset, Command Center, or Data Sources with context preview.
- `T114 - Export Report Polish`: Ensure reports include provenance, limitations, evidence boundaries, and AI-generation notes.
- `T115 - 10 Minute Success Test`: Validate that a new user can search, research, and export within ten minutes.

### M3 - AI Router: multi-model assistant system (`T116-T125`)

- `T116 - AI Provider Router Spec`: Define local, cloud, custom, budget, fallback, and model-use routing rules.
- `T117 - AI Control Redesign`: Redesign Dashboard AI Control as a visible provider-state and mode panel without in-app secret entry.
- `T118 - Local Model Runtime Probe v2`: Improve Ollama, MiMO, Hermes, and OpenAI-compatible endpoint probing.
- `T119 - Cloud Opt-in Sheet`: Show provider, model, context preview, estimated size, and risk confirmation before cloud submission.
- `T120 - AI Evidence Contract`: Require assistant output to cite allowed evidence or enter a blocked/limited state.
- `T121 - Multi-model Advisor Mode`: Let multiple configured models produce risk, counterargument, and missing-data reviews.
- `T122 - AI Cost Budget Guard`: Add budget, token estimate, request failure, and fallback UI for cloud providers.
- `T123 - Prompt Template Library`: Add templates for equity research, banking one-pagers, factor explanation, risk review, and provider limitations.
- `T124 - AI Eval Fixtures`: Test assistant behavior against fixed evidence packs for fabrication, citation, and boundary adherence.
- `T125 - AI Audit Trail`: Record provider, model, context hash, confirmation state, and output artifact without recording secrets.

### M4 - Data Depth: provider and market-data capability (`T126-T135`)

- `T126 - Data Sources Center Redesign`: Turn Data Sources into a provider health cockpit with status, freshness, samples, and limitations.
- `T127 - China Equity Provider v2`: Expand A-share quote, profile, daily basics, financial indicators, and classification coverage.
- `T128 - HK Market Data Expansion`: Improve Hong Kong equity and macro data coverage, cache behavior, and error states.
- `T129 - Macro Data Explorer`: Add a unified browser for FRED, World Bank, DBnomics, HKMA, and other macro series.
- `T130 - News And Events Lane`: Add read-only news, RSS, and event context with source and timestamp boundaries.
- `T131 - Provider Freshness UI`: Make live, cached, stale, credential-gated, unsupported, and unavailable states easy to understand.
- `T132 - DuckDB Performance Pass`: Optimize historical and factor-oriented local analytical queries.
- `T133 - Local File Import v1`: Import CSV and Excel files as local evidence-backed data sources.
- `T134 - Data Quality Score`: Score completeness, timeliness, source confidence, limitations, and sample coverage.
- `T135 - Data Source Report Export`: Export data-source status, freshness, quality, and limitations for audit and debugging.

### M5 - Research, Banking, and Equity Workflows (`T136-T145`)

- `T136 - Workflow Recipe Gallery`: Reframe Workflow Studio as a user-facing recipe gallery instead of a technical template list.
- `T137 - Screener To Research v2`: Convert screener results into research candidates and batch brief creation.
- `T138 - Data Sources To Research v2`: Route provider samples and source-health context into research briefs.
- `T139 - Public Equity Memo Template`: Add a public-equity memo covering business, financials, valuation, catalysts, risks, and evidence.
- `T140 - Investment Banking One-pager`: Add a company one-pager with business summary, transaction highlights, peers, and diligence prompts.
- `T141 - Peer Comparison Workflow`: Add peer set selection, comparison tables, and exportable analysis.
- `T142 - Due Diligence Checklist`: Generate diligence question lists from company, industry, data, and evidence context.
- `T143 - Batch Research Queue`: Queue multiple assets for research while keeping each output evidence-bound.
- `T144 - Research Review Mode`: Add AI-assisted counterargument, risk, and evidence-gap review for finished briefs.
- `T145 - Report Template Manager`: Manage reusable research, banking, macro, and risk report templates.

### M6 - Quant Factor Lab: factor discovery and backtesting (`T146-T165`)

- `T146 - Factor Lab IA And UI`: Add Factor Lab as a first-class module with project list, formula/workspace, charts, and inspector.
- `T147 - Factor Project Model`: Store factor projects with universe, date range, rebalance frequency, parameters, and artifacts.
- `T148 - Factor Definition Schema`: Define factor metadata, expression, inputs, transformations, provenance, and validation status.
- `T149 - Built-in Factor Library`: Add valuation, quality, growth, momentum, volatility, liquidity, and macro-sensitivity factors.
- `T150 - Factor Formula Parser`: Support safe custom formulas over approved local data columns and transformations.
- `T151 - Equity Universe Selector`: Add universe selection by market, industry, watchlist, imported file, and liquidity filters.
- `T152 - Factor Data Pipeline`: Compute, cache, version, and validate factor values with missing-value handling.
- `T153 - IC And Rank IC Engine`: Compute IC, Rank IC, ICIR, rolling IC, and sample coverage.
- `T154 - Quantile Return Analysis`: Compute quantile returns, long-short spreads, hit rate, turnover, and drawdown by bucket.
- `T155 - Single Factor Backtest`: Run single-factor portfolio backtests with configurable rebalance and weighting.
- `T156 - Multi-factor Score Model`: Combine factors through equal weight, z-score, rank score, and user-defined weights.
- `T157 - Transaction Cost Model`: Add fees, slippage, turnover cost, and cost sensitivity analysis.
- `T158 - Exposure Diagnostics`: Diagnose industry, size, style, liquidity, and market exposures.
- `T159 - Overfitting Checks`: Flag lookahead risk, survivorship risk, sample leakage, too-small samples, and unstable periods.
- `T160 - Factor Report Export`: Export factor definition, economics, data sources, diagnostics, backtest results, and limitations.
- `T161 - AI Factor Hypothesis Assistant`: Let AI propose explainable factor hypotheses and convert them into testable expressions.
- `T162 - Research To Factor Handoff`: Convert a research hypothesis into a candidate factor idea.
- `T163 - Factor To Backtest Handoff`: Send validated factor results into the backtest workflow.
- `T164 - Backtest To Paper Intent`: Convert backtest results to paper trade intent only, without automatic execution.
- `T165 - Factor Lab Screenshot Tests`: Add screenshot and numeric regression tests for Factor Lab outputs.

### M7 - Release Hardening: shipping and engineering stability (`T166-T175`)

- `T166 - Tauri Packaging Audit`: Audit EXE, MSI, NSIS, sidecar payload, generated resources, and version consistency.
- `T167 - Code Signing Plan`: Define Windows signing, artifact verification, and release trust steps.
- `T168 - Auto-update Channel Design`: Design stable and beta update channels without enabling remote sync by default.
- `T169 - Performance Budget`: Set budgets for startup, navigation, tables, AI preview, data refresh, and export.
- `T170 - Error Boundary And Recovery`: Standardize frontend, sidecar, provider, AI, and export error recovery states.
- `T171 - Local Runtime Diagnostics`: Generate local diagnostics that are redacted and exclude secrets and runtime databases by default.
- `T172 - CI Expansion`: Expand typecheck, backend tests, provider-contract tests, AI eval fixtures, and screenshot tests.
- `T173 - Release Checklist v2`: Update release checks for UI, AI, data, quant, security, packaging, and smoke evidence.
- `T174 - Documentation Sync`: Keep README, CHANGELOG, manual, security docs, and task board aligned with each shipped slice.
- `T175 - Packaged Smoke Test v2`: Add packaged smoke coverage for the redesigned shell, first-use loop, data, AI, and Factor Lab.

### M8 - Security And Compliance (`T176-T185`)

- `T176 - Secret Storage Review`: Reconfirm raw secrets stay out of SQLite, DuckDB, logs, screenshots, diagnostics, and exports.
- `T177 - Cloud Context Redaction`: Redact cloud-bound AI context and show the user exactly what is being sent.
- `T178 - Audit Event Viewer`: Add a UI for local audit events covering AI, exports, providers, Binance intent, and security actions.
- `T179 - Public Exposure Guard`: Keep the sidecar bound to loopback and block hosted/LAN/public API assumptions.
- `T180 - License And Redistribution Matrix`: Track provider licensing, redistribution risk, commercial risk, and read-only status.
- `T181 - Financial Advice Boundary Copy`: Add clear research-assistance and non-advice copy across UI and exports.
- `T182 - Screenshot Secret Scan`: Scan screenshot and visual artifacts for obvious secret, token, and private-path leakage.
- `T183 - Binance Safety UI`: Preserve read-only defaults, kill switch, risk gate, audit, and explicit user confirmation for Binance.
- `T184 - Security Smoke Evidence`: Produce repeatable packaged evidence for redaction, route locking, audit, and secret absence.
- `T185 - Private Deployment Boundary`: Define what must be true before any private deployment or team mode is considered.

### M9 - Commercialization and external proof (`T186-T195`)

- `T186 - User Segment Definition`: Define personal investor, advanced analyst, banking/research professional, and small-team segments.
- `T187 - Pricing Hypothesis`: Draft Pro Desktop, template pack, paid connector, and private-deployment pricing hypotheses.
- `T188 - Template Marketplace Seed`: Seed internal templates before building any external marketplace.
- `T189 - Private Deployment Playbook`: Draft local/private deployment instructions, update policy, and safety boundaries.
- `T190 - Demo Video Script`: Script a three-minute demo from no-key launch to evidence-backed report export.
- `T191 - README Product Proof`: Upgrade README with product screenshots, first-use flow, safety boundaries, and release links.
- `T192 - Landing Page Later`: Defer a public landing page while collecting the assets and copy needed for one.
- `T193 - Feedback Capture Loop`: Add issue templates and feedback categories for UI, data, AI, quant, install, and security feedback.
- `T194 - Early User Trial Plan`: Define who tests the product first, what they do, and what evidence is collected.
- `T195 - Commercial Risk Review`: Review data licensing, AI cost, support load, update risk, and maintenance burden.

### Execution order

1. First batch: `T96-T115` to land the redesign foundation and first useful research loop.
2. Second batch: `T116-T135` to deepen AI and data.
3. Third batch: `T146-T165` to make Factor Lab the second core product engine.
4. Fourth batch: `T136-T145` plus `T166-T175` to complete professional workflows and release hardening.
5. Fifth batch: `T176-T195` to prepare safety, compliance, commercialization, and external proof.

## Priority Order

### T53 - Local Unlock PIN And Idle Lock

Priority: P1
Status: Completed
Target Window: 2026-05-18 to 2026-05-31
Depends on: T52

Task:

- Add a local PIN or passphrase initialization flow for the desktop app.
- Gate sensitive surfaces behind unlock state: provider credentials, execution/risk settings, security audit views, and future account-sensitive workflows.
- Add idle timeout relock after inactivity and a clear locked UI state.
- Write redacted audit events for initialize, unlock, failed unlock, timeout, relock, and sensitive-surface access.
- Validate the packaged EXE for first launch, unlock, failed unlock, idle relock, restart restore, and audit evidence.

Done when:

- Sensitive surfaces cannot be opened before unlock.
- Failed unlock attempts have basic rate-limit or lockout protection.
- No raw secret, PIN, passphrase, or unlock material appears in SQLite, DuckDB, logs, diagnostics, screenshots, or exports.
- T54 is promoted as the next task after packaged signoff.

Completion:

- Added local security status, initialize, unlock, lock, idle-timeout, and touch endpoints backed by salted hash storage and redacted security audit events.
- Gated provider credential operations, Binance execution/risk routes, Binance execution audit, and global security audit behind local unlock.
- Added desktop shell unlock UI, idle relock, manual lock, Settings local-security audit visibility, and Tauri command-side unlock checks for credential save/clear/test.
- Packaged signoff passed in `logs/local-security-packaged-smoke-latest.json` with `locked_blocked_audit=true`, `failed_unlock_recorded=true`, `idle_relock_ok=true`, `restart_restore_ok=true`, `sqlite_plaintext_secret_found=false`, and `failures=[]`.

### T54 - Account-Scoped Provider Credential Model

Priority: P1
Status: Completed
Target Window: 2026-06-01 to 2026-06-14
Depends on: T53

Task:

- Introduce local account/profile ownership metadata for provider credentials without adding cloud accounts.
- Separate account labels, provider capability metadata, credential state, and raw secret storage.
- Migrate existing provider credential records into an account-scoped model while preserving `/api/v1/...` compatibility.
- Add UI affordances for selecting the active local profile and seeing credential readiness per provider.
- Extend audit events for credential create, update, rotate, disable, and provider-readiness checks.

Done when:

- A local user can understand which profile owns each provider credential.
- Existing provider workflows continue to work through compatibility APIs.
- Secret material remains in the existing Stronghold/secret bridge pattern.
- Packaged EXE validation covers migration, profile switching, provider readiness, and redacted audit output.

Completion:

- Added account-scoped local credential profiles in SQLite with automatic migration of existing `connection_profiles` rows into the default `local_default` profile.
- Preserved existing `/api/v1/connections/status`, `/catalog`, `/test`, and profile-clear compatibility while adding local profile list/create/select endpoints.
- Kept raw credential material in the Tauri Stronghold bridge with profile-scoped keys and default-profile fallback compatibility for existing secrets.
- Added Connections UI controls for selecting/creating a local profile and showing provider readiness ownership per provider card.
- Extended credential audit events with redacted local profile context.
- Packaged signoff passed in `logs/account-scoped-credentials-smoke-latest.json` with `default_profile_seen=true`, `profile_created=true`, `profile_switch_ok=true`, `readiness_profile_context_ok=true`, `redacted_audit_ok=true`, `sqlite_plaintext_secret_found=false`, and `failures=[]`.

### T55 - Future Public Auth And Session Layer

Priority: P1
Status: Completed (2026-05-19)
Target Window: 2026-06-15 to 2026-06-30
Depends on: T53, T54

Task:

- Define a future-ready identity/session model that can support public deployment later without turning the current app into a hosted service.
- Add local session concepts, session expiry, session-bound permissions, and audit coverage.
- Document which routes and surfaces are desktop-local only, which are account-sensitive, and which could later become remote-safe.
- Add tests for session creation, expiry, permission checks, and redacted session audit events.

Done when:

- The app has an explicit session boundary instead of ad hoc UI-only access checks.
- The implementation does not introduce OAuth, hosted accounts, remote sync, or public network exposure.
- T56 has a clear input map of routes, permissions, and risks to harden.

Completion notes:

- Added `AuthSessionService`, SQLite-backed `local_auth_sessions`, local session create/status/revoke APIs, session expiry handling, permission checks, and redacted session audit events.
- Added session permission gates for security audit reads, provider profile clearing, Binance account reads, Binance execution mutation/submit/kill-switch paths, and local report exports.
- Added `/api/v1/security/route-classification` for the T56 route exposure map.
- Updated the frontend API client to create and attach a local `X-Pengbo-Session` automatically for normal desktop API calls while preserving the T53 local unlock checks for credential and execution-sensitive surfaces.
- Validation passed: `py -m pytest backend\tests`, `npm run typecheck`, and `npm run build`.
- Follow-up UX repair: added local unlock PIN/passphrase change and reset flows so a packaged-smoke passphrase or forgotten PIN no longer traps the user. Reset clears only `local_security_state`; credentials, provider profiles, portfolio data, research records, and local databases are left intact.

### T56 - Public Exposure Gateway And Sidecar Hardening

Priority: P1
Status: Completed (2026-05-19)
Target Window: 2026-07-01 to 2026-07-14
Depends on: T53, T54, T55

Task:

- Harden the sidecar/API boundary for any future public exposure: bind address, CORS, CSRF posture, request validation, request logging, and rate-limit hooks.
- Produce a route-by-route exposure classification: local-only, authenticated local, future public candidate, and never-public.
- Add regression tests for unsafe origin rejection, invalid method handling, unauthenticated access denial, and redacted logs.
- Keep current desktop runtime local-first and do not create a public service or hosted deployment.

Done when:

- Sensitive routes are protected by explicit gateway/session checks.
- Public exposure risks are documented before any hosted mode is attempted.
- Packaged EXE validation proves the local app still starts and works with the hardened sidecar.
- T57+ product-trust roadmap can begin without weakening the security-accountability base.

Completion notes:

- Added `GatewayHardeningMiddleware` with loopback-only bind validation, centralized allowed origins, unsafe-origin rejection, invalid-method rejection, sensitive-prefix rate-limit hooks, and redacted gateway audit events.
- Kept the current runtime local-first: no OAuth, hosted accounts, remote sync, public service, multi-user semantics, or new live-trading path was introduced.
- Documented the public-exposure posture in `docs/public-exposure-gateway-t56.md`, including the CSRF stance, exposure classes, and T53/T54/T55 reconciliation.
- Added `backend/tests/test_gateway_hardening.py` and `scripts/packaged_gateway_hardening_smoke.ps1`.
- Packaged gateway signoff passed in `logs/gateway-hardening-packaged-smoke-latest.json` with `loopback_listener_only=true`, `unsafe_origin_rejected=true`, `invalid_method_rejected=true`, `sensitive_route_requires_session=true`, `allowed_origin_ok=true`, `redacted_gateway_audit_ok=true`, and `failures=[]`.
- Packaged startup signoff passed in `logs/packaged-startup-smoke-latest.json` with `health_ready=true`, `connections_status_ok=true`, `settings_runtime_ok=true`, `single_instance_ok=true`, `adopt_existing_ok=true`, `shutdown_sidecar_exited_ok=true`, and `failures=[]`.

### T57 - License And Open Source Boundary

Priority: P2
Status: Completed (2026-05-19)
Target Window: 2026-07-15 to 2026-07-17
Depends on: T56

Task:

- Choose the project license and add `LICENSE`.
- Document what is open-source, what remains local/private, and what must never be uploaded.
- Recheck repository files against the public-upload boundary.

Done when:

- A public reader can understand legal usage and source boundaries before installing or contributing.

Completion notes:

- Added `LICENSE` with Apache-2.0 terms and aligned `package.json` plus `src-tauri/Cargo.toml` license metadata to `Apache-2.0`.
- Updated README and public-boundary docs to distinguish checked-in source/docs from local runtime databases, Stronghold vaults, provider credentials, `.env*` files, diagnostics, generated smoke logs, generated sidecar payloads, installers, and packaged bundles.
- Updated `docs/SECURITY_ARCHITECTURE.md` so it no longer describes T53-T56 as deferred; it now records them as local-only protection layers while hosted/public mode remains deferred.
- Updated `docs/public-exposure-gateway-t56.md` to state that T57's open-source boundary does not reclassify any route as public.
- Validation passed: license metadata scan, public-boundary tracked-file scan, ignore coverage review, `git diff --check`, and `npm run typecheck`.
- No unresolved license/upload-boundary blocker was found.
- `npm audit --json` reported one existing moderate transitive `postcss < 8.5.10` advisory (`GHSA-qx2v-qp2m-jg93`); T58 resolved it by updating `postcss` to `8.5.14`.
- T58 is the next recommended task.

### T58 - Version Governance Cleanup

Priority: P2
Status: Completed (2026-05-19)
Target Window: 2026-07-18 to 2026-07-20
Depends on: T57

Task:

- Normalize app version, package version, sidecar version, and release notes naming.
- Add a lightweight changelog or release-history file.
- Make version evidence visible in app diagnostics.

Done when:

- Build artifacts, docs, diagnostics, and release notes report the same version story.

Completion notes:

- Added `backend/app/version.py` and exposed version metadata through `/api/v1/health` and `/api/v1/settings/runtime`.
- Added Settings runtime UI rows for app and sidecar versions.
- Added `scripts/check_version_consistency.mjs` and `npm run check:version` to enforce consistency across package, lockfile, Tauri, Cargo, and backend version metadata.
- Added `CHANGELOG.md` and replaced the garbled legacy `PLAN.md` with the current local-first product plan.
- Updated README and repository-upload readiness docs so version governance, changelog, and current plan are public entrypoints.
- Updated `postcss` to `8.5.14` in the lockfile and local install; `npm audit --json` now reports zero vulnerabilities.
- Validation passed: `npm run check:version`, `npm audit --json`, `npm run typecheck`, `py -m pytest backend\tests`, and `npm run build`.
- The frontend build still emits the existing large-chunk warning; it is not a T58 blocker because the production build succeeds.
- T59 is the next recommended task.

### T59 - GitHub Actions CI Baseline

Priority: P2
Status: Completed (2026-05-19)
Target Window: 2026-07-21 to 2026-07-24
Depends on: T58

Task:

- Add CI for typecheck, frontend build, backend unit checks, smoke scripts that can run without secrets, and public-boundary scans.
- Keep CI no-key and no-live-trading.
- Document which packaged tests remain local Windows-only.

Done when:

- A pull request can prove baseline quality without credentials or private runtime data.

Completion notes:

- Added `.github/workflows/ci.yml` with push, pull request, and manual dispatch triggers.
- Added `scripts/check_public_boundary.mjs` and `npm run check:public-boundary`.
- CI source checks run `npm ci --ignore-scripts`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, and `npm run build`.
- CI backend checks install Python 3.11 dependencies from `backend/requirements.txt` and run `python -m pytest backend/tests`.
- Documented the CI boundary in README, CHANGELOG, PLAN, and repository-upload readiness docs.
- Kept packaged EXE smoke, Tauri release builds, installer validation, signing, hosted update checks, provider credentials, and live trading out of T59.
- Local validation passed: `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, `py -m pytest backend\tests`, and `git diff --check`.
- The frontend build still emits the existing large-chunk warning; it is not a T59 blocker because the production build succeeds.
- Remote CI follow-up on 2026-05-20 fixed the first backend CI failure by adding the missing `pytest==8.4.2` test dependency to `backend/requirements.txt`. The workflow also opts into Node 24 action runtime with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to reduce the GitHub Actions Node.js 20 deprecation warning.
- Follow-up local validation passed: `py -m pip install -r backend/requirements.txt`, `py -m pytest backend/tests`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- Remote validation passed on GitHub Actions run #2 for commit `f83caf8`: `Backend unit tests` and `Frontend and source checks` both completed successfully.
- T60 is the next recommended task.

### T60 - Demo Mode And No-Key Startup

Priority: P1
Status: Completed (2026-05-20)
Target Window: 2026-07-25 to 2026-07-28
Depends on: T59

Task:

- Ensure first launch works without provider credentials.
- Add demo/sample states for key workflows so reviewers can inspect the product safely.
- Make credential-missing states useful rather than dead ends.

Done when:

- A new user can open the app, explore the main product flow, and understand what credentials would unlock.

Completion notes:

- Added `/api/v1/settings/demo-mode` with explicit sample surfaces, credential-gated surfaces, missing credential list, and safety-boundary notes.
- Added frontend no-key demo guidance on the dashboard plus sample-only Portfolio and Data Sources states for reviewers without provider credentials.
- Kept demo mode read-only and boundary-aware: Binance private account access remains blocked without local unlock/session/credentials, and missing provider limits remain visible.
- Added Vite dev origin allowance for `127.0.0.1:5173` and `localhost:5173` without relaxing loopback bind enforcement or unsafe-origin rejection.
- Added `npm run smoke:demo-no-key`, producing `logs/demo-no-key-smoke-latest.json` with `no_key_startup_ok=true`, `demo_mode_ok=true`, `dashboard_sample_ok=true`, `data_sources_missing_credentials_visible=true`, `portfolio_empty_sample_ok=true`, `private_account_blocked=true`, and `failures=[]`.
- Validation passed: `py -m pytest backend/tests`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, `npm run smoke:demo-no-key`, Playwright dashboard screenshot check, and `git diff --check`.
- T61 is the next recommended task.

### T61 - First Release Packaging

Priority: P1
Status: Completed
Target Window: 2026-07-29 to 2026-08-01
Depends on: T60

Task:

- Produce a signed or clearly documented local installer/build artifact.
- Add release checklist steps for Windows packaged validation.
- Record installer startup, no-key startup, demo-mode startup, and security-boundary evidence.

Done when:

- The first external reviewer can install and run Pengbo without source-build knowledge.

Completion notes:

- Refreshed local Windows artifacts with `npm run tauri:build`:
  - `src-tauri/target/release/pengbo-workbench.exe`
  - `src-tauri/target/release/bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi`
  - `src-tauri/target/release/bundle/nsis/Pengbo Workbench_0.1.0_x64-setup.exe`
- Added `docs/RELEASE_CHECKLIST.md` with the first-reviewer artifact paths, validation commands, unsigned/local status, and public-repo boundary.
- Fixed installed-bundle packaging after the first MSI smoke exposed `Failed to load Python DLL ... _internal\python311.dll`: removed the duplicate Tauri `externalBin` sidecar path and hardened installed smoke to resolve the onedir sidecar under `binaries\pengbo-sidecar`.
- MSI and NSIS installed smokes now assert `root_sidecar_absent_ok=true`, preventing the root `pengbo-sidecar.exe` regression from returning.
- Validation passed: `npm run tauri:build`, `npm run smoke:packaged-startup`, `npm run smoke:installed-startup`, and `npm run smoke:installed-startup:nsis`.
- No GitHub Release upload, signing, auto-update, hosted account, public network exposure, CI secret, or live-trading expansion was added.

### T62 - README Product Proof Upgrade

Priority: P2
Status: Completed
Target Window: 2026-08-02 to 2026-08-04
Depends on: T61

Task:

- Add real screenshots or verified packaged screenshots.
- Describe the user journey in practical product language: research, data status, evidence, portfolio, and audit boundaries.
- Link validation evidence without exposing local data.

Done when:

- The README shows a credible product, not only an engineering skeleton.

Completion notes:

- Added README product-proof narrative for a no-key reviewer: Dashboard, Research, Data Sources, Workflow Studio, and Manual/local-security boundaries.
- Added source-safe screenshots under `docs/product-screenshots/`: `dashboard.png`, `research.png`, `data-sources.png`, `workflow-studio.png`, and `manual-security.png`.
- Generated screenshots from a temporary no-secret runtime and excluded any screenshot containing local filesystem paths or credential material.
- Updated CHANGELOG and PLAN to mark T62 complete and promote T63.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.
- No runtime behavior, backend route, security model, credential storage, packaging config, GitHub Release flow, hosted account path, public exposure path, or live-trading path changed.

### T63 - Contributor Entry Kit

Priority: P2
Status: Completed
Target Window: 2026-08-05 to 2026-08-07
Depends on: T62

Task:

- Add contributor setup notes, issue labels or templates, code style expectations, and test expectations.
- Document safe contribution areas versus credential/execution-sensitive areas.
- Add a small "first issue" candidate list grounded in the current roadmap.

Done when:

- A contributor can start safely without asking for private keys, private data, or unclear runtime assumptions.

Completion notes:

- Added `CONTRIBUTING.md` with Windows-first local setup, source-level baseline checks, no-key demo validation, packaged-smoke boundaries, safe contribution areas, sensitive areas, PR expectations, and first-issue candidates.
- Added `.github/ISSUE_TEMPLATE/bug-report.md` and `.github/ISSUE_TEMPLATE/first-issue.md` with explicit no-secret, no-runtime-data, no-Stronghold, no-live-trading, no-hosted-support boundaries.
- Updated README, CHANGELOG, PLAN, and this task board to mark T63 complete and promote T64.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- No runtime behavior, backend route, security model, credential storage, packaging config, GitHub Release flow, hosted support path, public API path, signed-release path, or live-trading path changed.

### T64 - Research Flow Definition

Priority: P1
Status: Completed
Target Window: 2026-08-08 to 2026-08-11
Depends on: T63

Task:

- Define the core user flow: open asset, inspect data status, review thesis, compare evidence, export report, and record audit trail.
- Map existing pages and APIs to that flow.
- Identify dead ends, duplicate concepts, and missing handoffs.

Done when:

- The product has one primary research journey that the whole team can optimize around.

Completion notes:

- Added `docs/research-flow-definition.md` to define the primary journey from Dashboard/Asset/Data Sources into Research briefs, evidence comparison, thesis notes, local report export, and redacted audit handoffs.
- Mapped existing pages, frontend store context, APIs, workflow templates, exports, and audit surfaces to each research-loop step.
- Identified current dead ends around Asset-to-Research entry, data-status consistency, Research brief structure, report/evidence-pack alignment, audit guidance, and Data Sources-to-Research handoff visibility.
- Mapped follow-up work into T65, T66, T67, and T68.
- Updated README, CHANGELOG, PLAN, and this task board to mark T64 complete and promote T65.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, and `git diff --check`.
- No runtime behavior, backend route, security model, credential storage, packaging config, hosted support path, public API path, signed-release path, or live-trading path changed.

### T65 - Asset Page Research Entry Polish

Priority: P1
Status: Completed
Target Window: 2026-08-12 to 2026-08-16
Depends on: T64

Task:

- Make the asset/security page the practical starting point for research.
- Show price, provider freshness, portfolio exposure, thesis summary, recent evidence, and next actions.
- Reduce navigation friction from asset view to report/export.

Done when:

- A user can start from one ticker or symbol and complete a basic research loop without hunting through unrelated pages.

Completion notes:

- Added an additive Asset page research-entry panel for the selected symbol.
- Shows local data state, portfolio exposure, and related Research brief state without adding backend contracts.
- Added direct actions to open or create the Research brief, review evidence, prepare a report, and check Data Sources.
- Added stable automation anchors for `asset-research-entry`, `asset-open-research`, `asset-data-status`, and `asset-next-action`.
- Updated `docs/research-flow-definition.md`, README, CHANGELOG, PLAN, and this task board to mark T65 complete and promote T66.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.
- No backend route, Research API contract, credential storage, Stronghold behavior, local-security/session/gateway model, packaging config, hosted support path, public API path, signed-release path, or live-trading path changed.

### T66 - Data Status Strip Everywhere

Priority: P1
Status: Completed
Target Window: 2026-08-17 to 2026-08-21
Depends on: T65

Task:

- Add a consistent data-status strip to research-critical views.
- Show provider, freshness, read-only/trading capability, missing credential reason, and degradation state.
- Keep wording cautious: observed, cached, simulated, degraded, blocked, audited.

Done when:

- Every research decision surface explains where its data came from and whether it is fresh enough.

Completion notes:

- Added a shared `DataStatusStrip` frontend component for compact provider, freshness, credential, degraded/cache, read-only, live-trading boundary, and audit/evidence status.
- Replaced the Asset research-entry status summary with the shared strip while preserving T65 anchors.
- Added a Research `research-data-status` strip that summarizes provider, stale/cache state, credential-required coverage, degraded coverage, and evidence/audit note count.
- Reworked the Data Sources provider status panel to use the same strip with provider health, credential setup, freshness/cache state, read-only state, and live-trading boundary.
- Updated `docs/research-flow-definition.md`, README, CHANGELOG, PLAN, and this task board to mark T66 complete and promote T67.
- Validation passed: `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.
- No backend route, provider data model, Research API contract, credential storage, Stronghold behavior, local-security/session/gateway model, packaging config, hosted support path, public API path, signed-release path, or live-trading path changed.

### T67 - Research Brief Quality Upgrade

Priority: P1
Status: Completed
Target Window: 2026-08-22 to 2026-08-28
Depends on: T66

Task:

- Upgrade briefs from summary text into structured thesis, evidence, counter-evidence, risks, watch items, and source provenance.
- Add brief templates for equity, crypto, portfolio, and macro use cases.
- Make unsupported or stale evidence explicit.

Done when:

- A brief reads like a cautious analyst note and never implies certainty without evidence.

Completion:

- Added an additive `decision_review` brief payload that preserves existing Research routes while adding a reusable review structure.
- Added equity, crypto, portfolio, and macro template selection from current asset, portfolio, and source context.
- Rendered the review in the Research workspace and Markdown export with thesis, assumptions, supporting evidence, counter-evidence, risks, watch items, provenance, and conclusion boundary.
- Validation passed: `py -m pytest backend/tests`, `npm run check:public-boundary`, `npm run typecheck`, `npm run build`, `npm run smoke:page-polish`, and `git diff --check`.

### T68 - Report Export Evidence Pack

Priority: P1
Status: Completed
Target Window: 2026-08-29 to 2026-09-04
Depends on: T67

Task:

- Export reports with evidence tables, provider status, generated time, data freshness, and audit references.
- Add PDF/Markdown export parity where practical.
- Validate that exports exclude secrets and private runtime state.
- Finish the task by preparing and uploading the first GitHub Release with approved Windows artifact(s) and release notes after evidence-pack and secret/private-state checks pass.

Done when:

- A user can hand someone a report that explains both conclusion and evidence quality.
- The first GitHub Release URL is recorded in this task board, and the uploaded release excludes runtime data, secrets, Stronghold vaults, diagnostics, and private local state.

Completion:

- Added evidence-pack summaries and private-state exclusion notes to Research, Data Sources, and Strategy exports.
- Added release notes and a release-artifact boundary check for the approved Windows artifacts.
- Rebuilt and validated the desktop EXE, MSI, and NSIS installer.
- Uploaded the first GitHub Release: `https://github.com/LaurenceFang/pengbo-workbench/releases/tag/v0.1.0`.
- Validation passed: `py -m pytest backend/tests`, `npm run check:version`, `npm run check:public-boundary`, `npm audit --audit-level=moderate`, `npm run typecheck`, `npm run build`, `npm run sidecar:build`, `npm run tauri:build`, `npm run check:release-artifacts`, `npm run smoke:packaged-startup`, `npm run smoke:evidence-report`, `npm run smoke:data-sources:packaged`, `npm run smoke:installed-startup`, `npm run smoke:installed-startup:nsis`, and `git diff --check`.

### T69 - Command Center V1

Priority: P2
Status: Completed
Target Window: 2026-09-05 to 2026-09-11
Depends on: T68

Task:

- Build a compact command center for common actions: search asset, open research brief, refresh provider, export report, view audit, and run safe smoke checks.
- Keep it operational and dense, not a marketing dashboard.
- Preserve keyboard and accessibility anchors.

Done when:

- Experienced users can move through frequent workflows quickly from one place.

Completion:

- Added a `Command Center` workspace to the desktop shell and navigation.
- Added compact actions for asset search, opening or creating Research briefs, provider refresh/tests, Research and Data Sources report export, security and Binance audit review, and a no-secret local readiness check.
- Preserved the existing workspace store, `/api/v1/...` API surfaces, local unlock/session permission behavior, and no-live-trade boundary.
- Added stable automation anchors for `command-center`, asset results, provider actions, audit review, export actions, and safe checks.
- Validation passed: `npm run typecheck`, `npm run check:public-boundary`, `npm run build`, `npm run smoke:page-polish`, `git diff --check`, and a Browser/Playwright visual check of the new `command-center` workspace plus no-secret safe check.

### T69# Temp - Packaged Desktop Video Walkthrough

Priority: P2
Status: Completed
Target Window: 2026-05-20
Depends on: T69

Task:

- Launch `E:\彭博\src-tauri\target\release\pengbo-workbench.exe` through the configured Windows desktop automation path.
- Use local unlock password `000000`.
- Generate a final video walkthrough of: input password, select an asset, select a factor, select a strategy, and run a backtest.
- Use Windows Computer Use for the packaged desktop walkthrough, Browser only for local preview or verification as useful, and Hyperframes for the final video composition.

Done when:

- A local video artifact is generated and the final answer links to it.
- The video makes clear that the strategy run is a local simulation/backtest, not live trading.

Completion:

- Rebuilt `src-tauri\target\release\pengbo-workbench.exe` after T69 so the walkthrough used the current packaged desktop app.
- Used Windows Computer Use to drive the real app through local unlock initialization with `000000`, AAPL asset selection, 12-1 Momentum factor selection, factor run, Top-N Factor Rotation strategy selection, and simulated backtest execution.
- Generated `logs/t69-temp-video/pengbo-t69-temp-walkthrough.mp4` with Hyperframes from the real packaged desktop frames.
- Validation passed: `npx hyperframes lint`, `npx hyperframes inspect --samples 8`, `npx hyperframes render --strict`, and a rendered-frame preview at `logs/t69-temp-video/preview-36s.png`.

### T70 - First-Run Product Onboarding

Priority: P2
Status: Completed
Target Window: 2026-09-12 to 2026-09-18
Depends on: T69# Temp

Task:

- Add first-run guidance for demo mode, provider setup, local unlock, privacy boundary, and safe execution boundary.
- Keep onboarding skippable and local-only.
- Add a resettable checklist for new reviewers.

Done when:

- A first-time user understands what Pengbo can do now and what is intentionally blocked.

Completion:

- Extended the local onboarding state from a single seen timestamp to a resettable checklist for demo mode, provider setup, local unlock, privacy boundary, and execution boundary.
- Added a Dashboard first-run onboarding panel with reviewer-oriented guidance, progress state, checklist toggles, and direct handoffs to Dashboard, Connections, Settings, Data Sources, and Strategy Lab.
- Added a Settings reset control so demos and reviews can replay first-run onboarding without deleting credentials, portfolios, research, workflows, or local databases.
- Fixed visible first-run/demo/local setup Chinese mojibake in the shell path touched by T70.
- Added `npm run smoke:onboarding` to validate reset, checklist persistence, Settings reset, and the local unlock gate needed to reach Settings.
- Validation passed: `py -m unittest backend.tests.test_settings_service`, `npm run typecheck`, `npm run check:public-boundary`, `npm run build`, `npm run smoke:onboarding`, `npm run smoke:page-polish`, `git diff --check`, and `npm run tauri:build`.

### T71 - Provider Capability Matrix

Priority: P1
Status: Implemented
Target Window: 2026-09-19 to 2026-09-23
Depends on: T70

Task:

- Create a provider capability matrix for asset classes, regions, endpoints, credential needs, rate limits, freshness, and read/write status.
- Keep existing `/api/v1/connections/catalog` compatibility.
- Make unsupported capabilities explicit.

Done when:

- Product and engineering can decide connector work from a shared source of truth.

Implementation notes:

- Extended `ProviderSourceDefinition`, `CapabilityDefinition`, and `/api/v1/connections/catalog` response models with additive matrix fields for endpoint coverage, write status, execution boundary, matrix summary, unsupported reasons, and decision notes.
- Preserved existing provider and capability fields, existing capability keys, read-only defaults, and the Binance execution boundary.
- Upgraded Connections capability rendering into a decision-oriented matrix covering endpoints, assets, regions, credential needs, freshness, and write status while preserving packaged smoke anchors.
- Validation passed on 2026-05-21: `py -m unittest backend.tests.test_capability_service`, `npm run typecheck`, `py -m unittest discover -s backend/tests -p "test_*.py"`, and `npm run build`.

### T72 - Provider Credential State Model

Priority: P1
Status: Implemented
Target Window: 2026-09-24 to 2026-09-28
Depends on: T71, T54

Task:

- Normalize credential states: missing, configured, invalid, expired, disabled, read-only, trading-gated, and blocked.
- Surface exact next action per state.
- Ensure audit output remains redacted.

Done when:

- Provider readiness is understandable without exposing secret values.

Implementation notes:

- Added normalized credential state fields to `ConnectionCheckResponse` and `ConnectionStatusItem`: state, label, next action, action kind, and reason.
- Centralized credential state derivation in `ConnectionsService` so missing, configured, invalid, disabled, read-only, trading-gated, and blocked paths are described without changing existing health semantics.
- Updated the Connections UI to render a provider-level credential state panel with redacted next-action guidance.
- Updated the Tauri `ConnectionTestResponse` shape so desktop provider tests receive the same state contract.
- Added account-scoped credential tests for missing, read-only, trading-gated, and redacted audit behavior.
- Validation passed on 2026-05-21: `py -m unittest backend.tests.test_account_scoped_credentials`, `py -m unittest backend.tests.test_capability_service`, `npm run typecheck`, `py -m unittest discover -s backend/tests -p "test_*.py"`, and `npm run build`.

### T73 - Provider Freshness And Cache Policy

Priority: P1
Status: Completed (2026-05-21)
Target Window: 2026-09-29 to 2026-10-03
Depends on: T72

Task:

- Define cache TTL, stale data labeling, refresh behavior, and offline fallback per provider class.
- Add visible freshness rules to research surfaces and exports.
- Add tests for stale, cached, failed refresh, and offline states.

Done when:

- The app cannot silently treat stale or simulated data as current market evidence.

Completion:

- Added additive freshness policy fields for cache TTL, stale-after windows, refresh behavior, and offline fallback to provider capability metadata.
- Extended Data Sources runtime status and provenance with freshness states for `fresh`, `cached`, `stale`, `refresh_failed`, `offline`, `credential_required`, `unavailable`, `unsupported`, and `unknown` evidence while preserving existing `health`, `stale`, `cache_updated_at`, and `cache_age_seconds` compatibility.
- Updated Data Sources UI status strips and provenance anchors so users can see freshness state, cache age, TTL, refresh behavior, and offline fallback before relying on provider evidence.
- Updated Data Sources evidence-pack exports to include freshness state, cache age, TTL, refresh behavior, and offline fallback in source summaries and the evidence-quality table.
- Added focused backend coverage for provider freshness policy metadata, credential-required freshness separation, TTL-based stale status, refresh-failed cached fallback, offline states, and export summaries.
- Validation passed on 2026-05-21: `py -m unittest backend.tests.test_capability_service backend.tests.test_data_source_service` and `npm run typecheck`.

### T74 - Data Quality Status Contract

Priority: P1
Status: Completed (2026-05-21)
Target Window: 2026-10-04 to 2026-10-08
Depends on: T73

Task:

- Add structured data-quality fields for completeness, timeliness, source confidence, and limitation notes.
- Use the contract across research, portfolio, screener, reports, and provider diagnostics.
- Avoid performance claims where evidence is simulated or blocked.

Done when:

- Data quality is machine-readable and user-visible across the product.

Completion:

- Added additive `DataQualityStatus` and `DataQualityDimension` models for completeness, timeliness, source confidence, limitations, notes, and machine tags.
- Added a shared data-quality derivation helper so provider freshness, stale/cache state, missing metrics, unavailable provider data, and simulated evidence map into one contract.
- Extended Data Sources status, provenance, report summaries, and report Markdown with structured data quality and a dedicated Data Quality table.
- Extended Research briefs and evidence snapshots with structured data quality, including exported Markdown quality tables.
- Extended Screener results, Factor Lab results, Portfolio holdings, and Portfolio summary responses with structured data-quality status while preserving existing `missing_metrics`, `missing_data`, `valuation_status`, `stale`, `notes`, and `data_quality_notes` compatibility fields.
- Updated Data Sources, Research, Screeners, Factor Lab, and Portfolio UI surfaces to show the new quality level alongside existing freshness, missing-data, and valuation states.
- Validation passed on 2026-05-21: `py -m unittest backend.tests.test_data_source_service backend.tests.test_research_service backend.tests.test_screener_service backend.tests.test_portfolio_service` and `npm run typecheck`.

### T75 - Provenance UI And Export Sync

Priority: P1
Status: Completed
Target Window: 2026-10-09 to 2026-10-13
Depends on: T74

Task:

- Show source provenance inline on critical research and portfolio views.
- Carry the same provenance into exports.
- Add audit links or IDs where available.

Done when:

- The UI and exported report tell the same evidence story.

Completion notes:

- Added additive portfolio provenance references to Portfolio summary, Portfolio holdings, and Research portfolio context.
- Research Evidence Chain now shows audit event IDs inline when audit references exist.
- Research Decision Review now includes linked portfolio provenance references, and Portfolio shows provenance status/source references beside summary and holding data.
- Research evidence-pack Markdown exports now include Portfolio Context, Portfolio Provenance, and audit IDs so the exported report matches the visible Research/Portfolio evidence story.
- Validation passed on 2026-05-22: `py -m unittest backend.tests.test_research_service backend.tests.test_portfolio_service`, `npm run typecheck`, `npm run build`, and `npm run smoke:page-polish`.

### T76 - Existing Providers Audit

Priority: P1
Status: Completed
Target Window: 2026-10-14 to 2026-10-18
Depends on: T75

Task:

- Audit every existing provider implementation against capability, credential, freshness, quality, and provenance contracts.
- Fix drift or mark unsupported states honestly.
- Confirm no new live-trading path is introduced.

Done when:

- Existing providers match the product contract instead of relying on implied behavior.

Completion notes:

- Audited the provider catalog against runtime Data Sources status and provider fetch behavior.
- Corrected market provider metadata to name Public Market Data and document Yahoo-style equity/ETF plus Binance public crypto provenance.
- Corrected RSS Events metadata to name Google News RSS Events and point provenance to Google News RSS search.
- Corrected CoinGecko demo/pro credential copy and removed the unsupported `history` capability from the credential-gated capability set.
- Locked the provider registry contract with tests for provider coverage, read-only/no-live-trading boundaries, freshness/provenance fields, Binance account semantics, Google News RSS provenance, and CoinGecko unsupported history behavior.
- Validation passed on 2026-05-22: `py -m unittest backend.tests.test_capability_service backend.tests.test_data_source_service`, `py -m unittest backend.tests.test_research_service backend.tests.test_portfolio_service`, `npm run typecheck`, `npm run build`, and `npm run smoke:page-polish`.

### T77 - Data Sources Packaged Signoff V2

Priority: P1
Status: Completed
Target Window: 2026-10-19 to 2026-10-23
Depends on: T76

Task:

- Validate the provider catalog, credential states, freshness labels, cache behavior, provenance, and exports in the packaged EXE.
- Save evidence artifacts for no-key, configured-key, offline, stale, and blocked states.
- Update the board with exact outcomes and follow-ups.

Local tooling follow-up:

- Found after T72: Codex can still commit and push with plain Git, but this Windows environment currently does not expose the GitHub CLI (`gh`). Install and authenticate `gh` before workflows that require PR creation, CI run inspection, review-comment triage, issue management, or GitHub Release automation from the local shell.

Done when:

- Data-source behavior is trustworthy enough to support broader AI and China-market work.

Completed on 2026-05-22:

- Data Sources now shows a packaged catalog summary with 9 providers, 9 read-only contracts, 0 live-trading paths, and 4 credential-gated providers.
- `scripts/packaged_data_sources_smoke.ps1` now asserts the packaged EXE exposes 9 catalog providers and 5 runtime Data Sources, with read-only/no-live-trading/write-status boundaries, freshness/cache/provenance metadata, credential-state summaries, configured-key or identity evidence, unsupported capability boundaries, and source-safe export paths.
- `backend/app/services/data_source_service.py` now includes a full provider catalog contract table in the data-source report export.
- Latest source-safe packaged evidence: `logs/data-sources-packaged-smoke-latest.json` reported `catalog_provider_count=9`, `provider_count=5`, `catalog_summary providers=9 read_only=9 live_trading=0 credential_gated=4`, configured-key evidence for `fred`, `coingecko`, `edgar`, and `binance`, and no source-safe check failures.
- Validation passed: `py -m unittest backend.tests.test_capability_service backend.tests.test_data_source_service`, `py -m unittest backend.tests.test_research_service backend.tests.test_portfolio_service`, `npm run typecheck`, `npm run build`, `npm run check:public-boundary`, `npm run check:version`, `npm run tauri:build`, and `npm run smoke:data-sources:packaged`.

### T78 - Local LLM Runtime Probe

Priority: P2
Status: Completed
Target Window: 2026-10-24 to 2026-10-30
Depends on: T77

Task:

- Probe local LLM options for summarization and research assistance.
- Measure startup cost, latency, memory, model availability, and offline behavior.
- Keep all AI features disabled unless explicitly enabled.

Done when:

- The team has evidence for whether local AI is practical on the target Windows machine.

Completion evidence:

- Added default-off AI runtime settings and additive `/api/v1/ai/runtime/status` plus `/api/v1/ai/runtime/probe` endpoints.
- The local probe uses the Ollama localhost API with a short timeout and writes source-safe evidence without credentials or prompt text.
- Latest local evidence: `logs/ai-local-runtime-probe-latest.json` with `health=available`, `model_count=2`, `selected_model=qwen3:8b`, and no model download required.
- Validation passed: `py -m unittest backend.tests.test_ai_runtime_service` and `py -m compileall backend\app\services\ai_runtime_service.py backend\app\runtime.py backend\app\api\factory.py backend\app\api\routes.py`.

### T79 - AI Permission Boundary

Priority: P1
Status: Completed
Target Window: 2026-10-31 to 2026-11-04
Depends on: T78, T56

Task:

- Define what AI can read, what it cannot read, what requires unlock, and what requires explicit user confirmation.
- Prevent AI from reading raw secrets, private credential material, or execution submission paths.
- Add audit events for AI context creation and report generation.

Done when:

- AI assistance has a clear permission boundary before any assistant UI ships.

Completion evidence:

- Added additive AI session permissions, route classifications, and the `ai_assistant` local-unlock surface.
- Added the Research Assistant permission boundary and redacted Research context preview service before any generation/UI path.
- Context preview is blocked while local unlock is uninitialized/locked, then records a redacted `ai_context_preview_created` audit event once unlocked.
- Validation passed: `py -m unittest backend.tests.test_research_assistant_service backend.tests.test_security_audit_service` and `py -m compileall backend\app\services\research_assistant_service.py backend\app\services\auth_session_service.py backend\app\services\local_security_service.py backend\app\models.py backend\app\api\routes.py backend\app\api\factory.py`.

### T80 - Research Assistant Backend

Priority: P1
Status: Completed
Target Window: 2026-11-05 to 2026-11-12
Depends on: T79

Task:

- Build a backend research-assistant service that consumes structured evidence, provenance, and data-quality contracts.
- Return grounded summaries, questions, risks, and citations to local evidence.
- Avoid free-form web claims unless a source connector explicitly supports them.

Done when:

- Assistant output is grounded in product evidence and can be audited.

Completion evidence:

- Added additive `/api/v1/research/assistant/briefs/{brief_id}/generate` with local-unlock and `ai:generate` session permission gates.
- AI-disabled state now returns an audited `blocked` response instead of generating text.
- AI-enabled local mode returns evidence-grounded summary, questions, risks, limitations, citations, and Markdown without adding uncited web claims or execution instructions.
- Validation passed: `py -m unittest backend.tests.test_research_assistant_service` and `py -m compileall backend\app\services\research_assistant_service.py backend\app\models.py backend\app\api\routes.py backend\app\api\factory.py`.

### T81 - Research Assistant UI

Priority: P1
Status: Completed
Target Window: 2026-11-13 to 2026-11-20
Depends on: T80

Task:

- Add assistant UI into the research flow, not as a separate chatbot island.
- Show source evidence, uncertainty, and data limitations next to generated text.
- Provide actions for saving notes, adding watch items, and exporting briefs.

Done when:

- The assistant improves research workflow without hiding provenance.

Completion evidence:

- Added Research-page assistant controls for redacted context preview, grounded draft generation, citations, limitations, blocked states, and save-to-notes.
- The assistant stays inside the existing Research workflow and uses stable ASCII automation anchors such as `research-assistant-preview`, `research-assistant-generate`, and `research-assistant-output`.
- Existing notes, watchlist, portfolio handoff, and Markdown export actions remain available beside the assistant.
- Validation passed: `npm run typecheck` and `npm run build`.

### T82 - Evidence-Grounded Prompt Layer

Priority: P1
Status: Completed
Target Window: 2026-11-21 to 2026-11-27
Depends on: T81

Task:

- Add prompt templates for thesis, counter-thesis, earnings review, portfolio risk, provider limitation, and report rewrite.
- Include strict language rules for observed/simulated/blocked evidence.
- Add regression fixtures for hallucination-prone scenarios.

Done when:

- Generated text consistently stays inside known evidence boundaries.

Implementation Log:

- Added the assistant prompt-template catalog for research summary, thesis, counter-thesis, earnings review, portfolio risk, provider limitation, and report rewrite.
- Exposed `/api/v1/research/assistant/templates` behind the AI context permission boundary and wired the Research UI to choose templates before generation.
- Extended regression coverage with an offline AAPL Research fixture and provider-limitation checks that reject uncited price targets, earnings-date claims, and execution verbs.
- Validation: `py -m unittest backend.tests.test_research_assistant_service`, `npm run typecheck`, `py -m compileall backend\app\services\research_assistant_service.py backend\app\services\auth_session_service.py backend\app\models.py backend\app\api\routes.py backend\tests\test_research_assistant_service.py`, `npm run check:public-boundary`, and `git diff --check`.

### T83 - Cloud LLM Explicit Opt-In

Priority: P2
Status: Completed
Target Window: 2026-11-28 to 2026-12-04
Depends on: T82

Task:

- Add optional cloud LLM configuration only after a clear privacy warning and user opt-in.
- Show what context would leave the machine before submission.
- Keep local mode as the default.

Done when:

- A user cannot accidentally send private research context to a cloud model.

Implementation Log:

- Added local environment settings and `/api/v1/ai/cloud/status` for cloud AI status without returning API keys.
- Extended Research assistant generation with `providerMode`, `cloudOptInConfirmed`, and `cloudContextAcknowledgedChars`; cloud requests are blocked unless the user selects Cloud, confirms the redacted preview, and acknowledges the current preview size.
- Added UI controls in Research for Local/Cloud mode, cloud readiness metrics, and a per-request cloud confirmation checkbox; Settings and Manual now expose the AI boundary.
- Regression coverage validates cloud-disabled/default status, missing opt-in, stale preview acknowledgement, missing credential blocking, and local generation still completing.
- Validation: `py -m unittest backend.tests.test_research_assistant_service`, `npm run typecheck`, and `py -m compileall backend\app\services\research_assistant_service.py backend\app\services\auth_session_service.py backend\app\runtime.py backend\app\models.py backend\app\api\routes.py backend\tests\test_research_assistant_service.py`.

### T84 - AI Research Packaged Signoff

Priority: P1
Status: Completed
Target Window: 2026-12-05 to 2026-12-11
Depends on: T83

Task:

- Validate local-disabled, local-enabled, cloud-disabled, cloud-opt-in, stale evidence, blocked evidence, and export flows in the packaged EXE.
- Save screenshots or logs that prove redaction, permission prompts, and provenance.
- Update roadmap based on remaining AI quality gaps.

Done when:

- AI features are useful, permissioned, and auditable in the real desktop build.

Implementation Log:

- Added `scripts/packaged_ai_research_smoke.ps1` and `npm run smoke:ai-research:packaged` for serial release-EXE validation.
- The smoke backs up/restores the packaged AppData runtime, starts the real release desktop with default, local-AI, and cloud-enabled/no-key environment modes, and never supplies or logs a cloud API key.
- Packaged evidence in `logs/ai-research-packaged-smoke-latest.json` shows local disabled blocked with `ai_disabled`, local generation completed with five citations, cloud no-confirm blocked with `cloud_opt_in_required`, cloud disabled blocked with `cloud_disabled`, cloud opt-in without key blocked with `cloud_credentials_missing`, stale evidence preserved cached/stale language, and export created a report with no secret-like markers.
- Validation: `npm run tauri:build`, `npm run smoke:ai-research:packaged`, PowerShell parser check for `scripts\packaged_ai_research_smoke.ps1`, `npm run check:public-boundary`, and `git diff --check`.

### T85 - China Market Data Source Study

Priority: P2
Status: Completed
Target Window: 2026-12-12 to 2026-12-18
Depends on: T77

Task:

- Study feasible A-share, HK, China macro, FX, fund, and news/data options.
- Classify sources by license, API stability, cost, region coverage, and redistribution risk.
- Recommend a first read-only connector pack.

Done when:

- The team has a legally and technically cautious China-market source plan.

Implementation Log:

- Added the cautious source plan in `docs/china-market-source-study.md`.
- Selected Tushare Pro HTTP API as the first user-token A-share source and HKMA Open API as the first no-key HK/China macro source; AKShare remains candidate-only pending upstream-by-upstream provenance and redistribution review.
- Boundary: no automated account/API-key acquisition is required for tests or packaged signoff; fixtures and local user-provided tokens keep secrets out of repo and smoke output.
- Expanded the source study with the user's requested next Tushare `api_name` queue (`daily_basic`, `fina_indicator`, `income`, `balancesheet`, `cashflow`, `adj_factor`, `trade_cal`, and `moneyflow`) plus additional cautious candidates: BaoStock, AKShare, CNINFO, exchange-direct feeds, HKMA/DATA.GOV.HK, World Bank/FRED/DB.NOMICS, GDELT, SEC EDGAR, CoinGecko, and Binance market data.

### T86 - Connector Manifest Contract

Priority: P1
Status: Completed
Target Window: 2026-12-19 to 2026-12-23
Depends on: T85

Task:

- Define a connector manifest for capabilities, regions, asset classes, credentials, freshness, rate limits, licensing notes, and read-only status.
- Align the manifest with provider catalog compatibility.
- Add schema validation.

Done when:

- New connectors can be added without custom one-off product behavior.

Implementation Log:

- Added `ConnectorManifest`/`ConnectorManifestResponse` models and `GET /api/v1/data-sources/manifests`.
- Extended the provider catalog with Tushare and HKMA manifest metadata: regions, asset coverage, credentials, freshness, rate/license notes, redistribution risk, read-only, no-live-trading, and write-status fields.
- Data-source report export now includes a Connector Manifest Summary table.

### T87 - Connector Test Harness

Priority: P1
Status: Completed
Target Window: 2026-12-24 to 2026-12-30
Depends on: T86

Task:

- Build a connector test harness for no-key, configured-key, timeout, malformed response, stale response, and license-blocked states.
- Produce local fixtures where live calls are unavailable or unsafe.
- Keep live secrets out of test output.

Done when:

- Connector quality can be verified before UI integration.

Implementation Log:

- Added `backend/app/services/connector_harness.py` with A-share and HKMA fixtures plus configured-key, timeout, malformed-response, and license-blocked scenario handling.
- Fixture scenarios are only available in backend test mode or `PENGBO_CHINA_CONNECTOR_FIXTURES=1` packaged smoke mode.
- Added unit coverage for no-key status, token masking, fixture reads, cached fallback, and license-blocked/no-network behavior.

### T88 - A-Share Read-Only Connector V1

Priority: P1
Status: Completed
Target Window: 2026-12-31 to 2027-01-08
Depends on: T87

Task:

- Add the first read-only A-share connector based on the approved source plan.
- Support search, quote/status, basic company profile, and freshness/provenance fields.
- Mark unsupported trading or restricted data explicitly.

Done when:

- A-share research can begin with honest read-only data status.

Implementation Log:

- Added Tushare A-share endpoints for search, quote/status, and basic company profile.
- Added controlled A-share catalog seeds (`600519.SH`, `000001.SZ`, `300750.SZ`) and fixture quote/profile support in packaged smoke mode.
- Tauri Stronghold/env plumbing now supports `tushare.token`, `PENGBO_TUSHARE_TOKEN`, and `TUSHARE_TOKEN`; API responses and exports keep the token redacted.
- Data Sources UI surfaces Tushare credential state and A-share preview with read-only/no-live-trading markers.
- Live token validation on 2026-05-31 confirmed valid Tushare tokens can still hit endpoint-level upstream code `40203`; the connector now reports this as `permission_blocked` provenance without exposing the token.
- Follow-up live validation on 2026-05-31 confirmed `daily` can return a `600519.SH` read-only quote while `stock_basic` may be frequency-limited; quote/status now keeps the fresh `daily` price and marks the missing profile lookup as `profile_lookup_unavailable` / `partial_profile` instead of discarding the quote.

### T89 - HK/China Macro Connector V1

Priority: P1
Status: Completed
Target Window: 2027-01-09 to 2027-01-16
Depends on: T88

Task:

- Add the first read-only HK or China macro connector from the approved source plan.
- Support key series, freshness, provenance, and export integration.
- Keep licensing limitations visible.

Done when:

- Regional macro context can appear in research briefs without manual copy/paste.

Implementation Log:

- Added HKMA Open API as a no-key Data Sources provider with macro series support through `/api/v1/data-sources/macro/series?provider=hkma`.
- Data Sources UI now includes an HKMA macro source configuration and report export can use HKMA series.
- Unit and packaged smoke coverage verify fixture-backed HKMA macro reads with official provenance and no credential requirement.

### T90 - China Market Research Template

Priority: P1
Status: Completed
Target Window: 2027-01-17 to 2027-01-23
Depends on: T89

Task:

- Add a China-market research template that reflects A-share/HK/macro data limitations.
- Include policy, liquidity, listing venue, currency, sector, and source-quality sections.
- Integrate assistant and report export only where evidence is available.

Done when:

- China-market output feels purpose-built rather than a translated US-equity template.

Implementation Log:

- Added `china_market` Research decision-review template and assistant prompt template.
- Workflow Studio `data_sources_to_research` can collect equity/A-share samples and create China-market research briefs.
- Briefs for Tushare-backed `.SH`/`.SZ` assets include listing venue, currency, policy/liquidity, source-quality, credential/license, redistribution, and unsupported-trading boundaries.

### T91 - Connector Packaged Signoff

Priority: P1
Status: Completed
Target Window: 2027-01-24 to 2027-01-30
Depends on: T90

Task:

- Validate connector manifests, A-share connector, HK/macro connector, research templates, exports, offline states, and blocked-license states in the packaged EXE.
- Save evidence artifacts and update follow-up tasks.
- Confirm all new connectors remain read-only.

Done when:

- The first China-market connector pack is usable and honestly bounded.

Implementation Log:

- Added `scripts/packaged_china_connectors_smoke.ps1` and `npm run smoke:china-connectors:packaged`.
- The smoke uses the real release EXE, backs up/restores the packaged runtime, validates no-key Tushare/HKMA status, manifest contracts, Tushare search/quote/profile, HKMA macro, cached timeout fallback, license-blocked/no-live-trading boundaries, Workflow Studio to Research, Research export, and Data Sources export.
- Evidence target: `logs/china-connectors-packaged-smoke-latest.json`.
- Live configured-token evidence target: `logs/tushare-live-api-validation-latest.json`; current account evidence records upstream `40203` frequency blocks for `stock_basic`, a successful `daily` quote for `600519.SH`, Pengbo `permission_blocked` responses for search/profile, and a fresh quote response with partial-profile limitations.
- Expanded Tushare permission evidence target: `logs/tushare-expanded-api-validation-latest.json`; current evidence is redacted and records endpoint-level response codes, field lists, row counts, and read-only/no-live-trading flags without storing the token or request body.

### T92 - Credential Audit Trail Hardening

Priority: P1
Status: Completed
Target Window: 2027-01-31 to 2027-02-05
Depends on: T91, T54

Task:

- Harden audit coverage for credential lifecycle, unlock state, provider readiness, AI context access, and report exports.
- Add redaction regression tests for sensitive strings.
- Review all diagnostics and exports for accidental secret leakage.

Done when:

- Credential and sensitive-workflow history is accountable without exposing the secrets themselves.

Implementation Log:

- Added shared sensitive-text redaction for bearer headers, key/token/password/passphrase/unlock/session assignments, query params, URL-encoded `api_key%3D...` style strings, and common token shapes.
- Applied redaction before persisting Research notes, rendering Research/Data Sources/Strategy report exports, and saving Portfolio transaction notes.
- Expanded security audit redaction key coverage for unlock secrets, passphrases, PIN-like values, API-key variants, and nested payload/list structures.
- Added regression coverage for audit payload redaction, URL-encoded secret markers, report export redaction, and SQLite plaintext checks.

### T93 - Sensitive Workspace Lock Rules

Priority: P1
Status: Completed
Target Window: 2027-02-06 to 2027-02-11
Depends on: T92, T53

Task:

- Extend lock rules to notebooks, reports, exports, assistant contexts, screenshots, and cached research artifacts where sensitive data may appear.
- Add clear user-facing locked, hidden, or redacted states.
- Validate idle relock and restart restore across these workspaces.

Done when:

- Lock behavior covers the actual places where sensitive work accumulates, not only credential screens.

Implementation Log:

- Extended backend local-unlock gates to Research briefs/notes/evidence/export, Factor Lab runs, Workflow Studio runs, Strategy/Data Sources report exports, Portfolio summary/holdings/transactions, runtime settings, AI-control writes, and assistant context previews.
- Expanded sensitive-surface routing and gateway classification for Research, Factor Lab, Workflow Studio, Portfolio, settings/runtime, AI control, and report export routes.
- Updated the desktop shell so Research, Factor Lab, Strategy Lab, Workflow Studio, Data Sources, Portfolio, Connections, and Settings show the local unlock gate while locked.
- Preserved the local-first boundary: no hosted account, remote sync, public API, or non-roadmap live trading route was added.

### T94 - Security Packaged Signoff

Priority: P1
Status: Completed
Target Window: 2027-02-12 to 2027-02-18
Depends on: T92, T93

Task:

- Run a packaged security signoff covering local unlock, idle relock, account-scoped credentials, session checks, sidecar gateway, AI permissions, exports, diagnostics, and audit views.
- Produce evidence artifacts and update the board with any remaining blockers.
- Confirm no public service, hosted account, or live trading path was added outside explicit roadmap scope.

Done when:

- Pengbo has a documented security-accountability baseline that supports the next real release cycle.

Implementation Log:

- Added `scripts/packaged_security_signoff_smoke.ps1` plus `npm run smoke:security:packaged`.
- The smoke runs the packaged sidecar bundle, initializes local unlock, creates a local session, creates and redacts a Research brief, exports Research and Data Sources reports, locks sensitive routes, verifies 423 responses, unlocks, checks audit events, checks route classification, verifies gateway rejection behavior, and scans SQLite for the secret marker.
- Latest evidence target: `logs/security-signoff-packaged-smoke-latest.json`.
- Latest packaged signoff passed with `health_ready=true`, Research/Data Sources exports created and redacted, locked sensitive routes returning 423, `report_exported` and `sensitive_surface_blocked` audit evidence, gateway unsafe-origin and invalid-method rejection, route-classification coverage, `sqlite_plaintext_secret_found=false`, and `failures=[]`.

### T52 - Git Upload Readiness And Repository Normalization

Priority: P2  
Status: Completed

Scope:

- Prepared the local project for a public Git upload without creating a remote repository, pushing code, or changing product behavior.
- Documented source-vs-generated upload boundaries and local rebuild expectations.
- Tightened ignore rules for generated assets, local runtime state, diagnostics, logs, caches, installers, binaries, and secret material.

Acceptance:

- A public reader can understand the product, architecture, safety boundary, and local setup flow from `README.md`.
- A future Git initialization can use the ignore rules and upload-readiness document to avoid committing local data, generated binaries, or credentials.
- Existing runtime/API behavior remains unchanged.

Evidence:

- `README.md`
- `docs/REPOSITORY_UPLOAD_READINESS.md`
- `.gitignore`
- `src-tauri/.gitignore`
- Validation passed: README/package-script consistency review, ignore-boundary review, temporary Git ignore smoke outside the project tree, sensitive-term documentation scan, `npm run typecheck`, and `npm run build`.

### T12 - Offline-First Portfolio Hardening

Priority: P1  
Status: Completed

Scope:

- Hardened portfolio behavior when quotes and benchmarks are unavailable and cache is cold.
- Replaced partial failures with explicit `connecting`, `empty`, `degraded`, and `ready` handling.
- Prevented cold offline starts from breaking the portfolio page by failing fast into cache/unavailable semantics.

Acceptance:

- Portfolio pages stay usable when live data is unavailable.
- Transactions remain readable/editable even when valuation and benchmark data degrade.
- Packaged smoke now confirms deterministic `cached` / `unavailable` fallback semantics instead of ambiguous failure states.

### T13 - Packaging Noise Reduction

Priority: P1  
Status: Completed

Scope:

- Continue reducing PyInstaller size and warning noise.
- Trim `FinanceToolkit`, `pandas`, `SciPy`, `PySide6`, and `curl_cffi` spillover where possible.
- Keep emitting build size, duration, and warning summary so reductions stay measurable.

Acceptance:

- Sidecar size moves closer to the `~120 MB` target.
- Warning summary becomes materially shorter and more relevant.
- Build time trends downward from the current `~81s` baseline.

### T14 - Screener Quality Expansion

Priority: P2  
Status: Completed

Scope:

- Expand the screener universe beyond the current catalog-only flow.
- Add richer factor logic, scoring, explanations, and missing-metric reporting.
- Keep the upgraded screener surface compatible with the now-stable desktop/runtime baseline.

Acceptance:

- Screener output is meaningfully more informative than the current lightweight catalog pass.
- The upgraded screener surface stays compatible with the current packaged/runtime contract.

### T24 - Screener Configurable Profiles

Priority: P2  
Status: Completed

Scope:

- Add constrained, profile-aware tuning on top of the fixed `T14` score profiles instead of leaving preset filters as display-only copy.
- Persist supported tuning options through the existing preset storage without introducing a free-form DSL or background jobs.
- Keep `T14` scoring, explanations, and universe summaries stable while exposing a safe user-facing tuning path.

Acceptance:

- Users can tune supported screener profile emphasis from the desktop UI without code edits.
- Tuned presets still return ranked, explained results through the current `/api/v1/screeners/*` contract.

### T25 - Screener Variant Packaged Signoff

Priority: P2  
Status: Completed

Scope:

- Added `scripts/packaged_screener_variant_signoff.ps1` plus `npm run smoke:screener-variant-signoff` for a repeatable packaged screener-variant lifecycle pass.
- Reused the AppData-backed packaged runtime pattern already established in earlier packaged smoke work instead of treating screener persistence as a repo-local dev-only contract.
- Validated creation, tuning, activation, relaunch restore, deletion, and system-default fallback for custom screener variants against the real packaged desktop runtime.
- Added stable packaged-shell automation anchors so preset state, variant state, summary filters, and run attribution remain script-verifiable after relaunch.

Acceptance:

- A documented and scripted packaged validation flow exists for screener variant persistence, relaunch restore, and deletion cleanup.
- Packaged desktop validation confirms that the visible active variant state stays aligned with stored runtime data before future screener releases are signed off.
- The latest packaged signoff result is captured in `logs/screener-variant-signoff-latest.json`.

### T26 - Research Workspace

Priority: P2  
Status: Completed

Scope:

- Add a new `research` workspace to the desktop shell so research can be conducted in a dedicated surface instead of being split across dashboard, asset, screener, and portfolio pages.
- Extend the frontend navigation, app store, and settings preferences to support `research` as a first-class `ViewKey`.
- Build a three-column research workspace:
  - left column for asset search, recent research, and screener hits
  - middle column for the research brief canvas
  - right column for notes, watchlist actions, portfolio handoff, and export actions
- Add `/api/v1/research/*` endpoints backed by a new `research_service` that composes existing asset, screener, filings, and portfolio signals into a reusable research brief response.
- Persist research brief snapshots and user-authored notes in SQLite so the research surface becomes durable and restart-friendly.
- Keep the first release synchronous and local-only; do not add news aggregation, background jobs, cloud sync, or agent orchestration in this task.
- Added `scripts/packaged_research_workspace_smoke.ps1` plus `npm run smoke:research-workspace` for a repeatable packaged research-workspace signoff pass.
- Reused the existing packaged desktop and AppData-backed runtime pattern so research persistence is validated against the real release contract rather than only repo-local dev state.
- Wired screener-originated research creation and portfolio handoff into the first release so the workspace is useful as a real desktop flow instead of a notes-only shell.

Acceptance:

- Users can open a dedicated research workspace from the desktop shell and generate a local research brief for a supported symbol.
- Research notes persist across desktop relaunches without changing the existing packaged runtime model.
- The new research surface reuses current provider and cache semantics instead of introducing a separate runtime path.
- The latest packaged signoff result is captured in `logs/research-workspace-smoke-latest.json`.

### T27 - Analysis Module Registry

Priority: P2  
Status: Completed

Scope:

- Introduce a backend analysis-module registry so reusable research outputs are produced through a common contract instead of being hard-coded separately inside each service or view.
- Add a new `backend/app/analysis/` layer with a shared result envelope for `summary`, `highlights`, `sections`, `sources`, `generated_at`, and `stale`.
- Seed the first module set from already-supported data domains:
  - `asset_quality_snapshot`
  - `filings_brief`
  - `screener_match_explainer`
  - `portfolio_risk_snapshot`
- Add shared frontend presentation components so analysis cards can be rendered consistently across the future research workspace and current asset/portfolio surfaces.
- Keep the existing `/api/v1/assets/*` and `/api/v1/screeners/*` contracts stable by routing new composed analysis output through the research layer instead of rewriting existing payload shapes.

Acceptance:

- New analysis modules can be registered and resolved through one backend contract rather than custom per-page logic.
- At least four reusable modules render through shared frontend components with deterministic structure.
- Existing asset, screener, and portfolio APIs remain backward compatible while the research stack gains richer composed output.

### T28 - Provider Capability Catalog

Priority: P2  
Status: Completed

Scope:

- Add a provider capability catalog so the desktop app can explain what each provider supports instead of only reporting `ok` / `error` / `missing_credentials` health states.
- Introduce `GET /api/v1/connections/catalog` with capability metadata for `quotes`, `history`, `fundamentals`, `filings`, `account`, `screeners`, and `research`.
- Rework the Connections surface to show both provider health and provider capability coverage without removing the current credential and status workflow.
- Use the capability catalog in research and asset surfaces to decide whether cards should render, degrade, or show explicit unsupported-state copy.
- Keep capability metadata aligned with the existing provider model and `connection_profiles.metadata_json` rather than inventing a parallel persistence path.

Acceptance:

- The desktop shell can display a capability matrix for every current provider without breaking existing connection tests.
- Research and asset surfaces can distinguish `unsupported` from `temporarily unavailable` using one shared provider-catalog source.
- Provider capability discovery stays consistent with the current local runtime and persistence model.

Implementation Notes:

- Added `backend/app/services/capability_service.py` so provider coverage and asset applicability rules now live behind one shared backend contract instead of being duplicated across connections, asset, and research logic.
- Added additive models plus `GET /api/v1/connections/catalog` for provider capability discovery while preserving the existing `/api/v1/connections/status` health endpoint and the current `/api/v1/assets/*` payload family.
- Extended `AssetWorkspaceResponse.capabilities` with additive status/message fields so fundamentals and filings now distinguish `available`, `credential_required`, `unsupported`, and `temporarily_unavailable`.
- Updated the connections, asset, and research surfaces so the new capability copy is visible in the desktop shell without replacing the current credential save/test/clear workflow.

Validation:

- `py -m compileall backend`
- `py -m unittest discover -s backend/tests -p "test_*.py"`
- `npm run typecheck`
- `npm run build`

### T29 - Command Palette And Report Export

Priority: P2  
Status: Completed (2026-04-23)

Scope:

- Add a global command palette so users can jump between assets, research briefs, screener actions, portfolio actions, and connection tests without relying only on sidebar navigation.
- Support commands for opening an asset, opening a research brief, running a preset plus variant, adding a portfolio transaction, testing a provider, and exporting the current research brief.
- Reuse the existing research Markdown export from `T26` and expose it through a command-driven cross-workspace action instead of building a second export path.
- Reuse app-store state and runtime services instead of duplicating page-local action wiring.
- Keep the first release keyboard-first and local-only; do not add workflow automation, macro recording, or multi-step agent flows in this task.

Acceptance:

- Users can invoke a global command palette and execute cross-workspace actions from one entry point.
- The current research brief can be exported from the command palette through the existing local Markdown report path under the runtime diagnostics/reports area.
- Command execution works with the existing desktop runtime model and does not require a new background service.

Validation:

- `npm run typecheck`
- `npm run build`

### T30 - Provider Capability Packaged Signoff

Priority: P3  
Status: Completed (2026-04-23)

Scope:

- Add a lightweight packaged-shell signoff pass for the new provider capability catalog across the Connections, Asset, and Research surfaces.
- Verify that packaged desktop runs render provider capability states consistently for `available`, `credential_required`, and `unsupported` cases without regressing the existing connection credential workflow.
- Reuse the current packaged runtime plus research smoke baseline where possible instead of introducing a separate provider-only harness.

Acceptance:

- A repeatable packaged validation path exists for the new capability catalog and additive asset/research fallback copy.
- Packaged desktop runs can prove the same capability-state semantics that backend tests and web builds now cover.

### T31 - Credential Workflow And Crypto Capability Smoke Hardening

  Priority: P3  
  Status: Completed (2026-04-29)

Scope:

- Harden the packaged provider-capability smoke so it can drive the desktop EDGAR credential save/clear flow end-to-end through the real Stronghold-backed UI controls instead of relying on runtime environment injection for the available-state phase.
- Restore a stable crypto unsupported sample to the packaged capability signoff, ideally returning to `BTC/USDT` once the current packaged public-quote SSL failures are either absorbed through cached/degraded handling or isolated from capability-state assertions.
- Keep `logs/provider-capability-signoff-latest.json` as the single result artifact rather than introducing a second provider smoke format.

Acceptance:

- The packaged capability smoke can prove `credential_required -> available -> credential_required` through the desktop credential form itself, not only through runtime environment setup.
- The packaged capability smoke can cover one unsupported crypto sample without intermittent Binance network failures turning the regression loop red for unrelated reasons.

Validation:

- `logs/provider-capability-signoff-latest.json` now records `failures=[]`, baseline EDGAR filings `credential_required`, after-save EDGAR filings `available`, post-restart EDGAR filings `available`, after-clear EDGAR filings `credential_required`, and `BTC/USDT` fundamentals/filings `unsupported`.
- The smoke keeps `BTC/USDT` quote fetch flakiness isolated from capability assertions by recording quote-side `temporarily_unavailable` separately when it occurs.

### T32 - Desktop WebView Credential Input Automation Adapter

Priority: P3  
Status: Completed (2026-04-29)

Scope:

- Add a deterministic desktop automation bridge for Tauri WebView text inputs so packaged smoke scripts can drive React-controlled credential fields through real desktop events instead of brittle UIAutomation value injection alone.
- Prove that `connection-secret provider=edgar field=identity` can be populated in packaged runs such that the existing `connection-save provider=edgar` action actually triggers the Stronghold save, sidecar restart, and post-restart `available` state.
- Keep the solution additive to the current packaged smoke harness and ASCII automation anchors rather than replacing the existing provider-capability signoff flow.

Acceptance:

- A packaged automation path can reliably fill the EDGAR identity field, click save, and observe `credential_required -> available` without falling back to environment injection.
- The same packaged automation path can clear the saved identity and restore `credential_required`, allowing `T31` to close on the next pass.

Validation:

- The packaged smoke records `credential_input_adapter.value_verified=true` without logging the credential value.
- The Tauri Stronghold path now logs only non-sensitive payload and persisted lengths, proving snapshot readback without exposing the identity string.

### T33 - Portfolio Analytics And Professional Charting

Priority: P2  
Status: Completed (2026-04-29)

Scope:

- Add professional portfolio analytics on top of existing transactions, holdings, benchmarks, and offline/cached/unavailable semantics.
- Add time-windowed performance views such as `Today`, `MTD`, `YTD`, `1Y`, and `Max`, plus core metrics for total return, realized/unrealized PnL, drawdown, volatility, Sharpe-style risk-adjusted return, benchmark relative return, and allocation concentration.
- Add allocation breakdowns by asset, asset class, currency, market, and available sector metadata without requiring new cloud services.
- Introduce a reusable professional chart component, with TradingView Lightweight Charts as the first candidate, while preserving the existing SVG `ChartPanel` as a fallback until the new chart path is validated.
- Keep the UI quiet, dense, and work-focused: metric strips, time-window segmented controls, tabs, sortable holdings, chart legends/toggles, and tooltips instead of marketing-style panels.

Acceptance:

- Portfolio users can understand performance, drawdown, benchmark comparison, and allocation risk from one local desktop workspace.
- Existing portfolio CRUD, offline-first behavior, and packaged portfolio smoke semantics remain intact.
- The chart layer is reusable by Portfolio first and can later be shared with Asset, Factor Lab, and Strategy Lab.

Validation:

- `py -m compileall backend`
- `py -m unittest discover -s backend/tests -p "test_*.py"`
- `npm run typecheck`
- `npm run build`
- `npm run tauri:build`
- `npm run smoke:portfolio-offline`
- `npm run smoke:portfolio-ui-signoff`
- `logs/portfolio-offline-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, `analytics_windows_count=5`, `analytics_pnl_method=average_cost`, and preserved `live`, `cached`, and `unavailable` valuation semantics.
- `logs/portfolio-ui-signoff-latest.json` recorded `health_ready=true`, `failures=[]`, stable `portfolio-view state=*` markers, stable `portfolio-status-pill state=*` markers, and enabled transaction-submit markers across ready/cached/unavailable UI scenarios.

### T34 - Local Factor Research Lab

Priority: P2  
Status: Completed (2026-04-29)

Scope:

- Add a local factor research workspace inspired by Qlib, Alphalens, and Lean research workflows, but scoped to Pengbo's current local provider/cache model.
- Compute and persist factor snapshots for supported assets using only reproducible local inputs and explicit data timestamps.
- First factor families are limited to well-studied signals: 12-1 momentum, value, quality/profitability, investment/conservative growth, low-volatility/risk, and a transparent multi-factor composite.
- Add factor diagnostics such as rank, percentile, bucket membership, missing-data reason, stale/cached status, and simple forward-return or historical bucket analysis where local data supports it.
- Keep this task research-only: no orders, no broker calls, and no strategy deployment from this surface.

Acceptance:

- Users can rank a supported universe by validated factor families and inspect each factor's contribution and data quality.
- Research output explains missing or stale inputs rather than silently scoring incomplete assets.
- Backend tests cover factor formulas, ranking, missing-data behavior, and deterministic output for seeded fixtures.

Validation:

- `py -m compileall backend`
- `py -m unittest discover -s backend/tests -p "test_*.py"`
- PowerShell parser check for `scripts/packaged_factor_lab_smoke.ps1`
- `npm run typecheck`
- `npm run build`
- `npm run tauri:build`
- `npm run smoke:factor-lab`
- `logs/factor-lab-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, `evaluated_count=10`, `result_count=10`, `ranked_count=10`, `selected_symbol=AAPL`, `selected_rank=3`, `selected_percentile=80.0`, `selected_bucket=leader`, `selected_score=84.5`, `selected_contribution_count=5`, `restored_after_restart=true`, `research_factor_context=true`, and `export_exists=true`.

### T35 - Strategy Backtesting And Paper Trading

Priority: P2  
Status: Completed

Scope:

- Add a local strategy lab that turns factor outputs into explicit strategy rules before any broker automation is introduced.
- Support a bounded first strategy set: long-only top-N factor rotation, rebalance interval, max position weight, cash reserve, benchmark comparison, and configurable transaction-cost/slippage assumptions.
- Run deterministic local backtests over cached historical data with clear warnings when history is incomplete, stale, or survivorship-biased.
- Add paper-trading mode that records simulated orders, fills, positions, cash, PnL, drawdown, and rule decisions in local SQLite without contacting a broker.
- Add strategy report export that includes factor definitions, rebalance rules, costs, data windows, performance, drawdown, turnover, and failure reasons.

Acceptance:

- Users can move from factor ranking to backtest to paper trading without leaving the desktop app.
- Backtest and paper-trading results are reproducible from the same local data and assumptions.
- No live order path exists in this task; all execution artifacts are simulated and clearly labeled as paper trading.

Completion evidence:

- Backend exposes additive `/api/v1/strategies/*` endpoints for templates, backtests, paper sessions, and report export.
- DuckDB persists strategy backtest snapshots; SQLite persists paper sessions, simulated orders, fills, positions, cash ledger, and rule decisions.
- Desktop Strategy Lab supports factor-run handoff, backtest setup, equity/benchmark charting, positions/trades, paper session launch, paper ledger display, and Markdown export.
- `logs/strategy-lab-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, `backtest_restored_after_restart=true`, `trade_count=5`, `paper_order_count=5`, `paper_fill_count=5`, `paper_ledger_count=6`, `no_live_orders=true`, `paper_no_live_orders=true`, and `export_exists=true`.

### T36 - Automated Binance Execution And Risk Controls

Priority: P1  
Status: Completed

Scope:

- Add live execution automation after T35 proves strategy rules through paper trading, scoped strictly to Binance trading.
- Implement the first live adapter as Binance-only because the project already has Binance provider credentials and private-account plumbing; do not add equity, ETF, macro, or other broker live-order adapters in this task.
- Support Binance automated order placement from approved crypto strategy rules with pre-trade checks: Binance provider availability, max order notional, max daily turnover, max position weight, cash/balance check, stale-data block, duplicate-order block, symbol allowlist, and per-strategy kill switch.
- Store Binance credentials only through the existing Stronghold-backed secret path or a stricter successor; never log API keys, secrets, account identifiers, or raw order auth payloads.
- Add a Binance live-trading enablement flow that requires explicit user configuration, visible risk acknowledgement, paper-trading evidence, and a default-off live mode. Development and validation must not place live trades on the user's behalf.
- Record every Binance signal, order intent, pre-trade decision, broker request result, fill, cancel, rejection, and kill-switch event in a local audit log.

Acceptance:

- A strategy can generate Binance live order intents and, when the user has explicitly enabled Binance live mode with their own Binance credentials, the app can submit Binance orders through the execution adapter.
- Risk controls can block stale data, oversized orders, duplicate orders, missing Binance credentials, unavailable Binance provider state, disallowed symbols, and kill-switched strategies before any Binance request is sent.
- Paper-trading and Binance live-trading ledgers share enough shape that live behavior can be compared against simulated expectations.

Completion evidence:

- Backend exposes additive `/api/v1/execution/binance/*` endpoints for config, intents, submit, kill switch, and audit without changing existing asset, factor, strategy backtest, or paper-session contracts.
- SQLite persists Binance execution config, execution intents, kill-switch state, and audit events; intent payloads carry sanitized order/fill/ledger evidence for live-vs-paper comparison.
- Desktop Strategy Lab now includes Live Execution controls for default-off status, risk config evidence, intent creation, risk-submit decisions, kill switch controls, recent intents, and audit trail.
- `backend/tests/test_execution_service.py` covers default-off blocking before adapter calls, missing credentials, provider unavailable, stale data, notional/turnover/weight/balance/duplicate/allowlist/kill-switch risk blocks, eligible mock submit order/fill/ledger/audit, and API flow.
- `logs/binance-execution-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, `config_live_enabled=false`, `submit_status=blocked`, `blocked_checks=["live_mode","risk_acknowledgement"]`, `live_order_recorded=false`, and `audit_restored_after_restart=true`.

### T37 - Factor-Aware Research, Screening, And Execution Reports

Priority: P2  
Status: Completed

Scope:

- Connect portfolio analytics, factor research, strategy backtests, paper trading, and Binance live execution evidence back into Research, Screeners, and command-palette workflows.
- Add factor score and factor contribution surfaces to screeners without breaking the existing `/api/v1/screeners/*` contract.
- Extend research briefs with factor exposure, strategy fit, backtest summary, paper/Binance-live execution state, and data-quality notes.
- Export evidence-backed reports that include factor definitions, source timestamps, provider capability states, backtest assumptions, paper/Binance-live execution ledgers, risk-control blocks, and chart/table sources.
- Keep visible copy careful: reports should say what the model observed and did, not promise returns or present automated execution as financial advice.

Acceptance:

- Users can trace a Binance automated order from factor signal to strategy rule to backtest/paper evidence to Binance live order audit event.
- Screeners and research briefs can explain why a symbol is selected, what factor evidence supports it, and whether execution is blocked or enabled.
- Exported reports are locally reproducible and include enough evidence to review decisions after the fact.

Completion evidence:

- `backend/app/services/evidence_service.py` composes recent or explicitly selected factor, screener, backtest, paper-session, Binance execution, and audit evidence into a single read-only snapshot.
- Research exports now include an Evidence Chain section; strategy exports include factor definitions/source timestamps and linked execution/audit evidence.
- `backend/tests/test_research_service.py` covers full API evidence-chain creation/export, and `logs/evidence-report-smoke-latest.json` records successful packaged restart restoration.

### T38 - Desktop UI Information Architecture

Priority: P2  
Status: Completed

Scope:

- Redesign the app-level information architecture before changing styling: navigation, top status, main workspace, right context panel, command entry, and global context state.
- Map current pages to the new shell structure: Dashboard, Asset, Research, Factor Lab, Strategy Lab, Portfolio, Connections, Settings, plus future Workflow and Data Sources surfaces.
- Define global context rules for active symbol, active research brief, active factor run, active backtest, active paper session, active Binance intent, provider health, and language.
- Document responsive rules for the packaged minimum window size so the UI can become denser without text overlap.
- Keep this task structural only; visual styling, language dictionaries, and page-level rebuilds are separate tasks.

Acceptance:

- A concrete shell/layout spec exists and identifies the frontend files to change.
- The plan supports both Chinese and English text lengths before styling begins.
- No execution behavior, provider behavior, or live trading behavior changes in this task.

Completion evidence:

- Added `docs/desktop-ui-information-architecture.md`.
- The spec documents the four target shell regions, current and future workspace map, global context rules, responsive rules, and file ownership for T39/T40/T41.
- Static validation reviewed `src/App.tsx`, `src/store/app-store.ts`, and `src/views/*.tsx`; no runtime/build smoke was required because T38 changed documentation and task-board state only.

### T39 - Desktop Visual Design System Refresh

Priority: P2  
Status: Completed

Scope:

- Replace the current rough desktop styling with a professional financial-terminal design system.
- Define tokens for color, spacing, typography, table density, chart panels, status badges, risk states, and action buttons.
- Rework shared shell components first: sidebar/navigation, header/status area, command entry, panels, tables, cards, empty states, loading states, and error states.
- Add display density modes: compact and standard.
- Keep the palette restrained and multi-hue; avoid a one-note dark-blue/purple/gradient look.

Acceptance:

- Core shell screens look coherent and professional at desktop minimum size and wide desktop size.
- Shared components no longer rely on one-off page styling for basic terminal surfaces.
- Compact mode shows more financial data without unreadable text or overlapping controls.
- Playwright screenshots are captured for at least Dashboard, Asset, Research, Strategy Lab, Portfolio, and Connections.

Completion evidence:

- `src/styles.css` now defines reusable terminal tokens for backgrounds, panels, borders, text hierarchy, charts, status/risk/cache states, focus rings, control radius, and density spacing.
- `src/App.tsx` marks the shell with `density-standard`, and `src/styles.css` also defines `.density-compact` so the later T40 preference work can persist density without redesigning the component layer.
- The visual refresh remains additive to the existing shell and page class names, preserving navigation, workspace rendering, and automation-safe `aria-label` anchors.
- `scripts/visual_design_smoke.mjs` and `npm run smoke:visual-design` now capture Dashboard, Asset, Research, Strategy Lab, Portfolio, and Connections at `desktop-min` and `desktop-wide` sizes.
- `logs/visual-design-screenshots/visual-design-smoke-latest.json` recorded `failures=[]`, `viewport_count=2`, `page_count=6`, and `screenshot_count=12`.
- Validation passed: `npm run typecheck`, `npm run build`, `npm run smoke:visual-design`, and `npm run smoke:portfolio-ui-signoff`.

### T40 - Chinese/English Localization Foundation

Priority: P2  
Status: Completed

Scope:

- Added a lightweight typed frontend localization layer in `src/i18n/index.ts` rather than introducing a new third-party i18n framework.
- Extended existing settings preferences with persisted `language` and `density` fields while keeping `/api/v1/settings/preferences` compatible.
- Localized the main shell/navigation/topbar/setup banners, shared status badge labels, Settings normal flow, and Command Palette frame copy.
- Restored readable runtime network error copy in `src/lib/api.ts`.
- Preserved stable ASCII automation anchors and left deeper page-level business copy/table polish for T41.

Acceptance:

- Settings can switch between `zh-CN` and `en-US` without rebuilding the app and can save the preference for restart restore.
- Settings can switch between `standard` and `compact` density using the T39 density tokens.
- Shell, Settings, and Command Palette common flows now read from the dictionary instead of hardcoded visible copy.
- Existing backend/API tests remain compatible because route shapes do not change.

Evidence:

- `backend/tests/test_settings_service.py` covers default `zh-CN` / `standard` preferences and persisted `en-US` / `compact` restore.
- `logs/localization-smoke-latest.json` recorded `failures=[]` across the localization contract checks.
- Validation passed: `py -m compileall backend`, `py -m unittest discover -s backend/tests -p "test_*.py"`, `npm run typecheck`, `npm run build`, and `npm run smoke:localization`.

### T41 - Core Page UI Polish Pass

Priority: P2  
Status: Completed

Scope:

- Applied the T39 design system and T40 localization foundation to the highest-traffic pages, using the local Fincept Terminal repo as the benchmark for terminal-style workspace density and screen-level completeness.
- Polished Dashboard, Asset, Research, Strategy Lab, Portfolio, Connections, and Settings with more consistent panels, metric strips, chart areas, tables/lists, status copy, controls, empty/error states, and visible primary workflows.
- Kept T41 as a product-surface pass only: no backend schema, provider behavior, workflow execution, trading behavior, or data-source behavior changed.
- Kept the shell ready for future `Workflow Studio` and `Data Sources` entries by tightening navigation/topbar/page density without adding those routes in T41.
- Preserved `/api/v1/...` contracts and automation-safe `aria-label` anchors such as `nav-*`, `search-asset`, `portfolio-*`, `connection-*`, and smoke anchors.
- Added a focused bilingual page-polish screenshot smoke without replacing the existing `smoke:visual-design` flow.

Acceptance:

- Each core page has a clear primary workflow and no obvious visual overlap at minimum packaged window size.
- Chinese and English both fit in buttons, tabs, panels, tables, and status badges.
- Page-level tables, panels, metric strips, chart areas, and action controls use the T39 density tokens and T40 dictionary rather than one-off styling or hardcoded mixed-language copy.
- Playwright screenshots cover both languages for at least the shell, Dashboard, Research, Strategy Lab, Portfolio, Connections, and Settings.
- T41 records a short page-by-page gap list for any Fincept-like workspace breadth that should become a later task instead of being squeezed into page polish.

Evidence:

- `src/i18n/index.ts` now carries expanded page-level dictionary coverage for the polished surfaces.
- `src/components/shared.tsx` now localizes shared panel/chart/status states and supports async retry actions safely.
- `src/views/dashboard-view.tsx`, `src/views/asset-view.tsx`, `src/views/settings-view.tsx`, and `src/App.tsx` were updated for the page-polish pass while preserving behavior and anchors.
- `src/styles.css` now uses the existing density tokens for tighter terminal spacing, reduced panel/control radius, and Dashboard/Asset layout helpers.
- `scripts/page_polish_smoke.mjs` plus `npm run smoke:page-polish` captures bilingual page evidence and restores the original preferences after the run.
- Screenshot scope: Dashboard, Research, Strategy Lab, Portfolio, Connections, and Settings in `zh-CN` and `en-US` at `desktop-min` and `desktop-wide`; latest result is `logs/page-polish-screenshots/page-polish-smoke-latest.json` with `screenshot_count=24` and `failures=[]`.
- Validation passed: `npm run typecheck`, `npm run build`, `npm run smoke:localization`, `npm run smoke:visual-design`, `npm run smoke:page-polish`, and `npm run smoke:portfolio-ui-signoff`.
- Fincept-like breadth gaps left after T41: Workflow automation remained `T42-T44`, and first-class Data Sources Center remained `T45-T47`. `T42` is now complete, leaving Workflow Studio UI/signoff to `T43-T44`.

### T42 - Workflow Engine Backend

Priority: P1  
Status: Completed

Scope:

- Added a local workflow service that runs predefined workflow templates by calling existing services instead of duplicating research, factor, strategy, portfolio, or execution logic. This is the first backend step toward the Fincept-style Workflow / Node Editor gap, while the first Pengbo release stays template-driven rather than a full free-form node canvas.
- Persisted workflow runs in SQLite with template key, step statuses, inputs, outputs, artifact IDs, timestamps, errors, blocked reasons, audit events, and manual-confirmation requirements.
- Seeded safe workflow templates:
  - screener result to research brief
  - research brief to factor run
  - factor run to strategy backtest
  - backtest to paper session
  - paper session to Binance execution intent
  - evidence report export
- Added action policy categories: `read_only`, `local_analysis`, `local_simulation`, `binance_intent`, and `user_confirmed_binance_submit`.
- Ensured workflow automation can create Binance preset live-order intents and request a user confirmation modal, but cannot submit unless the user explicitly clicks approve.
- Added explicit step provenance so later reports can show which provider/source/artifact produced each workflow output.

Acceptance:

- Backend can run each workflow template through API calls and persist a restart-safe run history.
- Failed, blocked, and manual-required steps are explicit and inspectable.
- Workflow run output links back to generated research briefs, factor runs, backtests, paper sessions, Binance intents, audit records, and evidence reports.
- Workflow automation cannot change live mode, clear kill switches, or silently acknowledge risk; Binance live submit can occur only after the workflow-created preset order is shown in a confirmation modal and the user explicitly clicks approve.

Evidence:

- `backend/app/services/workflow_service.py` implements the template-driven engine.
- `backend/app/storage/sqlite_store.py` now persists `workflow_runs`.
- `backend/app/api/routes.py` exposes additive `/api/v1/workflows/*` routes.
- `backend/tests/test_workflow_service.py` covers templates, API creation, restart restore, blocked/manual states, artifact refs, and Binance no-submit boundaries.
- Validation passed: `py -m compileall backend`, `py -m unittest discover -s backend/tests -p "test_*.py"`, `npm run typecheck`, and `npm run build`.
- No new T42 blocker task was added; that pass originally advanced the workflow lane to `T43 - Workflow Studio UI`, which is now completed.

### T43 - Workflow Studio UI

Priority: P1  
Status: Completed

Scope:

- Added a dedicated Workflow Studio surface in the desktop shell, positioned as Pengbo's first practical answer to Fincept's Node Editor / workflow tooling without taking on a full drag-and-drop graph editor in v1.
- Shows workflow templates, fixed input forms, step timeline, blocked/manual-required states, artifact links, recent runs, audit events, and protected manual-boundary copy.
- Added workflow-aware command-palette entry and recent-run handoff into Workflow Studio.
- Added artifact navigation into Research, Factor Lab, Strategy Lab backtests/paper sessions, and Binance intent context without adding a direct submit path.
- Uses the localized design system from T39/T40/T41 and preserves stable ASCII automation anchors.

Acceptance:

- Users can run the safe chain from screener/research/factor/backtest/paper to Binance intent from one UI surface.
- Workflow Studio clearly distinguishes completed, failed, blocked, and manual-required steps.
- Generated artifacts are navigable from the workflow run into Research, Factor Lab, Strategy Lab, and execution evidence without losing active context.
- Workflow Studio can show the protected confirmation boundary for a prepared Binance preset live-order intent, but no T43 UI path silently submits, changes live mode, clears kill switches, or acknowledges risk.

Completion evidence:

- `src/views/workflow-studio-view.tsx` implements the Workflow Studio workspace backed by `/api/v1/workflows/*`.
- `src/lib/api.ts`, `src/store/app-store.ts`, `src/App.tsx`, `src/i18n/index.ts`, and `src/views/settings-view.tsx` now treat `workflowStudio` as a first-class workspace/default-view option.
- `scripts/workflow_studio_smoke.mjs` plus `npm run smoke:workflow-studio` records template loading, run creation, manual-required state, `binance_intent` artifact evidence, reload restore, screenshot capture, and console health in `logs/workflow-studio-smoke/workflow-studio-smoke-latest.json`.
- `scripts/page_polish_smoke.mjs` now captures Workflow Studio in both languages and both desktop viewports; latest `logs/page-polish-screenshots/page-polish-smoke-latest.json` records `page_count=7`, `screenshot_count=28`, and `failures=[]`.
- Validation passed: `py -m compileall backend`, `py -m unittest discover -s backend/tests -p "test_*.py"`, `npm run typecheck`, `npm run build`, `npm run smoke:workflow-studio`, and `npm run smoke:page-polish`.

### T44 - Workflow Packaged Signoff

Priority: P3  
Status: Completed

Scope:

- Add packaged smoke automation for workflow creation, step execution, restart restore, Binance preset live-order confirmation boundary, and evidence export.
- Reuse the existing packaged runtime backup/restore pattern so workflow tests do not mutate the user's real AppData state.
- Record a workflow smoke artifact under `logs/`.

Acceptance:

- Packaged smoke proves workflow history restores after restart.
- Packaged smoke proves workflow automation can create a Binance preset live-order intent, show the confirmation-required state, and avoid submit until explicit simulated user approval is provided.
- Evidence report export exists and links the generated workflow artifacts.

Completion evidence:

- `scripts/packaged_workflow_studio_smoke.ps1` and `npm run smoke:workflow-studio:packaged` now validate Workflow Studio through the real `src-tauri/target/release/pengbo-workbench.exe` window with Windows UIAutomation.
- `npm run tauri:build` refreshed the release EXE, sidecar, MSI, and NSIS artifacts on 2026-05-12.
- Latest packaged result in `logs/workflow-studio-packaged-smoke-latest.json` records `health_ready=true`, `template_count=6`, `run_status=blocked`, `manual_required=true`, `manual_policy=user_confirmed_binance_submit`, `binance_intent_artifact_count=1`, `evidence_export_status=completed`, `evidence_export_exists=true`, `recent_restored_after_restart=true`, and `failures=[]`.
- Validation passed: PowerShell parser check for `scripts/packaged_workflow_studio_smoke.ps1`, `npm run typecheck`, `npm run tauri:build`, and `npm run smoke:workflow-studio:packaged`.

### T45 - Data Source Expansion Foundation

Priority: P1  
Status: Completed

Scope:

- Extend the provider capability catalog so new sources can describe asset coverage, credential requirements, rate-limit notes, cache behavior, locale/region, supported data domains, freshness, provenance, and testability.
- Define provider interfaces for market data, macro data, China/Asia data, crypto public data, news/events, fundamentals, and research signals.
- Add source freshness and provenance fields so UI/report surfaces can show where data came from and when it was fetched.
- Treat this as the foundation for a Fincept-like Data Sources Center: connectors should be discoverable, testable, explainable, and visible from UI/report surfaces rather than hidden inside individual services.
- Keep all new providers read-only unless they are Binance execution paths already covered by `/api/v1/execution/binance/*`.

Acceptance:

- Adding a new read-only provider does not require page-specific capability hacks.
- UI and reports can show source name, freshness, credential status, and unsupported states consistently.
- Provider test results and recent fetch health can be recorded in a common shape for the later Data Sources UI.
- No new provider introduces a live trading API.

Completion evidence:

- Added additive provider source metadata models for catalog providers and capabilities: domains, coverage, regions/locales, credential notes, rate-limit notes, cache policy, freshness, provenance, testability, `read_only`, and `live_trading`.
- Replaced the hard-coded capability table with a provider source registry for `market`, `fundamentals`, `edgar`, and `binance`, while preserving the existing `/api/v1/connections/catalog` route and legacy response fields.
- Updated public read-only provider testing so `market` and `fundamentals` do not appear as missing-credential providers; their test result now records `planned`, while unknown providers return `unsupported`.
- Added lightweight source-contract rendering to the Connections provider cards without adding the dedicated Data Sources workspace reserved for T47.
- Validation passed: `py -m unittest backend.tests.test_capability_service`, `npm run typecheck`, `py -m unittest discover -s backend/tests -p "test_*.py"`, and `npm run build`.

### T46 - Initial Data Source Connector Pack

Priority: P1  
Status: Completed

Scope:

- Add a first connector pack focused on more information coverage:
  - FRED for macro series.
  - DBnomics/OECD/World Bank or IMF for broader economics.
  - AkShare for China/Asia market and macro coverage where stable.
  - CoinGecko for crypto public market context.
  - RSS/event-source ingestion for market news and company/event monitoring.
- Favor connectors that close visible terminal gaps exposed by the Fincept benchmark: macro/economics breadth, China/Asia coverage, public crypto context, and news/event monitoring.
- Keep provider failures cache-aware and visible instead of breaking pages.
- Prefer sources with clear free/public access for the first pass; API-key sources can be optional.

Acceptance:

- At least three new read-only sources are available through backend provider capability status.
- Asset, Research, or Data Sources surfaces can display new source output or explicit unavailable/unsupported states.
- New source payloads carry enough provenance/freshness metadata to be used in research and evidence reports.
- Tests cover successful fetch, cached fallback where applicable, and provider unavailable handling.
- No new provider introduces a live trading API.

Completion evidence:

- Added and validated read-only data-source runtime paths for World Bank macro series, DBnomics macro series, RSS/news events, optional-key FRED macro series, and optional-key CoinGecko public crypto market context.
- `backend/tests/test_data_source_service.py` now covers provider status listing, successful fetch, cached fallback, missing credentials, unavailable-without-cache handling, FRED API-key masking, CoinGecko demo-key header use, and RSS symbol extraction.
- The connector pack keeps provenance/freshness metadata on returned macro, crypto, and event payloads, including stale/unavailable reason fields when cached fallback is used.
- Safety boundary remained intact: all catalog providers are `read_only=true` and `live_trading=false`, and the T46 data-source files do not add live submit, risk acknowledgement, or kill-switch mutation paths.
- Validation passed: `py -m unittest backend.tests.test_data_source_service backend.tests.test_capability_service`, `py -m unittest discover -s backend/tests -p "test_*.py"`, `npm run typecheck`, and `npm run build`.
- `npm run build` passed with the existing Vite large-chunk warning only. No new blocker task was discovered; the next planned task is `T47 - Data Sources UI And Signoff`.

### T47 - Data Sources UI And Signoff

Priority: P2  
Status: Completed

Scope:

- Add a dedicated Data Sources surface that shows provider coverage, credentials, freshness, source domains, connector tests, recent fetch status, cache behavior, and report/research applicability.
- Expose new macro, China/Asia, crypto public, news/event, and fundamentals sources in a user-understandable way.
- Add packaged smoke coverage for provider capability rendering and at least one new source-backed research or data view.
- Keep EDGAR/Binance credential workflows intact while presenting read-only data sources as a broader terminal capability area.

Acceptance:

- User can see which data sources are active, missing credentials, rate-limited, cached, unsupported, or unavailable.
- Research/report output includes source provenance for newly added data.
- Data Sources feels like a first-class workspace rather than an expanded settings panel.
- Packaged signoff confirms new provider UI does not regress existing EDGAR/Binance credential workflows.

Completion evidence:

- `src/views/data-sources-view.tsx` now renders provider coverage, credential requirement/configuration, freshness, domains, cache policy, testability, rate-limit notes, provenance, stale/unavailable state, and explicit read-only/no-live-trading contract markers.
- `src/i18n/index.ts` contains the Data Sources page copy for both `zh-CN` and `en-US`, preserving the existing language preference mechanism.
- `POST /api/v1/data-sources/reports/export` writes a read-only Markdown report with included source summaries and provenance details; latest packaged export path: `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench\diagnostics\reports\data-sources-2026-05-13T183350.513682z0000.md`.
- `scripts/packaged_data_sources_smoke.ps1` and `npm run smoke:data-sources:packaged` validate the real release EXE with AppData backup/restore, UIAutomation anchors, `/data-sources/status`, `/connections/catalog`, and report export file creation.
- Latest packaged Data Sources smoke artifact: `logs/data-sources-packaged-smoke-latest.json` with `provider_count=5`, `report_source_count=5`, `report_export_exists=true`, and `failures=[]`.
- Latest provider capability signoff artifact: `logs/provider-capability-signoff-latest.json` with `failures=[]`, confirming EDGAR/Binance credential workflow non-regression.
- Validation passed:
  - `py -m unittest backend.tests.test_data_source_service`
  - `py -m unittest discover -s backend/tests -p "test_*.py"`
  - `npm run typecheck`
  - `npm run build`
  - `npm run smoke:page-polish`
  - `npm run tauri:build`
  - `npm run smoke:data-sources:packaged`
  - `npm run smoke:provider-capability-signoff`
- No new blocker task was discovered.

### T17 - Packaged Startup Regression Automation

Priority: P2  
Status: Completed

Scope:

- Add a repeatable packaged-app smoke check for cold launch, runtime badge state, and first-screen health recovery.
- Capture the startup contract that `T16` restored so future packaging or shell changes do not silently reintroduce false offline state.
- Reuse packaged diagnostics/log artifacts where possible instead of inventing a separate telemetry path.

Acceptance:

- A documented or scripted smoke path exists for packaged cold launch plus sidecar restart recovery.
- Future regressions in startup state reconciliation are caught before release packaging is signed off.

### T19 - Portfolio Offline Regression Automation

Priority: P2  
Status: Completed

Scope:

- Add a repeatable packaged smoke path for a seeded portfolio across online, offline-with-cache, and offline-cold-cache scenarios.
- Assert that transactions remain available while holdings/summary move through `live`, `cached`, and `unavailable` semantics.
- Reuse the same temporary runtime-data backup/restore pattern used during the final `T12` validation so the smoke path does not permanently mutate local desktop data.

Acceptance:

- A documented or scripted packaged smoke flow exists for seeded portfolio offline validation.
- The smoke path verifies `missing_symbols`, benchmark fallback status, and continued transaction availability before future portfolio releases are signed off.

### T18 - Localization Hardening

Priority: P3  
Status: Completed

Scope:

- Normalize the remaining user-visible English coming from backend/provider response payloads, runtime metadata, and legacy fallback copy.
- Clean up mojibake or incorrectly encoded checked-in Chinese UI strings that still appear in shared shell surfaces such as navigation and status helpers.
- Decide whether the project should stay Chinese-first or introduce a lightweight i18n layer for future bilingual support.
- Keep number, date, and status formatting consistent with the chosen locale across all desktop surfaces.

Acceptance:

- The packaged desktop shell no longer exposes obvious hardcoded English in normal user flows.
- Shared shell copy no longer shows obvious mojibake or broken encoding in normal startup and navigation flows.
- Locale-sensitive formatting behaves consistently across dashboard, connections, portfolio, and settings views.

### T20 - Residual Packaging Warning Trim

Priority: P3  
Status: Completed

Scope:

- Investigate the remaining `pandas` / `yfinance` driven `SciPy` warning residue that still appears in the packaged sidecar build report after `T13`.
- Decide whether those last warning lines can be removed safely through narrower dependency hooks or by replacing the remaining heavyweight upstream path without regressing the current asset workspace payload.
- Keep the current `warning_categories` reporting so any further reduction remains measurable and reversible.

Acceptance:

- `logs/sidecar-build-latest.json` no longer reports the current residual `scipy.stats` / `scipy.sparse` warning trio as actionable, or the team has a documented reason they are intentionally accepted.
- Any additional trim keeps `AAPL` packaged asset workspace smoke passing with overview plus 6 ratios.

### T21 - Installed Bundle Startup Automation

Priority: P3  
Status: Completed

Scope:

- Extend the new T17 startup automation beyond the release EXE path so an MSI-installed desktop launch is also covered.
- Verify that the installed app still reaches healthy `/health`, keeps the single-instance contract, and writes logs and runtime data to the expected Tauri AppData roots.
- Reuse the existing packaged startup smoke assertions and result-file shape instead of creating a separate installer-only harness.

Acceptance:

- A documented or scripted smoke path exists for an MSI-installed packaged desktop binary, not only `src-tauri/target/release/pengbo-workbench.exe`.
- MSI-backed startup validation confirms healthy AppData paths, single-instance behavior, and adopt-existing handling before release signoff.

### T23 - NSIS Installed Startup Automation

Priority: P3  
Status: Completed

Scope:

- Extend the new T21 installed-startup automation beyond the MSI path so the NSIS-installed desktop lifecycle is also covered.
- Verify that the NSIS-installed app resolves the installed EXE path correctly, reaches healthy `/health`, and preserves the single-instance plus adopt-existing startup contracts.
- Reuse the existing installed-startup result shape where possible so MSI and NSIS results stay comparable.

Acceptance:

- A documented or scripted smoke path exists for the NSIS-installed packaged desktop binary.
- NSIS-backed startup validation confirms healthy startup and AppData behavior without regressing the now-stable MSI path.

### T22 - Portfolio Packaged UI State Signoff

Priority: P3  
Status: Completed

Scope:

- Add a lightweight packaged-shell signoff pass for the portfolio page across `ready`, `cached`, and `unavailable` states using the seeded runtime flow established by `T19`.
- Verify that packaged portfolio banners, degraded notes, empty-state guidance, and transaction affordances stay aligned with the backend/runtime semantics under each state.
- Reuse the T19 backup/restore and seeded-data flow instead of inventing a separate portfolio fixture path.

Acceptance:

- A repeatable packaged validation flow exists for visible portfolio-shell state handling, not only API-layer regression checks.
- Future regressions in portfolio surface copy or state rendering can be distinguished from sidecar/API regressions before release signoff.

## Completed Work

### Foundation And Desktop Runtime

- T01 - Task tracking and execution logging
- T02 - React + Vite desktop shell
- T03 - Desktop visual system
- T04 - FastAPI sidecar API surface
- T05 - Frontend dependency install and build validation
- T06 - Python sidecar syntax and startup validation
- T07 - Tauri 2 shell, sidecar lifecycle, Stronghold, runtime config, and desktop build path
- T08 - SQLite and DuckDB persistence foundation
- T09 - Real providers wired into dashboard, asset, settings, connections, portfolio, and screener flows
- T10 - Desktop onboarding, diagnostics export, runtime recovery actions, and packaged first-run guidance
- T11 - Provider UX hardening, masked credential summaries, cache freshness surfaces, and clear-credential UX
- T12 - Offline-first portfolio hardening completed with nullable valuation fields, degraded summary notes, benchmark independence, runtime-gated portfolio loading, manual symbol fallback, and packaged online/offline smoke validation.
- T14 - Screener quality expansion completed with a controlled expanded universe, score-ranked preset profiles, explanations, missing-metric reporting, and a lightweight desktop UI upgrade.
- T34 - Local factor research lab completed with additive factor APIs, DuckDB snapshot persistence, a dedicated desktop Factor Lab, research handoff/export context, and packaged smoke validation.

### Packaging Stabilization And Provider Hardening

- Added a bootstrap sidecar entrypoint instead of freezing `backend/app/cli.py` directly.
- Added deterministic startup and bootstrap logging.
- Replaced Binance `ccxt` usage with a lighter REST path while preserving current response shape.
- Tightened PyInstaller collection and emitted build metrics.
- Fixed packaged EDGAR collection so the bundled sidecar now includes `edgar` reference data.
- Fixed provider reset-state handling so cache freshness does not leak back into unconfigured cards.
- T13 - Packaging noise reduction completed with a lighter Yahoo-based fundamentals path, a `117.8 MB` packaged sidecar, faster sidecar builds, and categorized build-warning reporting.
- T20 - Residual packaging warning trim completed with the residual SciPy trio reclassified into `accepted_packaging_noise`, explicit per-line reasons captured in `logs/sidecar-build-latest.json`, and a regression test guarding the warning classifier.
- T15 - Packaged EDGAR + Binance live signoff completed at the runtime/provider layer, including live success, cached fallback, and reset validation.
- T16 - Desktop runtime status reconciliation completed at the code/package-validation layer, including runtime-first request gating, desktop fetch retry/recovery, clearer sidecar startup messaging, packaged bootstrap health logging, and duplicate-launch single-instance protection.
- T16 - Follow-up packaged runtime hardening also covers orphan-sidecar adoption on `127.0.0.1:8765` plus process-tree cleanup for owned sidecar launches.
- T16 - Follow-up packaged startup hotfix also covers calmer first-boot retry behavior, onefile child-exit reconciliation against live `/health`, and Tauri 2 localhost CORS coverage for packaged WebView requests.
- T17 - Packaged startup regression automation completed with a scripted cold-launch smoke, API and bootstrap-log assertions, single-instance verification, and adopt-existing coverage captured in `logs/packaged-startup-smoke-latest.json`.
- T19 - Portfolio offline regression automation completed with a scripted seeded packaged smoke, AppData runtime backup/restore, proxy-forced cache/cold-cache validation, and result capture in `logs/portfolio-offline-smoke-latest.json`.

## Latest Verification Snapshot

- `py -m compileall backend`
- `py -m unittest discover -s backend/tests -p "test_*.py"`
- `npm run sidecar:build`
- `npm run typecheck`
- `npm run build`
- `npm run tauri:build`
- `npm run smoke:packaged-startup`
- `npm run smoke:installed-startup`
- `npm run smoke:installed-startup:nsis`
- `npm run smoke:portfolio-offline`
- `npm run smoke:portfolio-ui-signoff`
- `npm run smoke:screener-variant-signoff`
- `npm run smoke:factor-lab`
- `npm run smoke:strategy-lab`
- `npm run smoke:binance-execution`
- `npm run smoke:provider-capability-signoff`
- packaged double-launch regression check on `src-tauri/target/release/pengbo-workbench.exe`
- packaged Simplified Chinese UI pass rebuilt on the latest EXE/MSI/NSIS outputs
- 2026-04-18 packaged cold-launch regression fix rebuilt and rechecked on `src-tauri/target/release/pengbo-workbench.exe`
- T14 screener verification:
  - `backend/tests/test_screener_service.py` now covers expanded-universe selection, score ordering, provider-data fallback, and API rejection for invalid `universeSource`
  - the screener API now returns `evaluated_count`, `universe_label`, `score`, `score_label`, and `explanations` without changing the `/api/v1/screeners/*` route set
  - the desktop screener UI now builds successfully with the expanded-universe selector plus ranked result rendering
- T24 screener configurable-profile verification:
  - `backend/tests/test_screener_service.py` now also covers default variant seeding, variant CRUD and activation, system-default delete protection, variant-key scoring differences, and API coverage for the new screener variant endpoints
  - the screener API now preserves the existing preset/run routes while adding optional `variantKey`, active-variant summaries on presets, and dedicated variant CRUD/activate endpoints
  - the desktop screener UI now builds successfully with the new preset-selection, variant-management, controlled-tuning, and run-attribution workflow
- T25 screener packaged signoff verification:
  - `logs/screener-variant-signoff-latest.json` recorded `health_ready=true` with `failures=[]`
  - `initial_run` showed `custom-b61133ad` active/selected, 3 summary markers, `evaluated_count=10`, `hit_count=8`, and packaged run attribution under `universe=expanded`
  - `after_restart` restored the same custom variant plus the same summary markers after a full packaged relaunch
  - `after_delete` fell back to `default`, restored the system-default summary markers, and API run attribution returned `variant_key=default`
- T26 research workspace verification:
  - `backend/tests/test_research_service.py` now covers durable brief creation, recent-brief listing, notes persistence, Markdown export, and API create/read/update/export coverage
  - the desktop shell now builds successfully with a dedicated `research` workspace plus screener-to-research and research-to-portfolio handoff flows
  - `logs/research-workspace-smoke-latest.json` recorded `health_ready=true` with `failures=[]`, created `brief-a735821c40c8` for `AAPL`, restored notes after relaunch, and confirmed export creation under `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench\diagnostics\reports`
- T27 analysis module registry verification:
  - `backend/tests/test_analysis_registry.py` now covers registry resolution plus full envelope generation for the four built-in analysis modules
  - `backend/tests/test_research_service.py` now also covers additive `analysis_modules` output on create/read plus Markdown export content for the new structured analysis section
  - the desktop research workspace now builds successfully with shared analysis cards rendered from `analysis_modules` instead of per-module ad hoc TSX
  - `logs/research-workspace-smoke-latest.json` recorded `health_ready=true` with `failures=[]`, created `brief-6e2d9c8aac4c` for `AAPL`, captured `analysis_module_count=4`, preserved the same module set after relaunch, and confirmed export creation under `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench\diagnostics\reports`
- T28 provider capability catalog verification:
  - `backend/tests/test_capability_service.py` now covers the 4-provider / 7-capability catalog mapping, credential-gated EDGAR behavior, unsupported crypto fundamentals, and temporarily-unavailable supported equity fundamentals
  - `backend/tests/test_research_service.py` now validates the additive capability status/message fields carried through research brief snapshots
  - the backend API now exposes `GET /api/v1/connections/catalog` while preserving the existing `/api/v1/connections/status` and `/api/v1/assets/*` contracts
  - the desktop shell now builds successfully with a provider capability matrix in Connections plus explicit availability-state rendering in Asset and Research
- T30 provider capability packaged signoff verification:
  - `logs/provider-capability-signoff-latest.json` recorded `health_ready=true` with `failures=[]`
  - `baseline` kept packaged EDGAR filings in `credential_required` while `market/quotes` remained `available` and the unsupported sample stayed `fundamentals=unsupported` plus `filings=unsupported`
  - `after_identity_save` verified packaged EDGAR filings moved to `available` for the AAPL capability path
  - `after_identity_clear` verified the same packaged EDGAR path returned to `credential_required`
  - this T30 baseline originally used `SPY` as the unsupported sample while `BTC/USDT` quote flakiness was still noisy; the later T31/T32 smoke restores `BTC/USDT` with quote-state tolerance
- T31/T32 credential workflow and WebView input adapter verification:
  - `logs/provider-capability-signoff-latest.json` recorded `health_ready=true` with `failures=[]`
  - `credential_input_adapter.value_verified=true`, with the EDGAR identity value omitted from the result artifact
  - `baseline.connections.edgar_filings_status=credential_required`
  - `after_identity_save.connections.edgar_filings_status=available`
  - `after_identity_save.post_restart_edgar_status=available`
  - `after_identity_clear.connections.edgar_filings_status=credential_required`
  - `BTC/USDT` is restored as the unsupported crypto sample, with fundamentals and filings asserted as `unsupported` while quote availability is tracked separately
- T33 portfolio analytics and professional charting verification:
  - `backend/tests/test_portfolio_service.py` now covers additive analytics windows, benchmark fallback selection, average-cost realized/unrealized PnL, allocation buckets, and unavailable-window degradation.
  - `logs/portfolio-offline-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, `analytics_windows_count=5`, and `analytics_pnl_method=average_cost` across online, offline-with-cache, and offline-cold-cache scenarios.
  - `logs/portfolio-ui-signoff-latest.json` recorded `health_ready=true`, `failures=[]`, stable `portfolio-view state=*` markers, stable portfolio pill markers, `AAPL` holding markers for `live`, `cached`, and `unavailable`, and enabled transaction-submit markers.
  - the desktop portfolio UI now renders the professional chart layer, analytics window controls, PnL strip, and allocation tabs while preserving existing portfolio CRUD and offline semantics.
- T34 local factor research lab verification:
  - `backend/tests/test_factor_service.py` now covers factor ranking, snapshot persistence, recent-run listing, API run creation, research handoff, and Markdown export factor-context content.
  - the backend API now exposes additive `/api/v1/factors/families`, `/api/v1/factors/runs`, `/api/v1/factors/runs/recent`, and `/api/v1/factors/runs/{run_id}` without changing stable asset, screener, research, or portfolio payloads.
  - the desktop Factor Lab now builds successfully with run setup controls, recent persisted snapshots, ranked factor rows, contribution details, chart context, diagnostics, and `factor-open-research` handoff anchors.
  - `logs/factor-lab-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, run `factor-c2e6068aecb4`, `evaluated_count=10`, `result_count=10`, `ranked_count=10`, selected `AAPL` at rank `3`, percentile `80.0`, `selected_bucket=leader`, `selected_score=84.5`, `selected_contribution_count=5`, `restored_after_restart=true`, `research_factor_context=true`, and `export_exists=true`.
- T35 strategy backtesting and paper trading verification:
  - `backend/tests/test_strategy_service.py` now covers strategy template/API flow, backtest persistence and restore, report export, paper orders/fills/cash ledger, and no-live-order assertions.
  - the backend API now exposes additive `/api/v1/strategies/templates`, `/api/v1/strategies/backtests`, `/api/v1/strategies/backtests/recent`, `/api/v1/strategies/backtests/{run_id}`, `/api/v1/strategies/paper/sessions`, `/api/v1/strategies/paper/sessions/recent`, `/api/v1/strategies/paper/sessions/{session_id}`, and `/api/v1/strategies/reports/{artifact_id}/export` without changing stable asset, factor, research, or portfolio payloads.
  - the desktop Strategy Lab now builds successfully with factor-run selection, backtest controls, equity/benchmark charting, positions/trades, diagnostics, paper-session launch, local paper ledger display, and `strategy-*` automation anchors.
  - `logs/strategy-lab-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, `factor_run_id=factor-d567dc44ae18`, `backtest_run_id=strategy-c87ff2ff1b09`, `backtest_restored_after_restart=true`, `equity_curve_count=64`, `trade_count=5`, `position_count=5`, `warning_count=3`, `no_live_orders=true`, `paper_session_id=paper-27aa50c9b0ac`, `paper_order_count=5`, `paper_fill_count=5`, `paper_ledger_count=6`, `paper_no_live_orders=true`, and `export_exists=true`.
- T36 automated Binance execution and risk controls verification:
  - `backend/tests/test_execution_service.py` now covers default-off blocking before adapter calls, credentials/provider/stale/notional/daily-turnover/position-weight/balance/duplicate/allowlist/kill-switch risk blocks, eligible mock submit order/fill/ledger/audit persistence, paper-session linkage, and API config/intents/submit/audit/kill-switch flow.
  - the backend API now exposes additive `/api/v1/execution/binance/config`, `/api/v1/execution/binance/intents`, `/api/v1/execution/binance/intents/recent`, `/api/v1/execution/binance/intents/{intent_id}/submit`, `/api/v1/execution/binance/kill-switch`, and `/api/v1/execution/binance/audit` without changing stable asset, factor, strategy backtest, or paper-session payloads.
  - the desktop Strategy Lab now builds successfully with Live Execution status, Binance intent creation, risk-submit evidence, blocked-check rendering, kill switch controls, recent intents, and audit trail anchors.
  - `logs/binance-execution-smoke-latest.json` recorded `health_ready=true`, `failures=[]`, `config_live_enabled=false`, `intent_id=intent-e78276e996f0`, `submit_status=blocked`, `blocked_checks=["live_mode","risk_acknowledgement"]`, `no_live_order_until_submit=true`, `live_order_recorded=false`, `audit_count_before_restart=2`, `audit_count_after_restart=2`, and `audit_restored_after_restart=true`.
- T17 packaged startup automation verification:
  - `logs/packaged-startup-smoke-latest.json` recorded `health_ready=true`, `single_instance_ok=true`, and `adopt_existing_ok=true`
  - the scripted cold launch reached `http://127.0.0.1:8765/api/v1/health` in about `11.5s`
  - `/settings/runtime` and `/connections/status` both returned successfully during the automated run
  - the packaged bootstrap log appended `adopted_existing=true` when the smoke pre-seeded a healthy `8765` sidecar
- T21 installed MSI startup automation verification:
  - `logs/installed-bundle-startup-smoke-latest.json` recorded `install_exit_code=0`, `health_ready=true`, `single_instance_ok=true`, and `adopt_existing_ok=true`
  - the scripted MSI install resolved `C:\Program Files\Pengbo Workbench\pengbo-workbench.exe` plus `pengbo-sidecar.exe`
  - the installed app reached `http://127.0.0.1:8765/api/v1/health` in about `12.84s`
  - `/settings/runtime` confirmed the installed lifecycle keeps logs under `C:\Users\Laurence\AppData\Local\com.pengbo.workbench\logs` and runtime data under `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench`
  - the installed bootstrap log appended `adopted_existing=true` when the smoke pre-seeded a healthy `8765` sidecar from the installed bundle
- T23 installed NSIS startup automation verification:
  - `logs/installed-bundle-startup-smoke-nsis-latest.json` recorded `install_exit_code=0`, `health_ready=true`, `single_instance_ok=true`, and `adopt_existing_ok=true`
  - the scripted NSIS install resolved `C:\Program Files\Pengbo Workbench\pengbo-workbench.exe` plus `pengbo-sidecar.exe`
  - the installed app reached `http://127.0.0.1:8765/api/v1/health` in about `12.31s`
  - `/settings/runtime` confirmed the NSIS-installed lifecycle also keeps logs under `C:\Users\Laurence\AppData\Local\com.pengbo.workbench\logs` and runtime data under `C:\Users\Laurence\AppData\Roaming\com.pengbo.workbench`
  - the installed bootstrap log appended `adopted_existing=true` when the smoke pre-seeded a healthy `8765` sidecar from the NSIS-installed bundle
- packaged runtime/API validation after the hotfix:
  - `http://127.0.0.1:8765/api/v1/health`
  - `/settings/preferences`
  - `/settings/onboarding`
  - `/connections/status`
- packaged shell startup validation after the hotfix:
  - the desktop shell no longer stays pinned on `connecting` once the sidecar is healthy
  - the packaged WebView can read localhost responses under the Tauri 2 `tauri.localhost` origin
- latest packaged sidecar artifact: `src-tauri/binaries/pengbo-sidecar-x86_64-pc-windows-msvc.exe` at `117,868,930 bytes`
- latest packaged bundles:
  - `src-tauri/target/release/pengbo-workbench.exe`
  - `src-tauri/target/release/bundle/msi/Pengbo Workbench_0.1.0_x64_en-US.msi`
  - `src-tauri/target/release/bundle/nsis/Pengbo Workbench_0.1.0_x64-setup.exe`
- T13 packaging verification:
  - `logs/sidecar-build-latest.json` now records `warning_categories.actionable` separately from `warning_categories.optional_dependency_noise`
  - sidecar build metrics improved from `160,652,673 bytes / 74.84s` to `117,766,856 bytes / 59.25s`
  - actionable packaged-warning residue is currently down to 3 `pandas` / `SciPy` lines
- T20 packaging verification:
  - `npm run sidecar:build` regenerated `logs/sidecar-build-latest.json` with `size_bytes=117,770,120` and `duration_seconds=56.4`
  - `warning_counts.actionable=0` and the residual SciPy trio is now tracked under `warning_categories.accepted_packaging_noise`
  - `warning_notes.accepted_packaging_noise` now records why each remaining SciPy line is intentionally accepted instead of actionable
  - backend `TestClient` validation still returned `AAPL` overview data plus 6 ratios from `/api/v1/assets/AAPL/workspace`
- T13 packaged smoke verification:
  - cold-launching `src-tauri/target/release/pengbo-workbench.exe` still brought up a healthy local sidecar on `http://127.0.0.1:8765/api/v1/health`
  - `/connections/status` now reports `Yahoo Fundamentals`
  - `/api/v1/assets/AAPL/workspace` returned `market_cap="$3.97T"` and 6 ratios after the lighter fundamentals change
  - `/api/v1/portfolio/summary` still returned successfully after the packaging trim
- T16 static/build verification:
  - desktop runtime config no longer falls back to relative `/api/v1` when Tauri runtime discovery is temporarily unavailable
  - dashboard/watchlist/connections startup requests are gated behind runtime-plus-health reconciliation
  - desktop network misses now refresh runtime config and retry once before surfacing a sidecar-specific error
  - Tauri bootstrap logs now record runtime status changes, resolved base URL, and `/health` probe failures
- T16 packaged regression verification:
  - launching the packaged EXE twice now keeps a single `pengbo-workbench` instance alive
  - the active packaged sidecar still answers `http://127.0.0.1:8765/api/v1/health` with `200`
  - no fresh DuckDB lock/bootstrap-failure entries are appended during the second launch handoff
  - when a healthy `8765` sidecar already exists, launching the packaged EXE now appends `adopted_existing=true` instead of trying a random replacement port
- packaged runtime checks against `http://127.0.0.1:8765/api/v1`:
  - `/health`
  - `/connections/status` with no credentials
  - `/connections/status` with EDGAR identity loaded
  - `/connections/test` for EDGAR returning `ok`
  - `/connections/test` for EDGAR returning `cached` after forcing live failure via invalid proxy env
  - `DELETE /connections/edgar/profile` + relaunch without identity returning `missing_credentials` with cleared summary/timestamps/cache freshness
  - `/connections/status` with Binance credentials loaded
  - `/connections/test` for Binance returning `ok`
  - `/connections/binance/account` returning a real private-account snapshot and writing cache
  - `/connections/test` for Binance returning `cached` after forcing live failure via invalid proxy env
  - `/connections/binance/account` returning cached balances with `stale=true` during forced live failure
  - `DELETE /connections/binance/profile` + relaunch without credentials returning `missing_credentials` with cleared summary/timestamps/cache freshness
- T12 packaged portfolio offline smoke verification:
  - online seeded scenario returned one live-valued `AAPL` holding, with `BTC/USDT` benchmark independently degrading to `cached`
  - offline-with-cache seeded scenario returned one cached-valued holding plus intact transaction history, with degraded summary notes instead of request failure
  - offline-cold-cache seeded scenario returned one `unavailable` holding, `missing_symbols=["AAPL"]`, both benchmarks `unavailable`, and intact transaction history
- T19 packaged portfolio automation verification:
  - `logs/portfolio-offline-smoke-latest.json` recorded `health_ready=true` with no failures
  - `online` seeded scenario returned one `AAPL` holding at `valuation_status=live` and `benchmark_status={SPY=live, BTC/USDT=live}`
  - `offline_with_cache` returned the same seeded holding at `valuation_status=cached`, downgraded both benchmarks to `cached`, and successfully updated the transaction notes
  - `offline_cold_cache` returned the same seeded holding at `valuation_status=unavailable`, reported `missing_symbols=["AAPL"]`, downgraded both benchmarks to `unavailable`, and still successfully updated the transaction notes
- T22 packaged portfolio UI signoff verification:
  - `logs/portfolio-ui-signoff-latest.json` recorded `health_ready=true` with no failures
  - `ready` seeded scenario recorded `portfolio-status-pill state=live`, `portfolio-holding symbol=AAPL valuation=live`, and an enabled transaction submit action
  - `cached` seeded scenario recorded `portfolio-status-pill state=degraded`, `portfolio-holding symbol=AAPL valuation=cached`, cache-degraded summary notes, and an enabled transaction submit action
  - `unavailable` seeded scenario recorded `portfolio-status-pill state=degraded`, `portfolio-holding symbol=AAPL valuation=unavailable`, unavailable benchmark plus missing valuation notes, and an enabled transaction submit action
- pending verification:
  - Optional final visual walkthrough of the freshly rebuilt EXE remains useful, but `T12` is now package-smoke validated at the runtime/API layer.

## Notes

- Source of truth for the latest packaging baseline:
  - `logs/SIDECAR_PACKAGING_SPRINT_2026-04-15.md`
  - `logs/sidecar-build-latest.json`
- `T15` remains completed through packaged-runtime verification; `T16` removed the code/build blocker that was keeping the packaged shell badge and startup fetch state unreliable, and `T17` now captures that startup contract in a repeatable smoke path.
- The remaining validation gaps are no longer startup-health automation, portfolio offline API coverage, portfolio UI-state signoff, screener packaged signoff, residual warning trimming, or installer parity; packaged EXE, MSI, and NSIS startup coverage are now all repeatable.
- T37 is now closed; no new blocker task was added in this pass. A visual walkthrough/report-polish pass remains useful but is optional rather than a required unblocker.
- Automated live order placement remains a Binance-only product target, and any live request path remains default-off behind factor evidence, backtesting, paper trading, risk gates, audit logs, kill switches, and explicit user-owned Binance configuration.
