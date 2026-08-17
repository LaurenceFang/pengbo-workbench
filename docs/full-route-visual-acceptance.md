# Pengbo UI 全路由视觉验收记录

更新时间：2026-07-22

## 当前结论

获准的 M1 自动视觉规则已实施并通过，但 M1 尚未关闭。

- 79 条深层 URL 全部注册：68 条 available 路由挂载 T1–T101 真实业务组件，11 条 future 路由进入带任务号和恢复动作的 blocked 状态。
- 每个路由终态只保留一个 route page、一个 route-family page 和一个 primary task；生产环境不再使用通用 `route-content` 或 14-View mega-page 覆盖。
- `smoke:all-subpages-runtime` 为 79/79；`smoke:all-routes-render` 为 316/316，未接受 loading 终态。
- 获准 SVG 自动规则为 79/79：geometry 79、rendered style 79、structure 79、legal-mask artifacts 79。
- Route Workspace 结构为 316/316：透明 `route-child-workspace` 是
  `RoutePageFrame` 的直接子级，并且只包含当前 route-family page；父 Workspace
  负责纵向滚动；生产状态图例为 `0`，旧通用
  `820x500` 外框为 `0`。
- 2026-07-22 当前口径补充：全 79 路由 light/dark×四视口为 `632/632`，Manual
  5 页为 `40/40`，主题偏好生命周期通过；当前源码 NSIS 安装启动为 `3.41s`。
  首次 cold startup `5.81s` 仍为性能失败，locked 状态下 AppData runtime paths
  为 `skipped_locked`，因此未验证。
- raw full-frame pixel 仍为 0/79，仅作诊断。原因是注册 SVG 的业务主区循环使用通用图表/表格/表单/阻断占位，而真实页面必须保留 T1–T101 功能。
- T105 route applicability `79/79`、runtime states `491/491` 及 security
  RED-before/GREEN-after 已通过。剩余全局门是 T106 的 79 Frame 人工
  expected/edge/failure 签收，因此 `m1ExitEligible=false`，T107 继续冻结。

## 获准验收规则

当前 SVG 为 79 Frames / 79 routes，大小 `1,170,776 bytes`，SHA-256 为：

`206E6C79553594070FE7ADE443D97094AC8016E515B19AE8F49B9B3544028CAF`

1440×900 自动门由三部分组成：

1. 严格壳层：Toolbar、Sidebar、80px Subroute contract row、Context Inspector
   的几何和 rendered style token 必须符合 SVG 合同；生产页面不得渲染状态图例。
2. 直接业务工作区：透明 `route-child-workspace` 必须是 `RoutePageFrame` 的
   直接子级，并且只包含当前 route-family page；不得增加通用边框、固定高度或
   嵌套滚动；父 Workspace 负责纵向滚动。
   真实业务内容遮罩为 `x=274, y=174, width=820, height=702`，直接子级的
   位置和透明边界另行严格校验。
3. 结构/功能：每页必须进入稳定终态，且只有一个真实 route page、一个
   family page、一个 primary task 和一个 active subroute；旧通用 route surface
   与生产状态图例必须为 0；计划路由必须显示任务号和恢复动作；禁止 loading 伪通过。

每个 Frame 生成 reference、actual、raw diff、masked actual、masked diff 和几何/样式结果。raw pixel 和 chrome pixel 继续保留为诊断数据，不替代获准规则。

## 2026-07-22 具体页面布局补充验收

本轮在既有 79 路由/SVG 门禁之外，增加用户点名页面的定向布局与浅色主题可读性
检查；它不替代逐 Frame 人工签收，也不改变 T105/T106 全局状态。

- 覆盖 24 条目标路由，在 1600×900、1440×900、1180×900、960×900 四档
  视口运行，共 `96/96` 通过、0 failures。
- 测试强制并记录 light theme；可见文本抽样最低对比度为 `4.72`。Frame 22
  标题/section 对比度为 `16.32`，证据描述最低对比度为 `5.38`。
