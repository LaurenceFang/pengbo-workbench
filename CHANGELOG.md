# Changelog

All notable public-facing changes for Pengbo Workbench are summarized here.

Pengbo uses `0.1.x` for the current local-first desktop pre-release line. The
app is not a hosted service, public API, remote account system, or signed binary
release channel yet.

## 0.1.0 - Current Pre-Release Baseline

- Fixed the T105 sidecar-offline sensitive-route regression: pages no longer
  remain permanently in security loading and now expose a recoverable error with
  Retry. RED-before and GREEN-after evidence is retained; route applicability
  passes `79/79` and runtime state checks pass `491/491`.
- Expanded T106 automated evidence to `3928/3928` state/theme/viewport
  screenshots. Dual-theme evidence passes `632/632`, base screenshots pass
  `316/316`, Route Workspace structure passes `316/316` with zero rate
  warnings, and SVG geometry/style/structure passes `79/79`.
- Generated 16 human-review contact sheets covering all 79 Frames. Automated
  rules pass, while human signoff remains pending.
- Typecheck, production web build, Cargo check, 105 backend tests, the 350-file
  public-boundary scan, and the T102–T106 contract check pass.
- Rebuilt the current 302-file source manifest with SHA-256
  `3C89FB64E56979B847A3AC1D6E464DB07F2C5672D0EA3693164DABEFCEA11872`.
  The current sidecar, EXE, MSI, and NSIS artifact hashes are recorded in
  `logs/m1-release-manifest.json`.
- Current-source packaged validation now passes all nine business regression
  groups, the full local-security lifecycle, source EXE startup at `3.42s`, MSI
  install/startup at `3.92s`, and NSIS install/startup at `2.90s`. Profile
  backup/restore manifests match, SQLite plaintext-secret scan is false, and the
  installed sidecars match the current build.
- The desktop installation is updated at
  `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`. AppData log/data paths
  remain `skipped_locked` under the expected locked security boundary and are
  not recorded as verified.
- T105 automated/dynamic/security acceptance passes, but M1 remains open for
  T106 human signoff. T102–T104 remain `Implemented / Acceptance Pending`, T105
  remains `In Progress / Acceptance Pending`, T106 remains `Automated Rule
  Passed / Human Signoff Pending`, and T107 remains frozen.
- Corrected all five Manual subpages to use a full-width single-column workspace
  with natural height and no nested vertical scrolling. Manual passes `40/40`
  across light/dark themes and four viewports with width ratio `1`, one column,
  visible overflow, and zero nested scroll containers.
- Added full-route dual-theme evidence for all 79 registered routes at four
  viewports. `logs/full-route-theme-smoke.json` records `632/632`, 632
  screenshots, and zero console/page errors; its SHA-256 is
  `09EE577A752E66D37B82627C42A81F2F93B5127B044BC275AD755D6B234F8A7E`.
  The screenshot corpus SHA-256 is
  `28123E7463385FECBA910A01D390D2F819E61D2927EF51CCE4637DB3757B4E2A`.
- Theme persistence passes default light, dark preview/save, dark restoration
  after backend restart, and reset-to-light GET plus DOM checks. Typecheck,
  production build, theme check, page-layout `96/96`, and Route Workspace
  `316/316` also pass.
- At the earlier dual-theme checkpoint, rebuilt the then-current 297-file dirty
  source. The source manifest SHA-256 was
  `F94EF4CB11A397944573EFC506A800221B029A8EB2B22AA9F202DFBC0EAA446F`;
  current sidecar, EXE, MSI, and NSIS hashes are recorded in
  `logs/m1-release-manifest.json`.
- At that checkpoint, the first packaged cold startup was a performance failure
  at `5.81s`;
  immediate retest passes at `4.46s`. Current-source NSIS install/update and
  startup pass in `3.41s`, with matching sidecar hash, single-instance and
  adopt-existing behavior, expected locked runtime-path skips, and no failures.
