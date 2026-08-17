# T102–T106 完整前端设计方案

状态：T102 `Implemented / Acceptance Pending`；T105 不变；T106
`Automated Rule Passed, Human Signoff Pending`；T107 冻结。

视觉执行以注册的 `E:\彭博\Pengbo_UI_Rebuild.svg` 为基线；代码必须实现
full-screen route、直接 route-family workspace、Context Inspector 和
contextual AI 的结构关系，不得将 Inspector 或通用外框当作 route 替代物。

## T102 - Route Component Library / 2026-07-21 Route Workspace 结构修正

- SVG：79 Frames / 79 routes，`1,170,776 bytes`，SHA-256
  `206E6C79553594070FE7ADE443D97094AC8016E515B19AE8F49B9B3544028CAF`。
- 每个 route page 直接承载唯一的 route-family workspace；业务内容使用自然
  高度，父 Workspace 负责纵向滚动，子工作区不得建立通用边框或嵌套滚动。
- 生产状态图例数量必须为 `0`，旧通用 `820x500` 外框数量必须为 `0`。
- 结构 `316/316`、子页面运行时导航 `79/79`、SVG
  geometry/style/structure `79/79`、截图 `316/316`；typecheck、build 和
  T102–T106 contract check 均通过。
- 人工逐 Frame 签收仍待完成；本结构修正不改变 T105，不关闭 T106，不解冻 T107。

## 1. 设计方向

### Editorial Research Terminal

Pengbo 采用“编辑式投研终端”方向：像研究工作台一样有证据层级，像专业终端一样有数据密度，但每个页面只服务一个任务。

DFII 评估：

| 维度 | 分数 | 判断 |
|---|---:|---|
| 识别度 | 4/5 | 以“研究纸张 + 数据轨道 + 证据编号”形成独特识别 |
| 场景适配 | 5/5 | 适合投研、数据质量和审计场景 |
| 实现可行性 | 5/5 | React/Tauri 可用常规布局、表格和路由实现 |
| 性能安全 | 4/5 | 不依赖重动画和大面积图片 |
| 一致性风险 | 1/5 | 通过 token、页面模板和状态组件控制 |
| DFII | 17/20 | 采用 |

核心识别锚点：每个页面顶部都有“任务标题 + 当前范围 + 数据新鲜度”，主内容通过左侧证据编号和右侧上下文轨道建立研究感，而不是依靠装饰。

## 2. 全局视觉系统

### 色彩

```css
--canvas: #eef3ef;
--canvas-deep: #e2ebe5;
--surface: #ffffff;
--surface-muted: #e7efea;
--surface-selected: #d8eee5;
--ink: #13231e;
--ink-muted: #52645c;
--ink-disabled: #8a9891;
--line: #c8d7cf;
--line-strong: #aebfb5;
--accent: #168a68;
--accent-deep: #0d654c;
--info: #326b9a;
--warning: #a86b16;
--danger: #b54a4a;
--success: #15805f;
--sidebar: #172821;
--sidebar-ink: #e8f2ec;
```

禁止使用纯黑背景、纯白文字、低对比灰字和仅依靠颜色表达状态。所有状态必须同时具备图标、文字或字段说明。

### 字体

- 展示标题：`Source Serif 4`，只用于页面标题、研究结论和报告标题。
- 正文与控件：`IBM Plex Sans`，中文回退 `Noto Sans SC`, `Microsoft YaHei`, sans-serif。
- 标的代码、时间、ID、数据值：`IBM Plex Mono`, ui-monospace。
- 正文 14–16px，辅助信息最低 12px；标题 20/24/32px；行高 1.5–1.65。
- 数字默认右对齐，单位和时间戳必须明确；不要用全大写缩写作为主要信息。

### 尺寸与空间

- 基础间距：4px；主要节奏：8/12/16/24/32/48px。
- 页面最大内容宽度 1440px；窄屏使用单主列，不强行压缩三栏。
- 主导航 240px；上下文轨道 280px；内容区最小 620px。
- Route Workspace 不设置统一固定高度；长内容由父 Workspace 纵向滚动，
  route-family 子工作区保持自然高度且不出现第二层纵向滚动。
- 卡片只用于边界和分组，不用卡片数量制造信息架构。
- 每页最多一个视觉主焦点；辅助信息通过边框、编号和留白建立层次。

