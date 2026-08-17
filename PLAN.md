# Pengbo Workbench Current Plan

Pengbo Workbench is a Windows-first, local-first desktop financial research
terminal. It uses Tauri, React, FastAPI, SQLite, and DuckDB to keep the primary
workflow on the user's machine instead of turning the project into a hosted SaaS
account.

## Task Execution Preference

For non-trivial work, first evaluate whether an existing configured sub-agent
can materially advance exploration, implementation, evidence collection,
research, or independent verification, and prefer using that sub-agent when it
is a good fit. The main thread keeps scope, permissions, write ownership,
integration, and final acceptance. Simple, tightly coupled, urgent, or
conflict-prone work may stay in the main thread; delegation must remain useful
and must not be added only for ceremony.

## Locked UI Baseline - Top Priority

Before implementing T102 and every downstream page task, use
`E:\彭博\Pengbo_UI_Rebuild.svg` as the TOP-level visual acceptance baseline and
the single Penpot page `FINAL - All Pengbo Pages` as the editable design source.
They must remain visually equivalent. The baseline contains the continuous
full-screen route design for all planned pages and the shared state language.
Research, experiment, and Asset subpages must expose contextual AI entry points;
`/ai-assistant` remains the standalone general-purpose AI page.

No implementation may collapse these routes into summary cards or a mega-page,
remove the contextual AI entry, or introduce a second competing visual system
without explicit user approval. Preserve the T99/T100/T101 navigation, shell,
theme, density, security, and automation contracts while migrating the page
layer.

Registered visual baseline: `79` Frames / `79` routes, `1,170,776 bytes`,
SHA-256
`206E6C79553594070FE7ADE443D97094AC8016E515B19AE8F49B9B3544028CAF`.

The formal T96-T195 task pool now carries this baseline through M1-M9. T102-T106
build the route-level foundations; T107-T115 implement the first useful route
loop; T116-T125 implement standalone and contextual AI; later data, workflow,
factor, release, security, and commercialization tasks inherit the same Penpot
frame, route, state, AI-entry, and responsive-evidence requirements.

## Product Position

The near-term goal is one reliable research loop:

1. Choose an asset, market theme, or data source.
2. Inspect freshness, provenance, credentials, and local cache state.
3. Build a research brief with evidence.
4. Connect the brief to portfolio, factor, or strategy context.
5. Export a local report with explicit assumptions and safety boundaries.

Pengbo is not trying to clone every Bloomberg surface at once. The first public
line should be useful, understandable, local, auditable, and honest about what
is implemented.

## Current Runtime Boundary

- The desktop shell starts a local FastAPI sidecar on loopback.
- SQLite stores user-facing app state.
- DuckDB stores local analytical/cache snapshots.
- Stronghold and environment injection are used for provider secret material;
  raw secrets must not be stored in SQLite, DuckDB, logs, diagnostics, exports,
  or API responses.
- Non-Binance data providers are read-only.
- Binance execution remains default-off, risk-gated, kill-switch gated,
  audited, and explicitly user-confirmed.
- No hosted accounts, remote sync, public API, team permissions, or public
  network exposure are part of the current product.

## Current Workspaces

- Dashboard: runtime readiness, market pulse, watchlist, and workflow handoffs.
- Asset: quote/history, provider capability, filings, fundamentals, and charts.
- Research: durable local briefs, notes, analysis modules, and exports.
- Screeners: preset-driven and variant-tuned screening.
- Portfolio: offline-first holdings, transactions, analytics, and allocation.
- Factor Lab: local research-only factor runs and handoffs.
- Strategy Lab: local backtests, paper ledgers, Binance intents, and evidence.
- Workflow Studio: template-driven workflows with explicit manual boundaries.
- Data Sources: packaged source-catalog coverage, provenance, cache state, and export.
- Connections: provider capability, credential status, and local secret bridge.
- Settings: runtime paths, preferences, diagnostics, and version evidence.
- Manual: product guidance and safety boundaries.

## Roadmap Focus

The security-accountability sequence T53-T56 is complete. T57 added the explicit
Apache-2.0 source license and public repository boundary.

The active product-trust sequence is:

