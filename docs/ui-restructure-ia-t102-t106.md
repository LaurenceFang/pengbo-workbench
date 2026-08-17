# T102–T106 全量 UI 信息架构与页面重构规划

状态：T96-T104 基础实现/校正已完成；T105/T106 不属于本次交付。

本次校正以 `E:\彭博\Pengbo_UI_Rebuild.svg` 为不可变视觉验收基线，SHA-256
为 `1A72F37E204367BC6664AC8443B3A876CB03786C19626B54E925661CEAA53A33`。
T104 的 Context Inspector 必须与全屏 route、contextual AI 和状态结构保持
一致，但不替代独立 route。

## 目标与硬性边界

当前 14 个 ViewKey 都被视为“功能堆叠容器”，不能只改颜色、卡片或局部布局。每个一级页面都要按功能区递归拆分为独立二级/三级页面；Research 只是最明显的例子，不是唯一需要拆分的页面。

本轮规划的硬性规则：

- 一个页面只承载一个主任务。
- 结果、解释、来源、权限和配置不再和多个独立主任务混在同一长页面。
- 表格、单对象详情、编辑器、运行记录、凭证配置和审计记录按职责分离。
- 弹窗只用于确认、危险操作、凭证录入和短暂反馈；不能用弹窗替代完整页面。
- 抽屉只用于查看当前对象的上下文；不能把第二个工作流塞进抽屉。
- Inspector 只显示当前选中对象的元数据、状态、来源、权限和下一步。
- 每个独立页面必须具备 loading、empty、error、locked、ready 状态。
- 14 个旧页面中的功能必须全部有新页面归属，不允许通过删除功能来“变简单”。

## 总导航树

```text
Pengbo
├─ 首页
│  ├─ 终端就绪
│  ├─ 市场脉搏
│  ├─ 焦点资产
│  └─ 模块健康
├─ 命令中心
│  ├─ 命令目录
│  ├─ 最近命令
│  ├─ 命令详情
│  └─ 执行结果
├─ 市场
│  ├─ 资产搜索
│  ├─ 资产详情
│  │  ├─ 行情与图表
│  │  ├─ 基本面与比率
│  │  ├─ 文件与公告
│  │  ├─ 数据覆盖与来源
│  │  └─ 研究交接
│  ├─ 自选列表
│  │  ├─ 列表详情
│  │  ├─ 分组与标签
│  │  └─ 批量操作
│  └─ 数据源
│     ├─ 来源目录
│     ├─ 来源详情与能力
│     ├─ 凭证与连接
│     ├─ 数据预览
│     └─ 覆盖与新鲜度报告
├─ 研究
│  ├─ 研究目录
│  ├─ 新建研究
│  ├─ 研究简报
│  │  ├─ 结论与论点
│  │  ├─ 基本面与文件
│  │  ├─ 证据链
│  │  ├─ 决策复核
│  │  ├─ AI 助手与生成预览
│  │  ├─ 笔记与交接
│  │  └─ 导出报告
│  └─ 研究模板
├─ 实验室
│  ├─ 因子实验室
│  │  ├─ 因子配置
│  │  ├─ 运行记录
│  │  ├─ 运行结果
│  │  ├─ 标的因子解释
│  │  ├─ 数据质量
│  │  └─ 研究/策略交接
│  └─ 策略实验室
│     ├─ 策略定义
│     ├─ 回测配置
│     ├─ 回测结果与归因
│     ├─ 持仓与曲线
│     ├─ Paper Trading 会话
│     ├─ 风险复核
│     └─ 执行意图与审计
├─ 自动化
│  ├─ 工作流目录
│  ├─ 工作流模板详情
│  ├─ 工作流编排
│  ├─ 输入与标的池
│  ├─ 运行记录
│  ├─ 步骤时间线
│  ├─ 证据与产物
│  └─ 人工确认
├─ 筛选
│  ├─ 筛选器目录
│  ├─ 筛选器变体
│  ├─ 参数调优
│  ├─ Universe 与覆盖
│  ├─ 运行记录
│  ├─ 筛选结果
│  ├─ 命中解释
│  └─ 结果 Inspector
├─ 组合
│  ├─ 组合总览
│  ├─ 持仓
│  ├─ 配置与集中度
│  ├─ 收益与分析
│  ├─ 风险
│  ├─ 交易记录
│  └─ 持仓研究交接
├─ 连接
│  ├─ 连接目录
│  ├─ 连接详情
│  ├─ 凭证管理
│  ├─ 连接探测与诊断
│  ├─ 能力矩阵
│  └─ 安全边界
└─ 设置与帮助
   ├─ 常规偏好
   ├─ 外观与可读性
   ├─ 数据与缓存
   ├─ 安全与本地解锁
   ├─ AI 边界
   ├─ 执行边界与 Kill Switch
   ├─ 诊断与导出
   └─ 说明书
      ├─ 研究流程
      ├─ 筛选与因子
      ├─ 回测与模拟
      ├─ 凭证与安全
      └─ 状态说明
```