### 动效

- 页面进入：标题、范围条、主内容按 80ms 间隔淡入，最多一次。
- 数据刷新：只在数据区域显示轻量进度，不让整页跳动。
- 选中、展开、成功反馈使用 120–180ms；无循环装饰动画。
- 锁定、阻断和危险操作不使用会弱化含义的弹跳动画。

## 3. App Shell

```text
┌─────────────────────────────────────────────────────────────┐
│ Global bar: brand / command search / runtime / lock / user   │
├──────────────┬───────────────────────────────────┬──────────┤
│ Primary nav  │ Page header                        │ Context  │
│ 14 workspaces│ title / scope / freshness / action │ rail     │
│              │                                   │ 280px    │
│              │ Primary page task                 │          │
└──────────────┴───────────────────────────────────┴──────────┘
```

- 一级导航只显示 14 个入口和当前子页面路径，不显示所有功能按钮。
- Page header 只放页面级动作；对象级动作放对象内容区。
- Context rail 只显示当前对象、来源、权限、新鲜度和下一步。
- 全局 Overlay 仅保留 Command Palette、Unlock Gate、Toast 和确认 Modal。

## 4. 页面模板

### A. 目录页

用于 Research Inbox、Command Actions、Provider Catalog、Screener Profiles 等。

```text
标题与职责说明
范围/筛选/搜索
主列表或目录
选中对象的轻量 Inspector
```

### B. 对象详情页

用于 Asset、Research Brief、Provider、Workflow Run、Backtest Run 等。

```text
对象头部 + 状态 + 来源
子页面导航
当前子页面唯一任务
证据/限制/更新时间
```

### C. 配置页

用于 Factor Run、Strategy、Screener Tuning、Workflow Input、Settings 子页。

```text
配置目标
分组表单
数据覆盖与校验
主动作
阻断原因与审计提示
```

### D. 结果页

用于 Factor Results、Backtest Results、Screener Results、Workflow Timeline。

```text
运行摘要
主结果表/图
解释与证据
交接动作
```

## 5. 全量页面设计

### 5.1 Dashboard

Dashboard 只负责“现在系统是否就绪、我下一步去哪里”。

- `/dashboard/overview`：终端就绪摘要、市场脉搏、焦点资产和工作区入口；每块只显示摘要，不承载完整业务。
- `/dashboard/runtime`：本地 API、数据库、缓存、数据服务的运行状态和恢复动作。
- `/dashboard/focus/:symbol`：焦点资产轻量上下文；完整行情进入 Asset。
- 状态：首次运行、服务未启动、缓存模式、锁定、部分可用。

### 5.2 Command Center

- `/command-center/actions`：动作目录，按研究、数据、自动化、安全分类。
- `/command-center/recent`：最近命令与重复执行。
- `/command-center/actions/:actionId`：命令输入、权限、影响和执行前检查。
- `/command-center/results/:resultId`：执行结果、错误恢复和审计摘要。
- 命令中心不复制目标页面内容，只负责导航和执行动作。

### 5.3 Markets / Asset

- `/markets/assets`：资产搜索和进入路径。
- `/markets/assets/:symbol/overview`：资产身份、最新摘要、页面导航，不放完整分析。
- `/markets/assets/:symbol/price`：行情、K 线、区间、对比、时间戳。
- `/markets/assets/:symbol/fundamentals`：估值、质量、成长、风险指标。
- `/markets/assets/:symbol/filings`：文件列表、筛选、来源、单条 Filing Drawer。
- `/markets/assets/:symbol/data`：来源、覆盖、新鲜度、缺失字段和降级情况。
- `/markets/assets/:symbol/research`：创建或打开研究简报、交接上下文。

五个子项全部是独立子页面；Data 和 Research 不能被 Inspector 代替。Inspector 只显示快速摘要。

### 5.4 Watchlist

- `/markets/watchlist`：列表目录和当前列表摘要。
- `/markets/watchlist/:listId`：单列表、排序、筛选和行级选择。
- `/markets/watchlist/:listId/manage`：分组、标签、批量添加/移除。
- 快速添加使用 Sheet；完整资产内容跳转 Asset。

### 5.5 Research