- T58: version governance cleanup. Completed.
- T59: no-secret GitHub Actions CI baseline. Completed.
- T60: demo mode and no-key startup. Completed.
- T61: release artifact naming and checklist. Completed.
- T62: README product proof upgrade. Completed.
- T63: contributor entry kit. Completed.
- T64: research flow definition. Completed.
- T65: asset-page research entry. Completed.
- T66: data-status strip consistency. Completed.
- T67: research-brief quality. Completed.
- T68: report evidence packs and first GitHub Release upload. Completed.
- T69: command center for frequent reviewer and operator actions. Completed.
- T69# Temp: real packaged-desktop video walkthrough. Completed.
- T70: first-run onboarding for reviewer setup and safety boundaries. Completed.
- T71: provider capability matrix. Completed.
- T72: provider credential state model. Completed.
- T73: provider freshness and cache policy. Completed.
- T74: data-quality status contract. Completed.
- T75: provenance UI/export sync. Completed.
- T76: existing provider audit. Completed.
- T77: Data Sources packaged signoff. Completed.
- T78: local LLM runtime probe. Completed.
- T79: AI permission boundary. Completed.
- T80: research assistant backend. Completed.
- T81: research assistant UI. Completed.
- T82: evidence-grounded prompt layer. Completed.
- T83: cloud LLM explicit opt-in. Completed.
- T84: AI research packaged signoff. Completed.
- T85: China-market data source study. Completed.
- T86: connector manifest contract. Completed.
- T87: connector test harness. Completed.
- T88: A-share read-only connector v1. Completed.
- T89: HK/China macro connector v1. Completed.
- T90: China-market research template. Completed.
- T91: connector packaged signoff. Completed.
- T92: credential audit trail hardening. Completed.
- T93: sensitive workspace lock rules. Completed.
- T94: security packaged signoff. Completed.
- T95+: next-stage master task pool selected; follow-up tasks are numbered
  T96-T195 across UI redesign, first useful research loop, multi-model AI,
  data depth, professional workflows, Quant Factor Lab, release hardening,
  safety, and commercialization.
- T96: Figma master roadmap. Completed.
- T97: Figma UI system. Completed.
- T98: design tokens v1. Completed with a light-first semantic system, dark
  mapping, two density modes, 12 operational/financial state contracts, local
  typography, and repeatable static plus visual verification.
- T99: navigation IA collapse. Completed with seven task-oriented groups,
  one-to-one coverage of all 14 internal workspaces, stable automation anchors,
  and unchanged sensitive-view gates.
- T100: AppShell redesign. Completed with explicit Sidebar, Toolbar, Workspace,
  and safe collapsible Context Rail regions that reuse the T99 navigation
  contract.
- T101: light mode first. Completed with a backward-compatible persisted
  light/dark preference, immediate Settings preview, AppShell root binding,
  and restart restoration evidence.
- M1 correction rule: T96-T104 must match the registered
  `Pengbo_UI_Rebuild.svg` and the Penpot `FINAL - All Pengbo Pages` contract.
  The SVG remains immutable in this task. Route frames, contextual AI, the
  four-region shell, evidence metadata, and Context Inspector are one shared
  foundation; T105/T106 are explicitly excluded from this correction pass.
- T102 - Route Component Library / 2026-07-21 Route Workspace 结构修正.
  Implemented / Acceptance Pending. Shared route/control/state/AI-entry/handoff
  primitives remain in place; the real route-family workspace is now the
  transparent direct child of `RoutePageFrame`, contains only the current
  route-family page, uses natural content height, and
  delegates vertical scrolling to the parent Workspace. Production status
  legend count and legacy generic `820x500` outer-frame count are both `0`.
- T103: financial DataTable. Implemented / Acceptance Pending; added the route-aware table
  foundation with stable-width columns, sorting/filtering, fixed identifier
  column, optional virtualization, row Inspector/AI handoff, source/freshness
  metadata, and loading/empty/error/locked/blocked/degraded state boundaries.
- T104: Context Inspector. Implemented / Acceptance Pending as the M1 route-aware context contract;
  `InspectorContext` now standardizes route/object identity, evidence scope,
  source/freshness, permission state, AI state, and next actions without
  replacing the route page. See
  [docs/t104-context-inspector.md](docs/t104-context-inspector.md). The final
  rendered/security evidence gate passed on 2026-07-13; T105/T106 remain
  excluded. A follow-up fix keeps local unlock/reset operations reachable
  while the ordinary local session remains blocked.
- T105: Chinese State System. In Progress / Acceptance Pending; the shared state
  registry and state metadata now cover the route-level shell and real business
  pages. Sidecar-offline RED/GREEN, route applicability `79/79`, runtime states
  `491/491`, and packaged security lifecycle pass. Automated/dynamic/security
  acceptance is complete; board acceptance waits on the global M1 human gate.