## 14 个现有页面的拆分边界

| 现有页面 | 新页面职责 | 禁止继续同页堆叠 |
|---|---|---|
| Dashboard | 就绪状态、市场脉搏、焦点资产、模块健康分别成为入口或独立模块页 | 不能把市场、研究、健康、首次运行都放成首页长滚动卡片 |
| Command Center | 命令目录、命令详情、执行结果分离 | 不能把搜索、说明、审计、反馈做成同一工作台 |
| Asset | 行情图表、基本面、文件、来源、研究交接分离 | 不能在资产详情里同时编辑研究、配置数据源和执行策略 |
| Watchlist | 列表、分组、批量操作、单标的上下文分离 | 不能把所有列表管理和资产详情塞在一页 |
| Research | 目录、新建、简报各章节、证据、决策、助手、导出分离 | 不能再出现一个页面包含完整研究生命周期 |
| Factor Lab | 配置、运行、结果、单标的解释、质量、交接分离 | 不能把表单、排名、贡献、审计全放一张工作区 |
| Strategy Lab | 策略定义、回测、结果、模拟、风险、执行意图、审计分离 | 不能把回测与执行意图直接并列成可误操作的同页动作 |
| Workflow Studio | 模板、编排、输入、运行、时间线、产物、确认分离 | 不能把编辑器和运行结果做成同一长页 |
| Data Sources | 目录、来源详情、凭证、预览、覆盖报告分离 | 不能把连接配置和数据表预览混为一个功能区 |
| Screeners | 目录、变体、调参、Universe、运行、结果、解释分离 | 不能把编辑筛选器与结果 Inspector 混成一个页面 |
| Portfolio | 总览、持仓、配置、收益、风险、交易、研究交接分离 | 不能把交易录入、组合分析和研究入口放在同一主任务页 |
| Connections | 目录、详情、凭证、探测、能力、安全边界分离 | 不能把凭证表单和普通连接状态混在同一张卡片 |
| Settings | 常规、外观、数据、安全、AI、执行边界、诊断分离 | 不能把全部设置做成一页纵向表单 |
| Manual | 目录、章节、流程说明、安全说明、状态示例分离 | 不能把帮助内容伪装成运行仪表盘 |

## 页面骨架

每个独立页面统一采用以下骨架，但不把不同主任务重新塞回同页：

```text
页面头部
├─ 页面标题
├─ 一句职责说明
├─ 当前范围与状态
└─ 页面级动作

主内容
├─ 当前页面唯一主任务
├─ 该任务的结果
└─ 结果的解释、来源和限制

上下文
└─ 当前对象 Inspector：对象、状态、来源、权限、下一步
```

## 视觉系统重构原则

当前黑白极端对比和层级不足导致文字、表格和状态难以阅读。视觉系统改为浅色研究终端基底：

- 画布：`#EEF3EF`；主内容表面：`#FFFFFF`；次级表面：`#E5EDE8`。
- 主文字：`#13231E`；次文字：`#52645C`；禁用文字：`#8A9891`。
- 边框：`#C8D7CF`；焦点：`#168A68`；选中底色：`#D9F0E7`。
- 状态色：成功 `#15805F`、警告 `#A86B16`、错误 `#B54A4A`、信息 `#326B9A`，不能只靠颜色传达状态。
- 字体：`Inter, "IBM Plex Sans", "Noto Sans SC", "Microsoft YaHei", sans-serif`。
- 代码、标的代码、ID、时间戳可使用 `IBM Plex Mono` 或系统等宽字体。
- 正文字号 14–16px，辅助信息不低于 12px，标题按 20/24/32px 分级；正文行高 1.5–1.65。
- 表格必须有明确列标题、行高、选中态、更新时间和来源；禁止低对比灰字铺满表格。
- 页面最多一个主视觉焦点；最多三栏，仅允许“目录—主任务—上下文”关系。
- 空、加载、错误、锁定和无权限必须是可读的完整状态块，并提供下一步动作。