- Independent Evidence Collector and Reality Checker review passed that
  correction only. MSI install and the complete nine packaged business
  regressions had not yet been rerun; the newer current-source results are
  recorded above.
- Corrected the 2026-07-22 T102 light-theme and routed-page layout regressions.
  Low-contrast grey/white copy now uses readable light-theme semantic colors;
  the Research `基本面与文件` evidence area grows naturally without a nested
  grey scrolling viewport; and the targeted Asset, Portfolio, Workflow, and
  Screener subpages use the available workspace instead of a narrow left column.
- Kept the 960px Toolbar AI and lock actions compact so their labels no longer
  wrap one character per line. No route, API, data, permission, Inspector, or
  business-action semantics changed in this correction.
- The light-theme Research Decision page now gives its decision heading,
  evidence/provenance cards, and descriptive copy explicit readable foreground,
  background, and border colors. The visual smoke now follows a real Research
  Brief journey for both Research routes and retries the local API within a
  bounded window.
- `logs/page-layout-correction-smoke.json` records 24 routes across 1600, 1440,
  1180, and 960 viewports: `96/96` passed with zero failures and minimum sampled
  light-theme contrast `4.72`. Frame 22 records title/section contrast `16.32`
  and evidence-description minimum `5.38`; typecheck and production build pass.
  The evidence JSON SHA-256 is
  `93DC7E482984B7FAC4D565FA01029BDB7D57FFEB78A7FFBA0AC934A79EAA67FE`.
- At the earlier page-layout checkpoint, rebuilt the then-current 2026-07-22
  dirty source with `npm.cmd run tauri:build`,
  recreating web, clean PyInstaller sidecar, release EXE, MSI, and NSIS.
  `logs/m1-release-manifest.json` records 296 source files and source manifest
  SHA-256 `5E593330D890E72D8A016F7E6BB5ED15CCD9848CDF6DCFE81F5C96DFFF0A6D8B`.
- The first cold packaged startup remains recorded as a 5s performance failure
  at `7.15s`; the immediate `4.51s` retest passed with `failures=[]`.
  Current-source NSIS install/startup passed with exit `0`, health ready in
  `3.93s`, matching built and installed sidecar hashes, and `failures=[]`; the desktop target was
  refreshed to `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`.
- At that checkpoint, MSI install/startup and the complete nine packaged M1
  regression groups had not yet been rerun; the newer current-source results
  are recorded above.
- Corrected `T102 - Route Component Library / 2026-07-21 Route Workspace
  结构修正`: real route-family workspaces now mount directly under each route
  page, use natural content height, and leave vertical scrolling to the parent
  Workspace. The production state legend and legacy generic `820x500` outer
  frame are absent across all routes.
- The corrected structure passes 316/316 four-viewport checks; subpage runtime
  navigation passes 79/79; SVG geometry/style/structure pass 79/79; and 316/316
  screenshots were generated. Typecheck, production build, and the T102–T106
  contract check pass.
- The current source manifest SHA-256 is
  `AB7F3C3D6E8C76188CD46CBE6DD5C1E27DCFB977F1262D8562E9168542272508`;
  packaged business regressions pass 9/9, and MSI/NSIS installed startup pass.
  T102 remains `Implemented / Acceptance Pending`; T105 is unchanged; T106 is
  `Automated Rule Passed, Human Signoff Pending`; T107 remains frozen. M1 is not
  recorded as complete.
- Replaced the production 14-View stacked workspace and generic route-content
  body with route-level business dispatch for all 79 registered URLs. Sixty-eight
  routes mount genuine T1–T101 business components and eleven future routes show
  explicit task-numbered blocked states.
- Split Asset, Research, Portfolio, Factor Lab, Strategy Lab, Workflow Studio,
  Screeners, Data Sources, Connections, Settings, Manual, Dashboard, and the
  standalone AI Assistant into independently navigable subpages. Subroute,
  sidebar, search, command, handoff, and AI navigation now update URL/history.
- Added the standalone `/ai-assistant` page with local and cloud configuration
  tabs, runtime status, local endpoint visibility, cloud opt-in boundaries, and
  no fabricated model output.