- T106: Full Route Screenshot Baseline. In Progress / Automated Rule Passed,
  Human Signoff Pending. The application has the complete 79-route registry,
  `3928/3928` state/theme/viewport screenshots, `632/632` dual-theme evidence,
  and `316/316` base captures. The user-approved acceptance rule holds shell
  geometry and rendered style tokens strict, masks only the real business
  interior, and asserts one route page, one primary task, a stable terminal
  state, and explicit planned-route recovery. It passes 79/79 Frames. Sixteen
  contact sheets cover all Frames, with human approval pending. Raw
  full-frame pixel comparison remains a 0/79 diagnostic because the immutable
  SVG cycles generic placeholders; it is not the approved completion gate. See
 [docs/full-route-visual-acceptance.md](docs/full-route-visual-acceptance.md).

The current research-flow map is tracked in
[docs/research-flow-definition.md](docs/research-flow-definition.md).
The cautious China-market source plan is tracked in
[docs/china-market-source-study.md](docs/china-market-source-study.md).

## M1 全路由整改当前状态

79 条深层 URL 已全部建立真实路由级页面分发：68 条 available 路由挂载 T1–T101 的真实业务组件，11 条未来路由显示带后续任务号的阻断态。资产、研究、投资组合、因子、策略、工作流、筛选器、数据源、连接、设置、手册和独立 AI 页面均按子页面隔离，不再由通用 `route-content` 或 14 个堆叠 mega-page 覆盖。Data Sources 预览也已按 URL provider 拆开。2026-07-22 当前证据为：T105 route applicability `79/79`、runtime states `491/491`；T106 state/theme/viewport screenshots `3928/3928`、dual theme `632/632`、base screenshots `316/316`、Route Workspace structure `316/316` 且 rate warnings `0`；SVG automated geometry/style/structure `79/79`。当前源码 9 组 packaged 业务回归 `9/9`、完整 local-security lifecycle、source EXE startup `3.42s`、MSI startup `3.92s`、NSIS startup `2.90s` 均通过，桌面安装已更新到 `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`。locked 状态下 AppData log/data paths 为 `skipped_locked`，属于预期安全阻断而不是“已验证”。

M1 仍不能结束：sidecar 离线时敏感路由永久停在 security `loading` 的 T105 缺口已经修复，RED-before/GREEN-after、79 路由适用矩阵、491 动态状态和完整 packaged security lifecycle 均通过；但 T106 的 79 Frame 人工签收仍为 pending。因此 T102–T104 保持 `Implemented / Acceptance Pending`，T105 保持 `In Progress / Acceptance Pending`（自动/动态/安全验收已通过），T106 保持 `In Progress / Automated Rule Passed, Human Signoff Pending`，T107 继续冻结。

当前关闭顺序：

1. T105 自动/动态/安全门已经通过，保持 `In Progress / Acceptance Pending` 直到
   M1 全局人工门关闭。
2. 当前优先完成 T106：使用 `logs/t106-human-review/index.json` 的 16 张 contact
   sheets 对 79 个 Frame 逐一人工复核 expected、edge、failure；不得以
   `3928/3928`、`632/632` 或 `316/316` 自动通过替代人工批准。
3. 当前源码 MSI、NSIS 和 9 组 packaged 回归已经补跑通过，无需继续标为 pending。
   人工门关闭前不启动 T107，不宣布 M1 完成。

## T102 Route Workspace 结构修正（2026-07-21）

- 注册基线：79 Frames / 79 routes，`1,170,776 bytes`，SHA-256
  `206E6C79553594070FE7ADE443D97094AC8016E515B19AE8F49B9B3544028CAF`。
- 结构合同：真实 route-family workspace 直接挂载到 route page；父
  Workspace 负责纵向滚动；生产状态图例 `0`；旧通用 `820x500` 外框 `0`。
- 自动证据：Route Workspace structure `316/316`；子页面运行时导航
  `79/79`；SVG geometry/style/structure `79/79`；四视口截图 `316/316`；
  typecheck、production build、T102–T106 contract check 均通过。
- 2026-07-21 发布证据：源码清单 SHA-256
  `AB7F3C3D6E8C76188CD46CBE6DD5C1E27DCFB977F1262D8562E9168542272508`；
  packaged 业务回归 `9/9`；MSI/NSIS installed startup 均通过。