- `/research/inbox`：搜索资产、创建简报、最近简报。
- `/research/briefs/:briefId/decision`：论点、假设、支持证据、反证、风险、结论。
- `/research/briefs/:briefId/asset-data`：研究上下文中的基本面和文件入口。
- `/research/briefs/:briefId/analysis`：结构化分析模块及单模块 Inspector。
- `/research/briefs/:briefId/evidence`：筛选、因子、回测、Paper、执行意图和审计证据。
- `/research/briefs/:briefId/assistant`：上下文预览、模板、AI 模式、生成草稿。
- `/research/briefs/:briefId/notes`：笔记、待验证项、Watchlist/Portfolio 交接。
- `/research/briefs/:briefId/export`：报告预览、格式、来源标注和导出确认。

Research Brief 只负责当前研究对象的导航和章节切换，不再把所有章节纵向展开。

### 5.6 Factor Lab

- `/factor-lab/runs/new`：因子配置、时间范围、资产池、数据覆盖。
- `/factor-lab/runs`：历史运行列表、状态、时间和质量。
- `/factor-lab/runs/:runId/results`：排名、分数、分位数、结果表。
- `/factor-lab/runs/:runId/assets/:symbol`：单标的因子贡献解释。
- `/factor-lab/runs/:runId/quality`：缺失数据、不可比指标、降级计算。
- `/factor-lab/runs/:runId/handoff`：送入 Research、Strategy 或 Portfolio 的交接确认。

### 5.7 Strategy Lab

- `/strategies`：策略目录。
- `/strategies/new`：策略定义、规则和标的池。
- `/strategies/backtests/new`：回测配置。
- `/strategies/backtests/:backtestId`：收益、回撤、曲线、归因和持仓。
- `/strategies/paper/:sessionId`：Paper Trading 会话和订单状态。
- `/strategies/risk-review/:id`：风险门槛、阻断原因、Kill Switch 和人工确认。
- `/strategies/execution/:id`：只生成受控执行意图并记录审计。

回测、Paper 和执行意图必须有不同页面和安全边界。

### 5.8 Workflow Studio

- `/automation/workflows`：模板目录。
- `/automation/workflows/:templateId`：模板目标、步骤、输入输出。
- `/automation/workflows/:templateId/configure`：输入、Universe、资产类型和变体。
- `/automation/workflows/runs`：运行历史。
- `/automation/workflows/runs/:runId`：步骤时间线、状态和恢复。
- `/automation/workflows/runs/:runId/artifacts`：证据与产物目录。
- `/automation/workflows/runs/:runId/confirm`：人工确认和阻断说明。

### 5.9 Data Sources

- `/markets/data-sources/catalog`：提供方目录和能力摘要。
- `/markets/data-sources/:provider`：覆盖范围、协议、只读边界和新鲜度。
- `/markets/data-sources/:provider/preview`：宏观、股票、Crypto、新闻预览。
- `/markets/data-sources/:provider/quality`：缺失、延迟、缓存和质量报告。
- `/markets/data-sources/report`：覆盖报告导出。
- 凭证管理进入 Connections，不在数据预览页编辑。

### 5.10 Screeners

- `/automation/screeners`：预设和变体目录。
- `/automation/screeners/:presetKey/variants/:variantKey`：变体详情。
- `/automation/screeners/:presetKey/variants/:variantKey/tuning`：参数调优。
- `/automation/screeners/:presetKey/universe`：资产池和覆盖。
- `/automation/screeners/runs/:runId`：运行结果表。
- `/automation/screeners/runs/:runId/explanations`：命中规则、未通过规则、缺失数据。
- 结果行 Inspector 只显示单资产摘要；完整分析跳 Asset 或 Research。

### 5.11 Portfolio

- `/portfolio/overview`：净值、收益、现金和组合状态。
- `/portfolio/holdings`：持仓表和选中持仓 Inspector。
- `/portfolio/allocation`：行业、资产类型、地区和集中度。
- `/portfolio/analytics`：收益曲线、基准、归因和分析窗口。
- `/portfolio/risk`：回撤、波动、流动性和异常。
- `/portfolio/transactions`：本地交易记录。
- `/portfolio/transactions/new`：新增交易；编辑使用独立 Sheet/Modal。
- `/portfolio/handoff/:symbol`：进入资产研究或因子分析。

### 5.12 Connections