- Fixed the Asset Search child page so its primary task and results use the full
  workspace instead of collapsing into a narrow column. Corrected standalone AI
  navigation so it belongs to Automation without falsely selecting Workflow,
  Screeners, Settings, or Manual.
- Kept route tabs, Context Inspector, the `pengbo` wordmark, Frame number, real
  local API status, and standalone AI entry while replacing the former generic
  fixed-height route surface with direct route-owned business workspaces.
  Responsive checks cover 1600/1180/960 without document-level horizontal
  overflow, with Inspector and Sidebar drawers at the contracted breakpoints.
- Added stable packaged UIAutomation subroute anchors and updated Portfolio,
  Screener, Workflow, and Data Sources desktop regressions to verify the real
  child-page journey rather than searching for stacked controls on one page.
- Split Data Sources preview content by the URL provider. World Bank/FRED/HKMA/
  DBnomics, Tushare, CoinGecko, and RSS now render their own macro, equity,
  crypto, or news preview instead of sharing one long stacked page.
- Current-source desktop validation passes 79/79 route runtime checks, 316/316
  four-viewport terminal-state captures, 9/9 packaged business regressions, and
  MSI plus NSIS installed startup checks. The NSIS install refreshes the desktop
  shortcut to `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`.
- Verified that the installed 0.1.0 EXE is the current bundle variant: it is the
  same length as the release EXE and differs only by one contiguous three-byte
  Tauri bundle-type metadata range.
- Implemented the user-approved SVG acceptance rule: strict shell geometry and
  rendered style tokens, a legal mask only inside the real business surface,
  and route/primary-task/terminal-state/recovery assertions. The automated gate
  passes 79/79 Frames and 316/316 responsive screenshots; raw full-frame pixel
  comparison remains a 0/79 diagnostic because the immutable SVG cycles generic
  primary-task placeholders.
- M1 is not closed: T102–T104 remain `Implemented / Acceptance Pending`; T105
  automated/dynamic/security acceptance passes while its board status remains
  `In Progress / Acceptance Pending`; T106 still needs per-Frame human signoff;
  T107 remains frozen.
- Prevented a stale idle-expiry security snapshot from overwriting a newer
  successful unlock by adding a compare-and-swap SQLite update, with a focused
  regression test. Protected packaged security checks pass lock, failed unlock,
  successful unlock, idle relock, restart restoration, audit, and plaintext scan.
- Locked the T102-T106 UI baseline in the single Penpot page `FINAL - All
  Pengbo Pages`: all planned routes are full-screen page frames in one
  continuous flow, every Research/Experiment/Asset subpage has a contextual AI
  entry, and `/ai-assistant` remains the standalone general-purpose AI page.
  Future frontend tasks must use `docs/ui-restructure-ia-t102-t106.md` and
  `docs/frontend-design-plan-t102-t106.md` as the design contracts.
- Formalized the T96-T195 task pool around that locked UI baseline. T102-T106
  now own route-level foundations, T107-T115 own the first route-based research
  loop, T116-T125 own standalone/contextual AI, and later data, workflow,
  factor, release, security, and commercialization tasks inherit the same
  Penpot-frame, route-state, AI-entry, and responsive-evidence gates.
- Formally registered `E:\彭博\Pengbo_UI_Rebuild.svg` as the TOP-level visual
  acceptance baseline for all future UI work. It contains 79 full-screen frames,
  contextual AI entry states, and the standalone `/ai-assistant` route. Its
  current SHA-256 is `206E6C79553594070FE7ADE443D97094AC8016E515B19AE8F49B9B3544028CAF`
  and its size is `1,170,776 bytes`.
  The Penpot `FINAL - All Pengbo Pages` page remains the editable source and must
  stay visually equivalent to the registered SVG.
- Implemented T102 Component Library Base with typed route/page/control/state
  primitives, T98-token-based shared styles, and incremental AppSidebar and
  Context Rail migration. Existing navigation anchors, Shell behavior, theme,
  density, and business/API boundaries remain unchanged.