- 边界：T102 仍为 `Implemented / Acceptance Pending`；T105 不变；T106
  为 `Automated Rule Passed, Human Signoff Pending`；T107 冻结。不得据此
  宣称 M1 完成。

## T102 具体页面修正（2026-07-22）

本轮执行 `Light Theme Contrast and Routed Page Layout Correction`，只修复用户
点名的页面显示问题，不改变业务内容、API、数据、权限、Context Inspector 或
路由语义，也不新增 T 编号。

- 浅色主题：提升灰色/白色文字的可读性，以语义色替换在浅色表面失效的深色主题
  硬编码文字色；补齐 Research Decision 标题、证据卡、来源卡及说明文字的浅色
  背景、边框和前景色。自动抽样最低对比度为 `4.72`，Frame 22 标题/section 为
  `16.32`，证据说明最低为 `5.38`。
- 研究：`基本面与文件` 的灰色内容区取消固定下限、`max-height` 和内部纵向滚动，
  宽度与主任务区一致，由页面自然向下延伸。
- 资产：`资产概览`、`基本面与比率`、`文件与公告`、`数据覆盖与来源` 使用完整
  route workspace，不再压缩成左侧细长列。
- 投资组合：`持仓`、`配置与集中度`、`交易记录`、`新增交易`、`持仓研究交接`
  使用完整 route workspace。
- 自动化：routed Workflow 和 Screener 工作区铺满可用区域；960px Toolbar 的 AI
  与锁定入口保持紧凑，不再逐字竖排。
- 验收：`logs/page-layout-correction-smoke.json`（SHA-256
  `93DC7E482984B7FAC4D565FA01029BDB7D57FFEB78A7FFBA0AC934A79EAA67FE`）
  记录 `24 routes x 4 viewports = 96/96`、0 failures，并强制记录浅色主题。
  Research 子窗口为 `max-height: none`、`overflow: visible`、无嵌套滚动、宽度比
  `1`；`researchDecision` 与 `researchAssetData` 均通过真实研究简报导航进入，
  并覆盖研究决策/证据文字对比度与本地 API 有界重试。TypeScript 和 production
  build 均通过。
- 当前源码打包：重新执行 `npm.cmd run tauri:build` 成功，重建当前 web、clean
  PyInstaller sidecar、release EXE、MSI 和 NSIS。
- 发布清单：`logs/m1-release-manifest.json` 记录 `sourceFileCount=296`，当前
  dirty source manifest SHA-256 为
  `5E593330D890E72D8A016F7E6BB5ED15CCD9848CDF6DCFE81F5C96DFFF0A6D8B`；
  sidecar、release EXE、MSI、NSIS SHA-256 分别为
  `3697E49E3EA5C1EC9083B9422F310DC1E7D9B3F1B1485A6CF7F99AF83EAD0092`、
  `3924BFBF60E741BCDAD1665DB9D3868E08654C7BD4676CED39E27FD01E9BBF25`、
  `19791405F2E13465673211E93DD1B2D5F988F3F50D8C42A51FAF4386F4FD4890`、
  `9BCAFABD8A499E0D3319462DB4024C718D5106308FC2835B095DAF6B561A3EDE`。
- Packaged 验证：保留首次 cold startup `7.15s` 超过 5s 目标的性能失败；随即
  复测 `4.51s` 通过且 `failures=[]`。NSIS install exit `0`，桌面目标为
  `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`，
  `health_ready=true`、ready `3.93s`、`failures=[]`，安装 sidecar 与构建
  sidecar 哈希一致。
- 当时边界：该较早 checkpoint 已完成源码打包、packaged startup 复测和 NSIS
  安装/启动验证，但当时尚未执行当前源码 MSI 安装启动和完整 9 组 M1 packaged
  regression。该历史 pending 状态已由下方较晚的 T105/T106 checkpoint 取代。

## T102 全路由双主题与 Manual 工作区修正（2026-07-22）

本轮执行 `Full-route Dual-theme and Manual Workspace Correction`，仍属于 T102，
不新增任务号。

- Manual：5 个子页面改为全宽单列、自然高度、无嵌套滚动；两主题×四视口
  `40/40` 均记录 `widthRatio=1`、`column=1`、`overflow: visible`、`nested=0`。