- Research `基本面与文件` 灰色内容区为 `max-height: none`、
  `overflow: visible`、无嵌套滚动，subwindow-to-primary width ratio 为 `1`。
- Asset 四页、Portfolio 五页以及 routed Workflow/Screener 工作区占用完整可用
  route workspace；960px Toolbar 的 AI/lock 控件保持紧凑且未逐字竖排。
- 证据：`logs/page-layout-correction-smoke.json`，生成时间
  `2026-07-22T06:00:58.226Z`，SHA-256
  `93DC7E482984B7FAC4D565FA01029BDB7D57FFEB78A7FFBA0AC934A79EAA67FE`。

在该较早 page-layout checkpoint，dirty source 随后执行 `npm.cmd run
tauri:build`，生成 web、clean
PyInstaller sidecar、release EXE、MSI 和 NSIS。首次 cold packaged startup
`7.15s` 超过 5s 目标，作为一次性能失败保留；随即复测 `4.51s` 通过且
`failures=[]`。当前源码 NSIS 安装/启动通过：install exit `0`、
`health_ready=true`、ready `3.93s`、`failures=[]`，且安装 sidecar 哈希与构建
sidecar 一致。当时 MSI 安装启动和完整 9 组 M1 packaged regression 尚未执行；
该 pending 状态已由下方较晚的 T105/T106 checkpoint 取代。

## 2026-07-22 全路由双主题与 Manual 工作区验收

- `src/styles.css` 将 Manual 5 个 route page 的工作区统一为全宽单列、自然高度和
  visible overflow；`scripts/full_route_theme_smoke.mjs` 对全部 79 路由执行
  light/dark 与四视口检查，并单独记录 Manual 几何和嵌套滚动合同。
- Manual 5 个子页面使用全宽单列、自然高度且无嵌套纵向滚动；两主题、四视口
  共 `40/40`，均为 `widthRatio=1`、`column=1`、`overflow: visible`、`nested=0`。
- `logs/full-route-theme-smoke.json` 覆盖 79 路由×2 themes×4 viewports，共
  `632/632`、632 screenshots、0 console errors、0 page errors；生成时间
  `2026-07-22T07:00:11.574Z`，SHA-256
  `09EE577A752E66D37B82627C42A81F2F93B5127B044BC275AD755D6B234F8A7E`，
  screenshot-corpus SHA-256
  `28123E7463385FECBA910A01D390D2F819E61D2927EF51CCE4637DB3757B4E2A`。
- Page-layout 复核为 `96/96`，SHA-256
  `0D3328AD0E3419D26EE55815203B8BFFDAFA1B30552DB479CC403976C91B5A97`；
  Route Workspace 为 `316/316`，SHA-256
  `64893B39D802BD4CCF824C401623AFA91B6FA6681EA370DAB9030C2E1D5AAA5B`。
- 主题偏好从默认 light、预览/保存 dark、后端重启恢复 dark，到 reset light 的
  GET 与 DOM 全部通过；证据 SHA-256
  `0A21303F16DBB86D9D1BBF38BAEFC6EAB241D12EBFE441B9AEC81CBF9848A09A`。
- `npm.cmd run typecheck`、`npm.cmd run build`、`npm.cmd run
  check:theme-preference` 通过。Evidence Collector 和 Reality Checker 独立复核
  仅对本次修正给出 PASS。
- 在该较早 dual-theme checkpoint，源码重新打包；首次 cold startup `5.81s`
  超过 5s 性能门，立即复测
  `4.46s` 通过。NSIS current-source install/update 与启动通过，startup `3.41s`，
  sidecar 哈希一致，single-instance/adopt-existing 通过，locked 状态下 runtime
  paths 正确跳过且无 failures。当时 MSI 安装和完整 9 组 packaged business
  regressions 尚未重跑；该 pending 状态已由下方较晚 checkpoint 取代。

## 2026-07-22 T105/T106 当前验收 checkpoint