- Implemented T103 Financial DataTable with stable-width fixed identifier
  columns, sorting/filtering, optional virtualization, row Inspector and
  contextual AI handoffs, source/freshness metadata, and full table state
  boundaries. Factor Lab now consumes the shared table without API or
  execution-scope changes.
- Corrected the M1 T96-T104 implementation contract against the registered
  `Pengbo_UI_Rebuild.svg` baseline. T101 theme validation now checks the real
  theme control and `setTheme(...)` behavior, while T103/T104 share a typed
  route-aware InspectorContext for route/object identity, evidence scope,
  source/freshness, permissions, AI state, and next actions. T105/T106 remain
  outside this change.
- Implemented the first T104 Context Inspector contract across the AppShell
  Context Rail, Screeners, and Factor Lab DataTable metadata, with Asset, Data
  Sources, and Research route anchors prepared for the same context model.
- Passed the T104 rendered/security sub-gate on 2026-07-13. Overall T104 M1
  acceptance remains pending on the immutable SVG visual gate. The local security
  status endpoint remains readable while locked so sensitive views render the
  unlock gate and Context Inspector `locked` state; protected data requests
  continue to produce expected 403 blocks. T105/T106 are not included.
- Fixed a local unlock deadlock: `/security/local/*` operations no longer try
  to bootstrap the ordinary session first, so unlock and password reset can
  execute while that session is correctly blocked by the locked state.
- Allowed the active loopback web-dev origin on port 4190 and deduplicated
  concurrent browser session creation, resolving the browser-only
  `origin_not_allowed` 403 after a successful local unlock.
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
- Post-T84 UX correction moves AI enablement into Dashboard AI Control, with
  explicit local/cloud modes, provider interface presets for ChatGPT/OpenAI,
  Gemini, Grok, Claude, DeepSeek, Qwen/DashScope, and custom endpoints, plus
  Research generation still gated by context preview and local session
  permissions.
- T85-T91 add the first cautious China-market connector pack: a source study,
  connector manifest endpoint, fixture harness for configured-key/timeout/
  malformed/license-blocked states, read-only Tushare A-share search/quote/
  profile, no-key HKMA macro context, `china_market` Research briefs, export
  integration, Stronghold/env token plumbing, and a packaged release smoke via
  `npm run smoke:china-connectors:packaged`.
- T92-T94 harden the security-accountability baseline: broader redaction for
  text, URLs, audit payloads, local notes, and report exports; local-unlock
  gates for Research, Factor Lab, Workflow Studio, Data Sources, Portfolio, and
  runtime settings; route-classification coverage for sensitive report/runtime
  routes; and packaged signoff evidence via `npm run smoke:security:packaged`.
- T96-T97 establish the next-stage visual roadmap and Figma UI system for the
  T96-T195 product arc.
- T98 implements Design Tokens v1: a light-first semantic surface with a full
  dark mapping, local/offline typography, standard and compact density modes,
  accessible focus and reduced-motion behavior, and unified operational plus
  financial status tones. The contract is repeatably checked with
  `npm run check:design-tokens` and `npm run smoke:design-tokens`.
- T99 replaces the flat 14-item sidebar with seven task-oriented navigation
  groups while preserving every internal workspace, Command Palette target,
  sensitive-view gate, and stable `nav-<ViewKey>` automation anchor. Group
  disclosures are keyboard-accessible, single-open, bilingual, and compatible
  with standard and compact density.
- T100 extracts the desktop frame into explicit Sidebar, Toolbar, Workspace,
  and collapsible Context Rail regions. The shell reuses T99 navigation,
  preserves global search/command/runtime controls, keeps one workspace scroll
  boundary, and hides sensitive context while a protected workspace is locked.
- T101 makes light mode the safe default and keeps dark mode as a persisted
  preference. Theme selection previews immediately in Settings, binds to the
  T100 AppShell root, and restores after backend restart without replacing the
  active workspace.