- 全路由主题：`logs/full-route-theme-smoke.json` 覆盖 79 路由、light/dark 两主题
  和 1600/1440/1180/960 四视口，共 `632/632`、632 screenshots、0 console/page
  errors。JSON SHA-256 为
  `09EE577A752E66D37B82627C42A81F2F93B5127B044BC275AD755D6B234F8A7E`，
  截图语料 SHA-256 为
  `28123E7463385FECBA910A01D390D2F819E61D2927EF51CCE4637DB3757B4E2A`。
- 支撑门禁：page-layout `96/96`，SHA-256
  `0D3328AD0E3419D26EE55815203B8BFFDAFA1B30552DB479CC403976C91B5A97`；
  Route Workspace `316/316`，SHA-256
  `64893B39D802BD4CCF824C401623AFA91B6FA6681EA370DAB9030C2E1D5AAA5B`；
  `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run
  check:theme-preference` 均通过。
- 主题持久化：默认 light→预览 dark→保存 dark→后端重启恢复 dark→reset light
  的 GET 与 DOM 全链路通过；证据
  `logs/theme-preference-screenshots/theme-preference-smoke-latest.json` SHA-256
  为 `0A21303F16DBB86D9D1BBF38BAEFC6EAB241D12EBFE441B9AEC81CBF9848A09A`。
- 当前源码重新打包：`sourceFileCount=297`，source manifest SHA-256
  `F94EF4CB11A397944573EFC506A800221B029A8EB2B22AA9F202DFBC0EAA446F`，
  manifest 文件 SHA-256
  `B2F4E160EAE5A56BA7C6B22453943E54906280D67CB5B3FCF4653FEF1E9D99FA`；
  test-only theme reset 脚本不在 bundle source 清单内，因此 297 文件 source
  manifest 和 artifact hashes 不变；
  sidecar、EXE、MSI、NSIS SHA-256 分别为
  `CB518863B957728A00521D49DB8710569E03F35BAAA869051DB06BED75E3927D`、
  `FF7123BACBA2FB99387472A310CEB490230E2529B2A8B92522EA24D61A783DD2`、
  `0DFF341CBF571B12410A101B5151BEB1742B0A71BCF3165E6570CEF998940FD7`、
  `F140138ACB75FD6E54B2A0286CE23C70018C174FB9FC08B1DA96464035BFB897`。
- Packaged：首次 cold startup `5.81s` 超过 5s 性能门并保留为失败；立即复测
  `4.46s` 通过。当前源码 NSIS install/update 和 startup 通过，安装路径为
  `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`，startup `3.41s`，
  sidecar 哈希一致，single-instance/adopt-existing 通过；locked 状态下 runtime
  paths 正确跳过，no failures。
- 当时独立 Evidence Collector 与 Reality Checker 仅对该次修正给出 PASS。更广
  的逐 Frame 人工签收仍未完成；当时 MSI 与 9 组 packaged business regressions
  尚未重跑。该历史 pending 状态已由下方较晚的 T105/T106 checkpoint 取代。

## T105/T106 自动、动态、安全与 packaged 验收（2026-07-22 当前 checkpoint）

本节是 2026-07-22 较晚的当前口径，取代上方“MSI/9 组尚未重跑”的当时状态，
但不改写其历史事实。

- T105：`logs/t105-security-state-regression-red-before-fix.json` 保留修复前
  permanent loading 与无 Retry 的 RED；
  `logs/t105-security-state-regression-latest.json` 为 GREEN。route applicability
  `79/79`，runtime state `491/491`。
- T106：state/theme/viewport `3928/3928` screenshots；dual theme `632/632`；
  base screenshots `316/316`；Route Workspace structure `316/316` 且 rate
  warnings `0`；SVG automated geometry/style/structure `79/79`。
- 人工门：`logs/t106-human-review/index.json` 生成 16 张 contact sheets，覆盖
  79 Frames，`humanSignoff=pending`。
- 验证：typecheck、production web build、Cargo check、105 backend tests、350
  files public-boundary scan、T102–T106 contract check 均通过。
- 当前源码：`sourceFileCount=302`，source manifest SHA-256
  `3C89FB64E56979B847A3AC1D6E464DB07F2C5672D0EA3693164DABEFCEA11872`；
  sidecar、EXE、MSI、NSIS SHA-256 分别为
  `591F6101F5941E7DBA2B499E7B1F50091B1425A841D8591289A58E55ABFA9D5C`、
  `67522D785ECA95F169146386D2648CE8EA786CFD028DF5208837F2EB8A0F734C`、
  `04B52F02EC014FC2149780BF578AE34015790E57C416AE661EBD2C151E05625E`、
  `727DB3C317D5594C86EBAF6F5B4ACB0804F9039D678906F8D6CA5D645A8CB178`。
