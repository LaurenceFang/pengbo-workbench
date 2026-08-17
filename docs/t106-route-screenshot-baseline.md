# T106 全路由截图基线执行记录

更新时间：2026-07-22

状态：`In Progress / Automated Rule Passed, Human Signoff Pending`

## 2026-07-17 历史基础覆盖

- 注册 SVG：79 Frame / 79 route
- Viewport：1440×900、1600×1000、1180×820、960×820
- 终态证据：316/316
- 截图：316/316
- 获准自动 SVG 规则：geometry 79/79、style 79/79、structure 79/79、legal mask artifacts 79/79
- raw full-frame pixel：0/79，仅作诊断
- human signoff：pending

执行命令：

```text
npm.cmd run smoke:t106-route-baseline
```

该命令汇总并校验：

- `logs/svg-frame-registry.json`
- `logs/full-route-evidence.jsonl`
- `logs/full-route-screenshots/`
- `logs/visual-acceptance/index.json`

结果写入 `logs/t106-route-screenshots/index.json`。

## 验收边界

自动门严格验证 SVG 壳层几何和 rendered style，并只在真实业务主区内部使用获准遮罩；同时要求每条路由只有一个 route page、一个 primary task、稳定终态和适用的恢复动作。完整 SVG raw pixel 继续保留，因为它能显示注册 SVG 通用占位内容与真实业务内容之间的差异，但它不再是获准的完成门。

## 2026-07-22 当前 checkpoint

- T105 sidecar-offline permanent security loading 已修复；RED-before 为
  `logs/t105-security-state-regression-red-before-fix.json`，GREEN latest 为
  `logs/t105-security-state-regression-latest.json`。
- T105 route applicability `79/79`，runtime state `491/491`。自动、动态和
  security acceptance 已通过；T105 board 状态仍为 `In Progress / Acceptance
  Pending`，等待 M1 全局人工门关闭。
- T106 `logs/t106-route-state-visual.json` 为 `3928/3928` state/theme/viewport
  screenshots；dual theme `632/632`；base screenshots `316/316`；Route
  Workspace structure `316/316` 且 rate warnings `0`；approved SVG
  geometry/style/structure `79/79`。
- `logs/t106-human-review/index.json` 生成 16 张 contact sheets，覆盖全部 79
  Frames，`humanSignoff=pending`。
- Typecheck、production web build、Cargo check、105 backend tests、350-file
  public-boundary scan、T102–T106 contract check 均通过。
- 当前源码 `sourceFileCount=302`，source manifest SHA-256
  `3C89FB64E56979B847A3AC1D6E464DB07F2C5672D0EA3693164DABEFCEA11872`。
  Artifact SHA-256：sidecar
  `591F6101F5941E7DBA2B499E7B1F50091B1425A841D8591289A58E55ABFA9D5C`；
  EXE `67522D785ECA95F169146386D2648CE8EA786CFD028DF5208837F2EB8A0F734C`；
  MSI `04B52F02EC014FC2149780BF578AE34015790E57C416AE661EBD2C151E05625E`；
  NSIS `727DB3C317D5594C86EBAF6F5B4ACB0804F9039D678906F8D6CA5D645A8CB178`。
- Current-source packaged regression `9/9`；profile original/backup/restored
  manifest SHA-256 均为
  `DF8E7DA935F67597D28FC87606A802EEC36AF13E990EEC4AE0A045183F627311`。
  Full local-security lifecycle 通过、SQLite plaintext secret 为 false、profile
  已恢复。Source EXE startup `3.42s`、MSI `3.92s`、NSIS `2.90s` 均通过，
  installed sidecar 与 build 一致。
- 桌面安装已更新到
  `E:\彭博自用情况\Pengbo Workbench\pengbo-workbench.exe`。Locked 状态下
  AppData log/data 为 `skipped_locked`，属于预期安全阻断而非路径验证。
- 状态保持：T102–T104 `Implemented / Acceptance Pending`；T105 `In Progress /
  Acceptance Pending`；T106 `Automated Rule Passed / Human Signoff Pending`；
  T107 frozen；M1 未关闭。

## 尚未完成

T106 不能关闭，直到：

1. 79 个 Frame 逐项完成人工签收；
2. 人工 expected、edge 和 failure 复核确认 contact sheets；
3. 真实 WebView 敏感页面 locked→unlock→ready UI 链完成人工签收。

T105 状态矩阵、当前源码 MSI/NSIS 和 9 组 packaged regressions 已通过，不再列为
T106 未完成项。自动证据不能替代上述人工批准。
