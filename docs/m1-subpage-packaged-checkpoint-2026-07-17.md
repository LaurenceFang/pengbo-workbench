# M1 子页面、SVG 自动规则与 packaged 执行记录（2026-07-17）

> 历史记录：本文保留 2026-07-17 当时的原始事实与验收口径。其固定业务面、
> Inspector/状态条结构合同已由 `T102 - Route Component Library / 2026-07-21
> Route Workspace 结构修正`取代；当前结论以
> `docs/full-route-visual-acceptance.md`、`PLAN.md` 和 `IMPLEMENTATION_TASKS.md`
> 为准。本文其余内容不回写为当前规则。

## 结论

本轮已完成真实子页面分发、获准 SVG 自动验收规则、当前源码封装、9 项 packaged 业务回归、packaged 本地安全回归，以及 MSI/NSIS 安装更新。M1 仍保持 `Acceptance Pending`，因为逐 Frame 人工签收、T105 完整状态矩阵和独立验收尚未完成。

当前状态：

- T102：`Implemented / Acceptance Pending`
- T103：`Implemented / Acceptance Pending`
- T104：`Implemented / Acceptance Pending`
- T105：`In Progress / Acceptance Pending`
- T106：`In Progress / Automated Rule Passed, Human Signoff Pending`
- T107：冻结

## 本轮关键修正

- 79 条 SVG 路由进入真实 React Router 分发；68 条 available 路由使用真实业务组件，11 条 future 路由显示任务号、缺失条件和恢复动作。
- Dashboard、Asset、Data Sources、Research、Factor Lab、Strategy Lab、Workflow Studio、Screeners、Portfolio、Connections、Settings、Manual 和 AI Assistant 均按 route section 隔离。
- 统一 `usePengboNavigation` 供 Sidebar、SubrouteNav、搜索、Command Palette、Handoff 和 AI 入口更新 URL/history。
- `/ai-assistant` 保留本地和云端配置、运行状态与 opt-in 边界，不伪造模型输出。
- Data Sources provider preview 不再堆叠四类数据：World Bank/FRED/HKMA/DBnomics、Tushare、CoinGecko、RSS 分别显示自己的预览页。
- 1440×900 的业务面、Inspector 和状态条严格按 SVG 边界布局；1600/1180/960 响应式合同继续通过。
- Workflow packaged 自动化等待真实 WebView 可访问树，不再把“窗口句柄已出现、页面树未就绪”误判为页面缺失。
- 本地安全 idle-expiry 使用 compare-and-swap，避免陈旧过期请求覆盖较新的成功解锁。

## 自动验收结果

| 门禁 | 结果 |
| --- | --- |
| TypeScript | 通过 |
| Production build | 通过 |
| 79 route runtime | 79/79 |
| Available / planned | 68 / 11 |
| SVG geometry | 79/79 |
| SVG rendered style | 79/79 |
| Route structure | 79/79 |
| Legal mask artifacts | 79/79 |
| Four-viewport terminal evidence | 316/316 |
| Direct URL / history / 404 / AI | 通过 |
| Packaged business regression | 9/9 |
| Packaged local security | 通过 |
| MSI installed startup | 通过，0 failures |
| NSIS installed startup | 通过，0 failures |

`logs/visual-acceptance/index.json` 仍记录 raw full-frame pixel 0/79，但该数据只作诊断。获准规则严格验收壳层，并仅对真实业务主区内部使用合法遮罩，同时强制结构、稳定终态和恢复动作。

## 当前源码安装包

构建命令：`npm.cmd run tauri:build`

源码清单：

- 文件数：293
- SHA-256：`18C17638446F67A3B1AD2BF7F1ED2151A6C0E491C5EB9C0588A281219A61C5E9`
- 完整记录：`logs/m1-release-manifest.json`

| 产物 | SHA-256 |
| --- | --- |
| sidecar | `796DCC476BCCB4CC241E71A8270AEE7A22EDF6CADFF84E38F075394088743218` |
| portable EXE | `A63E0019EE554D983468E4F83A8FC4198ADDDE2BAF7F55D9000B39DC2EF26BB6` |
| MSI | `B7F29E93991D18CD8AC93D26636C50C094B255D63211CA448E9DFC7095A98125` |
| NSIS | `E55503F1B8F71EEF46DAD3BE53168914F2E4DADB68E16F922DEE5A3F36A5D162` |

MSI 与 NSIS 均已真实安装到：

`E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`

用户桌面、公共桌面和开始菜单快捷方式均指向该文件。以后手动更新优先双击：

`E:\彭博\src-tauri\target\release\bundle\nsis\Pengbo Workbench_0.1.0_x64-setup.exe`

安装目录 EXE 与 `target/release` 裸 EXE 的长度均为 17,109,504 bytes，文件版本和产品版本均为 0.1.0。两者 SHA-256 不同是 Tauri 为 bundle type 写入元数据所致；逐字节检查仅在 offset 12,728,104–12,728,106 存在一个连续 3-byte 差异，不是旧应用未覆盖。

## 仍未同步为“完成”的部分

1. 79 个 Frame 的逐项人工签收仍为 pending。
2. T105 全量 per-route 状态矩阵仍未关闭。
3. 独立 expected/edge/failure 复核，以及真实 WebView 敏感页面 locked→unlock→ready UI 链仍未签收。
4. 因此不能关闭 M1，也不能解冻 T107。

本轮没有执行 commit 或 push。