本节为较晚的当前源码结果；前述 MSI/9 组未重跑记录保留为当时历史状态。

- T105 sidecar-offline permanent loading 已修复：RED 证据为
  `logs/t105-security-state-regression-red-before-fix.json`，GREEN 当前证据为
  `logs/t105-security-state-regression-latest.json`。route applicability 为
  `79/79`，runtime state 为 `491/491`。
- T106 state/theme/viewport 为 `3928/3928` screenshots；dual theme 为
  `632/632`；base screenshots 为 `316/316`；Route Workspace structure 为
  `316/316` 且 rate warnings `0`；SVG automated geometry/style/structure 为
  `79/79`。
- `logs/t106-human-review/index.json` 生成 16 张 contact sheets，覆盖 79
  Frames，`humanSignoff=pending`。自动结果不得替代人工 expected/edge/failure
  逐 Frame 批准。
- Typecheck、production web build、Cargo check、105 backend tests、350 files
  public-boundary scan、T102–T106 contract check 均通过。
- 当前 release manifest 为 `sourceFileCount=302`，source manifest SHA-256
  `3C89FB64E56979B847A3AC1D6E464DB07F2C5672D0EA3693164DABEFCEA11872`。
  Artifact SHA-256：sidecar
  `591F6101F5941E7DBA2B499E7B1F50091B1425A841D8591289A58E55ABFA9D5C`；
  EXE `67522D785ECA95F169146386D2648CE8EA786CFD028DF5208837F2EB8A0F734C`；
  MSI `04B52F02EC014FC2149780BF578AE34015790E57C416AE661EBD2C151E05625E`；
  NSIS `727DB3C317D5594C86EBAF6F5B4ACB0804F9039D678906F8D6CA5D645A8CB178`。
- Packaged 业务回归 `9/9`；profile original/backup/restored manifest SHA-256
  均为 `DF8E7DA935F67597D28FC87606A802EEC36AF13E990EEC4AE0A045183F627311`。
  Full local-security lifecycle 通过，SQLite plaintext secret 为 false，profile
  已恢复。Source EXE startup `3.42s`、MSI `3.92s`、NSIS `2.90s` 均通过；
  installed sidecar 与当前 build 一致。AppData log/data 为 `skipped_locked`，
  是预期安全阻断，不是路径验证。
- 桌面安装已更新到
  `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`。
- 状态保持：T102–T104 `Implemented / Acceptance Pending`；T105 `In Progress /
  Acceptance Pending`（自动/动态/安全验收通过）；T106 `Automated Rule Passed /
  Human Signoff Pending`；T107 frozen；M1 未关闭。

## 本轮实现

- `src/styles.css`：补充浅色主题可读性 authority，并纠正 Research、Asset、
  Portfolio、Workflow、Screener 目标路由的宽度、高度和 overflow 合同；960px
  Toolbar 使用紧凑图标/标签布局；Research Decision 的标题、证据/来源卡背景、
  边框和说明文字使用可读浅色语义。
- `scripts/page_layout_correction_smoke.mjs`：对 24 条点名路由执行四视口布局、
  浅色主题对比度、Research 嵌套滚动和 960px Toolbar 定向断言；
  `researchDecision` 与 `researchAssetData` 走真实研究简报导航，并增加研究决策/
  证据文字对比断言与本地 API 有界重试。
- `src/routes/route-workspace-adapter.tsx`：ready/loading/error/locked/blocked
  共用 Subroute contract row；真实业务 View 直接挂载为 route-family workspace，
  future 路由保留完整 blocked/recovery 页面结构。
- `src/styles.css`：移除通用固定高度业务外框和生产状态图例；真实业务子工作区
  保持透明、自然高度且不创建嵌套纵向滚动，由父 Workspace 承担滚动。