- `/settings/connections/providers`：Provider 目录。
- `/settings/connections/:provider`：能力、权限、端点和状态。
- `/settings/connections/credentials`：本地 Profile 和凭证状态。
- `/settings/connections/health`：测试、诊断和能力矩阵。
- 凭证录入、清除和解锁使用全屏页面或明确的安全 Modal。

### 5.13 Settings

- `/settings/preferences`：语言、密度、默认页、快捷键。
- `/settings/appearance`：主题、字体大小、表格密度、对比度预览。
- `/settings/data`：缓存、默认数据源、刷新和保留策略。
- `/settings/security`：本地解锁、自动锁定、会话和安全审计。
- `/settings/ai`：本地/云边界、模型偏好和生成权限。
- `/settings/execution`：研究模式、人工确认、风险门槛、Kill Switch。
- `/settings/runtime`：本地服务、数据库、日志和诊断导出。

### 5.14 Manual

- `/help/manual/getting-started`：首次使用和工作区结构。
- `/help/manual/research-data`：研究、数据、筛选、因子和证据链。
- `/help/manual/strategy-workflows`：策略、回测、Paper 和工作流。
- `/help/manual/security-execution`：解锁、凭证、执行边界和审计。
- `/help/manual/troubleshooting`：离线、缓存、错误和恢复。

Manual 是只读说明，不承载设置表单或实际执行。

## 6. 组件与状态规范

### 共享组件

- `AppShell`：全局导航、顶部栏、锁定门、反馈。
- `PageHeader`：标题、职责、范围、更新时间、页面动作。
- `SubrouteNav`：对象的子页面导航和当前路径。
- `FreshnessStrip`：数据来源、时间戳、缓存/实时状态。
- `EvidenceRail`：证据编号、来源、限制、跳转。
- `ContextInspector`：当前对象和下一步。
- `DataTable`：表头、排序、筛选、选中、空、加载、错误。
- `ChartFrame`：图表标题、单位、时间区间、来源和无数据状态。
- `FormSection`：配置分组、字段说明、校验和阻断原因。
- `StateBlock`：loading/empty/error/locked/ready 五态。
- `ConfirmModal`：危险操作、凭证、导出、人工确认。

### 状态矩阵

| 状态 | 页面表现 | 必须提供 |
|---|---|---|
| loading | 骨架只覆盖当前主内容 | 预计动作、取消或返回 |
| empty | 明确说明为什么为空 | 创建、刷新或去配置入口 |
| error | 错误原因和影响范围 | 重试、诊断或返回 |
| locked | 安全边界说明 | 解锁入口，不暴露敏感内容 |
| stale/offline | 就地来源/新鲜度提示，不用整页遮罩 | 时间戳、缓存来源、刷新动作 |
| blocked | 阻断原因、缺失条件 | 去补全入口或人工确认 |
| ready | 主任务、来源和更新时间清晰 | 下一步动作 |

## 7. Penpot 交付结构

Penpot 文档按以下 Page 组织：

```text
00 Foundations
01 App Shell
02 Dashboard
03 Command Center
04 Markets - Asset
05 Markets - Watchlist
06 Markets - Data Sources
07 Research
08 Factor Lab
09 Strategy Lab
10 Workflow Studio
11 Screeners
12 Portfolio
13 Connections
14 Settings
15 Manual
16 State Matrix
17 Responsive QA
```

每个独立 route 至少有：Desktop 1600、Desktop 1180、Compact 960、loading、empty、error、locked、ready 五态中的适用状态。每个 frame 标注 route、主任务、数据来源、权限边界和验收状态。

## 8. 实施验收标准

一个页面只有同时满足以下条件才算完成：

1. 对应 route 可直接进入并可返回。
2. 页面只有一个主任务，未重新堆叠其他独立功能。
3. loading、empty、error、locked、ready 状态可见且可操作。
4. 数据来源、更新时间、权限和限制明确显示。
5. 1600/1180/960 宽度无截断、重叠和不可读文字。
6. 键盘焦点、表格选择、Modal 关闭和返回路径可用。
7. Penpot frame、route、代码页面和验收记录一一对应。
8. 原有本地优先、安全锁定、只读数据源和受控执行边界不被破坏。

这份方案通过后，下一阶段才开始在 Penpot 建立完整画板，再按页面族重写前端。