- Packaged：9 组业务回归 `9/9`；profile original/backup/restored manifest SHA-256
  均为 `DF8E7DA935F67597D28FC87606A802EEC36AF13E990EEC4AE0A045183F627311`。
  Full local-security lifecycle 通过、SQLite plaintext secret 为 false、profile
  已恢复；source EXE `3.42s`、MSI `3.92s`、NSIS `2.90s` 均通过，installed
  sidecar 与 build 一致。AppData log/data 为 `skipped_locked`，不计为已验证。
- 状态：T102–T104 `Implemented / Acceptance Pending`；T105 `In Progress /
  Acceptance Pending`（自动/动态/安全验收通过）；T106 `Automated Rule Passed /
  Human Signoff Pending`；T107 冻结；M1 不关闭。

## M1 继续执行结果（2026-07-17 历史 checkpoint）

本节仅保留 2026-07-17 当日事实；当前源码、产物哈希和未完成边界以上方
2026-07-22 T102 全路由双主题与 Manual 工作区修正为准。

- 路由能力矩阵：79/79；68 个真实业务页面，11 个计划阻断页。
- 动态验收：`logs/all-subpages-runtime-smoke.json` 为 79/79；`logs/full-route-evidence.jsonl` 为 316/316，未接受 loading 终态。
- 页面整改：资产搜索恢复整行结果列表；独立 AI 修正为自动化导航上下文；Data Sources preview 按 provider 独立呈现。该日采用的固定业务面合同已由 2026-07-21 Route Workspace 结构修正取代。
- 桌面验收：`logs/m1-packaged-regression-latest.json` 为 9/9，用户资料备份与恢复清单一致；MSI/NSIS 安装启动日志均无失败。
- 当日安装：桌面快捷方式指向 `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`，当日 MSI 与 NSIS 安装均通过。安装目录 EXE 与 release 裸 EXE 等长、版本同为 0.1.0，仅有一个连续 3-byte 的 Tauri bundle-type 元数据差异。
- 当日发布清单：`logs/m1-release-manifest.json` 在当日的源码清单 SHA-256 为 `AB7F3C3D6E8C76188CD46CBE6DD5C1E27DCFB977F1262D8562E9168542272508`；该历史哈希不得当作 2026-07-22 当前源码证据。
- 自动视觉门：`logs/visual-acceptance/index.json` 为 79/79 几何、79/79 style、79/79 structure、79/79 legal-mask artifacts；raw full-frame pixel 0/79 仅作诊断。未关闭项为 human signoff、T105 完整状态矩阵和独立验收，T107 不启动。
- 完整交接见 `docs/m1-subpage-packaged-checkpoint-2026-07-17.md`。

## Validation Principle

## M1 历史暂停记录（2026-07-15 17:28 CST，已于 2026-07-17 续跑）

当时在 packaged Research AI 回归期间按用户要求强制暂停。该记录仅保留历史上下文；packaged 工作流和 MSI/NSIS 安装启动已在 2026-07-17 续跑并通过。暂停时的完整交接见 `docs/m1-pause-handoff-2026-07-15.md`，2026-07-17 checkpoint 见 `docs/m1-subpage-packaged-checkpoint-2026-07-17.md`；当前状态、产物和未完成边界以本文上方 2026-07-22 口径为准。

Pengbo is desktop software, so important release-readiness claims should be
validated against the real packaged executable when the task touches packaged
runtime behavior. Browser-only checks are useful for fast UI feedback but are
not sufficient for packaged desktop signoff.

The current local unsigned packaging checklist is tracked in
[docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md).

## 2026-07-15 页面内容修复

`src/routes/route-content.tsx` 已替换 79 路由通用三行占位内容，按页面族补齐
Dashboard、资产、研究、数据源、因子、策略、工作流、筛选、组合、连接、设置、手册和
AI Assistant 的主任务、指标、图表/表格/配置/时间线/检查清单及来源标记。
`src/routes/page-loaders.ts` 增加有限 API 超时并降级到确定性 fixture，防止公开页面永久 loading。
详细记录见 [docs/route-content-repair-2026-07-15.md](docs/route-content-repair-2026-07-15.md)。
本阶段仍为整改中，尚未宣称与 SVG 完全一致。