- `scripts/svg_visual_acceptance.mjs`：实施严格壳层、合法业务区遮罩、结构/终态断言和全套差异产物。
- `scripts/m1_web_acceptance.ps1`：以临时本地数据目录编排 79 路由、视觉、316 截图和导航/状态合同。
- `src/views/data-sources-view.tsx`：`/markets/data-sources/:provider/preview` 按 URL provider 独立呈现宏观、A 股、Crypto 或新闻，不再在一页堆叠。
- `backend/app/services/local_security_service.py` 与 `backend/app/storage/sqlite_store.py`：以 compare-and-swap 防止过期快照覆盖较新的成功解锁；新增并通过并发回归测试。

## 自动与 packaged 证据

| 门禁 | 结果 | 证据 |
| --- | --- | --- |
| TypeScript | 通过 | `npm.cmd run typecheck` |
| Production build | 通过 | `npm.cmd run web:build` |
| T102–T106 contract | 通过 | `npm.cmd run check:t102-106` |
| T102 具体页面布局/浅色对比度 | 96/96 | `logs/page-layout-correction-smoke.json` |
| T102 full-route light/dark | 632/632 | `logs/full-route-theme-smoke.json` |
| T102 Manual workspace | 40/40 | `logs/full-route-theme-smoke.json` |
| Theme preference lifecycle | 通过 | `logs/theme-preference-screenshots/theme-preference-smoke-latest.json` |
| Independent correction review | PASS（仅本次修正） | Evidence Collector / Reality Checker |
| 2026-07-22 current-source Tauri build | 通过 | `logs/m1-release-manifest.json` |
| 2026-07-22 packaged startup retest | 通过 | `logs/packaged-startup-smoke-latest.json` |
| T105 security RED/GREEN | 通过 | `logs/t105-security-state-regression-red-before-fix.json`、`logs/t105-security-state-regression-latest.json` |
| T105 route applicability | 79/79 | `logs/t105-route-state-matrix.json` |
| T105 runtime state | 491/491 | `logs/t105-route-state-runtime.json` |
| T106 state/theme/viewport | 3928/3928 screenshots | `logs/t106-route-state-visual.json` |
| T106 human contact sheets | 16 sheets / 79 Frames；pending | `logs/t106-human-review/index.json` |
| Cargo check | 通过 | `cargo check` |
| Backend tests | 105 passed | backend test suite |
| Public boundary | 通过，350 files | public-boundary check |
| Earlier 2026-07-22 MSI checkpoint | 未执行 | 已由下方当前源码结果取代 |
| Earlier 2026-07-22 packaged 9-group checkpoint | 未执行 | 已由下方当前源码结果取代 |
| SVG registry | 79/79 | `logs/svg-frame-registry.json` |
| Route Workspace structure | 316/316 | `logs/route-workspace-structure-smoke.json` |
| Route runtime | 79/79 | `logs/all-subpages-runtime-smoke.json` |
| SVG approved rule | 79/79 | `logs/visual-acceptance/index.json` |
| Four-viewport evidence | 316/316 | `logs/full-route-evidence.jsonl`、`logs/full-route-screenshots/` |
| Direct/history/404/AI | 通过 | `logs/route-contract-smoke.json` |
| Independent T102 reality check | 核心结构通过；T105/M1 阻断项已记录 | `logs/t102-route-workspace-reality-check.json` |
| Packaged business regression（2026-07-22 当前源码） | 9/9 | `logs/m1-packaged-regression-latest.json` |
| Packaged local security（2026-07-22 当前源码） | 完整 lifecycle 通过；plaintext false | `logs/local-security-packaged-smoke-latest.json` |
| Source EXE startup | 通过，3.42s | `logs/packaged-startup-smoke-latest.json` |
| MSI installed startup（2026-07-22 当前源码） | 通过，3.92s | `logs/installed-bundle-startup-smoke-latest.json` |
| NSIS installed startup（2026-07-22 当前源码） | 通过，2.90s | `logs/installed-bundle-startup-smoke-nsis-latest.json` |

上一版 2026-07-22 Page Layout correction dirty source 清单
（`sourceFileCount=296`）SHA-256：

`5E593330D890E72D8A016F7E6BB5ED15CCD9848CDF6DCFE81F5C96DFFF0A6D8B`