- Rebuilt the Windows release EXE, MSI, and NSIS bundles after T101. The NSIS
  installer refreshed the user-level desktop shortcut; that exact installed
  executable and bundled sidecar were visually verified online in the new
  light-first shell. Existing local-security state was preserved rather than
  reset for protected API probes. Generated release artifacts remain untracked.
- The first GitHub Release is published as
  [v0.1.0](https://github.com/LaurenceFang/pengbo-workbench/releases/tag/v0.1.0)
  with approved Windows desktop artifacts.

## M1 全路由整改基础设施（2026-07-15）

- Added the immutable-SVG 79-frame route registry, BrowserRouter route outlet,
  URL parameter recovery, deterministic fixture fallback, RouteContext,
  Context Inspector/AI metadata, and 316-route evidence capture records.
- Recorded the current boundary explicitly: 316/316 route renders are verified,
  but visual parity and per-frame page reconstruction remain in progress.
- Restored the local unlock gate on sensitive routed pages and pinned
  `starlette==0.46.2` so the FastAPI sidecar starts and returns the locked state
  instead of leaving the page without a password field.

## Upcoming

## M1 subpage and packaged checkpoint - 2026-07-17

This section is a historical 2026-07-17 checkpoint. Current source, dual-theme,
packaging, and remaining-gate facts use the 2026-07-22 entries above.

- `logs/all-subpages-runtime-smoke.json` records 79/79 route-level runtime
  acceptance: 68 real available pages and 11 planned blocked pages.
- `logs/m1-packaged-regression-latest.json` records 9/9 packaged business
  regressions with verified profile backup/restore; MSI and NSIS installed
  startup logs both record zero failures.
- The checkpoint recorded a 292-file runtime/build source manifest (planning
  docs and generated evidence excluded) and regenerated sidecar, EXE, MSI, and
  NSIS hashes. It is historical and does not replace the 2026-07-22 current
  manifest recorded above.
- `logs/visual-acceptance/index.json` remains a failing gate: 79/79 geometry,
  0/79 pixel acceptance (4.22% minimum, 6.74% average, 23.58% maximum), no
  console/page errors, and human signoff pending. No M1 completion or T107 start
  is recorded.

## M1 correction checkpoint - 2026-07-15

- Implemented the 79-route adapter/navigation/policy/state foundation and generated 316 four-viewport terminal-state captures with no loading terminal accepted as passed.
- Verified typecheck, production web build, 97 backend tests, static route/security contracts, packaged startup, and packaged local-security locked-to-ready behavior.
- Built current-source sidecar, Tauri EXE, MSI, and NSIS artifacts and recorded their hashes before the pause.
- Recorded a failing visual acceptance gate: 0/79 Frames are within the 1.5% pixel-diff threshold, so T106 and M1 remain open.
- Force-stopped the in-progress packaged workflow sequence at the user's deadline. The real Roaming profile was restored from a durable backup with matching SHA-256; the interrupted sequence is not recorded as passed.
- See `docs/m1-pause-handoff-2026-07-15.md` for the exact accepted evidence and remaining work. T107 remains frozen.

- T105 is now in execution after T104 acceptance. The shared Chinese-first
  state registry covers loading, empty, blocked, error, locked, ready,
  AI-insufficient-evidence, cloud-opt-in, and recovery states across the 14
  existing ViewKey surfaces. The static T105 state check passes; browser state
  evidence is still pending; static/build checks and the browser shell smoke
  pass. T106 full-route screenshot baseline is not part of this change.
- T106 was attempted on 2026-07-15 and deliberately stopped after the partial
  diagnostic run exposed a structural blocker: 79 SVG Frames are not mapped to
  the current 14 ViewKeys, and some browser captures observed API 500/session
  interruption states. The 42 diagnostic screenshots and stop rationale are
  recorded in `logs/t106-route-screenshots/index.json` and
  `docs/t106-route-screenshot-baseline.md`; T106 is not marked complete.