## 后续实施顺序

1. 以本文件冻结全量 IA，不再先做局部视觉修补。
2. 在 Penpot 建立 Foundations、Shell、14 个页面组和完整状态矩阵；每个独立页面一个 frame。
3. 先重写 Research 作为验证拆分深度的样板，但同时按同一规则建立其他页面目录。
4. 依次重写 Asset/Data Sources、Factor/Strategy、Workflow/Screeners、Portfolio/Connections/Settings/Manual。
5. 每个页面完成代码、Penpot frame、状态矩阵、1600/1180/960 三种宽度检查后，才算完成。

本文件只定义信息架构和重构边界；未获确认前，不进入前端实现，不把当前已有的概览 SVG 视为最终设计。

## 路由与状态边界

现有 `activeView + Zustand` 只能承担一级入口切换，不能继续作为完整页面层。实现阶段需要在保留 14 个一级入口的基础上增加可深链的二级/三级 route。

推荐的核心路由形式：

```text
/dashboard/overview
/dashboard/runtime
/command-center/actions
/command-center/recent
/markets/assets/:symbol/overview
/markets/assets/:symbol/price
/markets/assets/:symbol/fundamentals
/markets/assets/:symbol/filings
/markets/watchlist/:listId
/markets/data-sources/catalog
/markets/data-sources/:provider
/research/inbox
/research/briefs/:briefId/decision
/research/briefs/:briefId/asset-data
/research/briefs/:briefId/analysis
/research/briefs/:briefId/evidence
/research/briefs/:briefId/assistant
/research/briefs/:briefId/notes
/factor-lab/runs/new
/factor-lab/runs/:runId/results
/strategies/backtests/new
/strategies/backtests/:backtestId
/strategies/paper/:sessionId
/strategies/risk-review/:id
/automation/workflows
/automation/workflows/:runId
/automation/workflows/:runId/artifacts
/automation/screeners
/automation/screeners/runs/:runId
/portfolio/overview
/portfolio/holdings
/portfolio/transactions
/portfolio/analytics
/settings/preferences
/settings/runtime
/settings/security
/settings/connections
/settings/diagnostics
/help/manual/:section
```

状态边界：

- `selectedAssetId`、`selectedResearchBriefId`、`selectedRunId` 等可返回、可分享、可恢复的状态必须进入 URL 参数或 route params。
- `lastRunResult` 不再作为跨页面唯一真相源；结果页按 `runId` 加载，Zustand 只保留临时缓存。
- `pendingResearchSource`、`portfolioHandoffDraft` 必须带来源 ID 或 draft ID，不能依靠隐式全局状态传递。
- 语言、密度、主题、锁定状态、Command Palette 和全局反馈保留在 AppShell/session 层。
- Global Overlay 只保留 Command Palette、Local Unlock Gate、Toast/Feedback；业务内容不得借 Global Overlay 逃避页面拆分。

## 页面拆分的判断标准

满足以下任一条件，就必须独立成二级或三级页面：

1. 需要单独加载数据或单独恢复错误。
2. 有独立的 URL、浏览器返回路径或可分享上下文。
3. 有独立的权限、安全等级或锁定条件。
4. 需要独立的保存、运行、刷新、导出或审计生命周期。
5. 用户进入后要持续完成一个不同于父页面的主任务。

只有以下内容可以留在当前页面：

- 当前对象的轻量摘要。
- 当前列表的筛选、排序和选择状态。
- 当前对象的来源、权限、新鲜度和下一步提示。
- 短暂的确认、凭证输入、删除确认和人工确认。

## 当前代码证据

规划基于当前实际入口，而不是凭空重新命名：

- 一级入口由 `src/navigation.ts` 的 `navigationGroups` 和 `src/store/app-store.ts` 的 `ViewKey` 管理。
- 页面集中在 `src/App.tsx` 挂载，当前尚未形成真正的深链路由层。
- Research、Strategy Lab、Workflow Studio、Portfolio、Data Sources 等页面文件已包含多个独立生命周期的功能区，正是本次拆分的主要对象。
- 前端重写时必须把页面职责、加载器、错误边界和状态矩阵随 route 一起拆出，不能只把原 JSX 移动到多个文件中。