当前构建 artifact SHA-256：

- sidecar: `3697E49E3EA5C1EC9083B9422F310DC1E7D9B3F1B1485A6CF7F99AF83EAD0092`
- release EXE: `3924BFBF60E741BCDAD1665DB9D3868E08654C7BD4676CED39E27FD01E9BBF25`
- MSI: `19791405F2E13465673211E93DD1B2D5F988F3F50D8C42A51FAF4386F4FD4890`
- NSIS: `9BCAFABD8A499E0D3319462DB4024C718D5106308FC2835B095DAF6B561A3EDE`

本轮 Full-route Dual-theme correction 当前 dirty source 清单
（`sourceFileCount=297`）SHA-256：

`F94EF4CB11A397944573EFC506A800221B029A8EB2B22AA9F202DFBC0EAA446F`

`logs/m1-release-manifest.json` 文件 SHA-256：

`B2F4E160EAE5A56BA7C6B22453943E54906280D67CB5B3FCF4653FEF1E9D99FA`

test-only theme reset 检查不在 bundle source 清单内，因此本次更新 manifest
文件自身哈希，但 297 文件 source manifest 与构建 artifact hashes 均不变。

本轮构建 artifact SHA-256：

- sidecar: `CB518863B957728A00521D49DB8710569E03F35BAAA869051DB06BED75E3927D`
- release EXE: `FF7123BACBA2FB99387472A310CEB490230E2529B2A8B92522EA24D61A783DD2`
- MSI: `0DFF341CBF571B12410A101B5151BEB1742B0A71BCF3165E6570CEF998940FD7`
- NSIS: `F140138ACB75FD6E54B2A0286CE23C70018C174FB9FC08B1DA96464035BFB897`

当前 T105/T106 checkpoint source 清单（`sourceFileCount=302`）SHA-256：

`3C89FB64E56979B847A3AC1D6E464DB07F2C5672D0EA3693164DABEFCEA11872`

当前 checkpoint artifact SHA-256：

- sidecar: `591F6101F5941E7DBA2B499E7B1F50091B1425A841D8591289A58E55ABFA9D5C`
- release EXE: `67522D785ECA95F169146386D2648CE8EA786CFD028DF5208837F2EB8A0F734C`
- MSI: `04B52F02EC014FC2149780BF578AE34015790E57C416AE661EBD2C151E05625E`
- NSIS: `727DB3C317D5594C86EBAF6F5B4ACB0804F9039D678906F8D6CA5D645A8CB178`

2026-07-21 历史 packaged profile 清单 SHA-256：

`48FF250954FD6FB085CB597F7464F3F76F32F0C508D85B1A3258F49267E9A0E2`

2026-07-22 当前 packaged profile original/backup/restored 清单 SHA-256 均为：

`DF8E7DA935F67597D28FC87606A802EEC36AF13E990EEC4AE0A045183F627311`

当前包完整 local-security lifecycle 已通过，SQLite plaintext-secret scan 为
false 且 profile 已恢复。安装启动时真实本地安全状态为 locked，因此
AppData-backed Settings runtime 数据/日志路径被明确记录为 `skipped_locked`，
不是“已验证”。

## 未完成项

1. T105 自动/动态/安全门已通过；其状态保持 `In Progress / Acceptance Pending`
   直到 M1 全局人工门关闭。
2. 关闭 T106 人工门：对 79 个 Frame 逐一复核 expected、edge 和 failure
   路径，包括真实 WebView 的敏感页面 locked→unlock→ready UI 链；不得用
   `3928/3928`、`632/632` 或 `316/316` 自动结果替代逐 Frame 签收。
3. 当前源码 MSI/NSIS 安装启动和完整 9 组 packaged 业务回归已经通过，不再列为
   pending；AppData `skipped_locked` 路径继续明确为未验证范围。
4. 上述门禁全部通过后，才能关闭 T102–T106、结束 M1 并解冻 T107。
