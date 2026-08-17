# T96–T195 后续任务审核草案

状态：待用户审核，尚未同步到正式任务板。

总原则：Penpot 唯一最终页面 `FINAL - All Pengbo Pages` 是锁定的 UI 设计基线。所有二级/三级 route 都是独立全屏页面；Research、Experiment、Asset 子页面都有上下文 AI 入口；`/ai-assistant` 是独立通用 AI 页面。

## M1 UI Foundation：T96–T106

目标：在 T101 完成的浅色主题和 AppShell 基础上，建立全量 route 页面、统一组件、统一状态和双层 AI 入口的可实现 UI 基础。

- `T96` 产品与 UI 总路线图：保留产品、UI、AI、量化、安全路线；当前 UI 设计源以 Penpot 为准，旧 Figma 仅作为历史路线资料。
- `T97` Penpot UI System：建立可落地的 UI 画板、全量 route frame、状态矩阵、组件规范和 React 映射。
- `T98` Design Tokens：统一颜色、字体、间距、圆角、状态色、涨跌色、证据色和 AI 状态色。
- `T99` 导航与 Route IA：保留 14 个 ViewKey 和 7 组一级导航，并在每个一级入口下建立二级/三级 route；保留 `nav-<ViewKey>` 锚点。
- `T100` AppShell：保留 sidebar、toolbar、主工作区、右 Context Inspector，并增加 Breadcrumb、SubrouteNav、页面级 AI 入口和 route 状态边界。
- `T101` 浅色默认主题：已完成；继续作为 Penpot 最终版的默认视觉基线，保留暗色主题、密度和本地安全状态。
- `T102` Route 组件库：抽出 PageHeader、RoutePageFrame、SubrouteNav、Button、Input、Search、Popover、Sheet、StateBlock、AITrigger、HandoffAction 等。
- `T103` 金融数据表：支持固定列、排序、筛选、虚拟滚动、行级 Inspector、全屏表格状态和“解释当前结果”的上下文 AI 入口。
- `T104` Context Inspector：统一证据、AI 上下文、数据状态、参数和权限面板；Inspector 不替代独立子页面。
- `T105` 中文状态系统：每个 route 显示 loading、empty、blocked、error、locked、ready，并提供中文下一步动作；增加 AI 证据不足和云端未授权状态。
- `T106` 全量截图基线：为 Penpot 中全部 route 建立 1600/1180/960 全屏截图和适用状态回归基线。

## M2 First Useful Loop：T107–T115

目标：让用户第一次打开后，沿着完整 route 页面完成一次研究闭环，并能从资产、研究和命令页面打开 AI。

- `T107` 首次 Demo 流程：无 key 完成资产搜索、Asset 页面、上下文 AI、Research Brief、证据复核和报告导出。
- `T108` Dashboard 简化：从工程状态面板变成今日研究入口；只显示摘要，不承载完整资产、研究或 AI 工作流。
- `T109` 全局命令中心：支持股票、拼音、route 跳转、启动工作流、打开独立 AI Assistant 和打开上下文 AI。
- `T110` Asset Route Family：把资产搜索、概览、行情、基本面、文件、数据覆盖、研究交接拆成独立页面；每页有 AI 入口。
- `T111` Research Route Family：把 Inbox、Decision Review、Asset Data、Structured Analysis、Evidence、Notes、Export 拆成独立页面；每页有上下文 AI。
- `T112` Evidence Timeline：把来源、缓存、审计、workflow、因子和回测串成独立证据页面，并支持 AI 证据复核。
- `T113` 一键研究 Brief：从资产、命令、筛选、数据源或因子结果创建 Brief，并带入来源、资产、证据和 AI 上下文。
- `T114` 报告导出打磨：导出来源、限制、证据范围、AI 参与情况、模型和生成时间。
- `T115` 10 分钟成功测试：验证新用户能搜索资产、打开上下文 AI、完成研究、复核证据并导出报告。

## M3 AI Router：T116–T125

目标：把 AI 变成同时支持独立使用和页面上下文使用的可控、可审计、多模型系统。

- `T116` AI Router 规范：定义独立 AI、Research AI、Experiment AI、Asset AI 的上下文、路由、权限和降级规则。
- `T117` AI Assistant 与 AI Control：建立独立 `/ai-assistant` 页面，同时保留 Dashboard 的 AI 状态摘要和所有相关子页面的 AI 入口。
- `T118` 本地模型探测：支持 Ollama、MiMO、Hermes、OpenAI-compatible endpoint，并在独立/上下文 AI 中显示可用状态。
- `T119` 云端确认 Sheet：发送前展示当前页面、资产/Brief/Run、证据范围、模型、预计上下文和风险。
- `T120` Evidence Contract：上下文 AI 必须基于允许的证据回答；证据不足时进入 blocked/limited 状态。
- `T121` 多模型顾问：支持独立 AI 和上下文 AI 的风险、反方观点、缺失数据和结果比较。
- `T122` 成本预算：统一 token 估算、预算、请求失败、超限和本地降级 UI。
- `T123` Prompt 模板库：支持通用、股票研究、资产解释、因子假设、策略风险、Workflow 诊断和报告模板。
- `T124` AI Eval：检测独立和上下文 AI 是否编造、错误引用、越权使用数据或忽略安全边界。
- `T125` AI Audit：记录入口 route、provider、模型、context hash、证据范围、确认状态和输出 artifact，不记录 secret。

## M4 Data Depth：T126–T135

目标：把数据源做成可信、可诊断、可用于研究和量化的底座，并让数据状态能被资产和 AI 上下文消费。

- `T126` Data Sources Route Family：把 provider 目录、来源详情、数据预览、质量报告、覆盖报告拆成独立页面。
- `T127` A 股数据增强：quote、profile、daily basics、财务指标、分类覆盖和对应 freshness 状态。
- `T128` 港股/香港宏观增强：改善 HK 数据覆盖、缓存、stale、credential-gated 和错误状态。
- `T129` 宏观数据浏览：建立 FRED、WorldBank、DBnomics、HKMA 等宏观 series 独立浏览页面。
- `T130` 新闻事件入口：增加只读新闻、RSS、事件上下文、来源和时间戳页面。
- `T131` Freshness UI：统一解释 live、cached、stale、credential-gated、unsupported、unavailable。
- `T132` DuckDB 性能：优化历史数据、因子和多 route 页面查询，不改变页面职责。
- `T133` 本地文件导入：CSV/Excel 成为本地、有来源、有质量状态的数据源。
- `T134` 数据质量评分：评分完整性、及时性、来源可信度、限制和样本覆盖，并可由上下文 AI 解释。
- `T135` 数据源报告导出：导出 provider 状态、freshness、质量、限制、缓存和 AI 使用边界。

## M5 Research / Banking / Equity Workflows：T136–T145

目标：把研究、投行、股票分析做成可复用的专业 route 工作流，并保持证据和 AI 边界。

- `T136` Workflow Recipe Gallery：把 Workflow Studio 拆成模板目录、模板详情、配置、运行、产物和人工确认页面。
- `T137` Screener To Research：筛选结果进入 Research 候选页面，保留命中规则、资产和 AI 上下文。
- `T138` Data Sources To Research：provider 样本、freshness、quality 和来源限制进入 Research Brief。
- `T139` Public Equity Memo：股票研究 memo route，覆盖业务、财务、估值、催化剂、风险和证据。
- `T140` IB One-pager：投行公司一页纸 route，覆盖业务、交易亮点、同业和尽调提示。
- `T141` Peer Comparison：同业选择、比较表、差异解释和导出页面；支持上下文 AI。
- `T142` 尽调清单：根据公司、行业、数据和证据生成 diligence questions，并可进入 AI 复核。
- `T143` 批量研究队列：多个资产排队研究，每个 Brief 保持独立 route、证据和状态。
- `T144` Research Review：使用上下文 AI 做反方观点、风险和证据缺口复核。
- `T145` Report Template Manager：管理研究、投行、宏观、风险和 AI Prompt 模板，避免与 T123 冲突。

## M6 Quant Factor Lab：T146–T165

目标：把量化做成第二核心：因子发现、诊断、回测、报告和受控交接全部按独立 route 实现。

- `T146` Factor Lab Route IA：建立 Factor Lab 目录、配置、运行、结果、解释、质量和交接页面。
- `T147` Factor Project Model：保存股票池、区间、调仓、参数、运行和 artifacts，并支持 route 参数加载。
- `T148` 因子定义 Schema：表达式、输入、来源、验证状态和证据元数据。
- `T149` 内置因子库：估值、质量、成长、动量、波动率、流动性和宏观敏感度。
- `T150` 公式解析器：支持安全自定义因子公式和明确的错误/阻断状态。
- `T151` 股票池选择器：按市场、行业、watchlist、导入文件和流动性筛选。
- `T152` 因子数据管线：计算、缓存、版本、缺失值处理和质量报告。
- `T153` IC/Rank IC：计算 IC、Rank IC、ICIR、滚动 IC 和样本覆盖。
- `T154` 分组收益：quantile、多空、命中率、换手和回撤分析。
- `T155` 单因子回测：配置调仓、权重、成本和回测结果独立页面。
- `T156` 多因子打分：等权、z-score、rank score 和自定义权重。
- `T157` 交易成本：手续费、滑点、换手成本和敏感度分析。
- `T158` 暴露诊断：行业、市值、风格、流动性和市场暴露。
- `T159` 过拟合检查：未来函数、样本泄露、样本过小和不稳定时期。
- `T160` 因子报告导出：定义、逻辑、数据、诊断、回测、限制和 AI 参与说明。
- `T161` AI 因子假设助手：在 Factor 页面打开上下文 AI，也可从独立 AI Assistant 使用因子模板。
- `T162` Research To Factor：研究假设转因子 idea，并保留 Brief、证据和权限上下文。
- `T163` Factor To Backtest：因子结果进入回测，保留 run、来源和数据质量。
- `T164` Backtest To Paper Intent：只生成 paper intent，不自动交易，并通过风险复核页面。
- `T165` Factor Lab 测试：覆盖所有 Factor route、AI 入口、状态、截图和数值回归。

## M7 Release Hardening：T166–T175

目标：让全量 route、AI、数据、量化和桌面运行时稳定打包、测试、发布和回归。

- `T166` Tauri 打包审计：验证 EXE/MSI/NSIS/sidecar 对最终 route 和 AI 页面可启动。
- `T167` 代码签名方案：签名和 artifact 校验不泄露 UI 设计或运行时秘密。
- `T168` 自动更新设计：stable/beta 机制不默认引入远程同步或托管账户。
- `T169` 性能预算：启动、route 切换、表格、Inspector、AI preview 和导出性能。
- `T170` 错误恢复：统一前端、sidecar、provider、AI 和 route 级恢复动作。
- `T171` 本地诊断包：默认脱敏，不含 secret、数据库、凭证、AI 上下文或敏感路径。
- `T172` CI 扩展：类型、后端、provider、AI eval、route smoke 和全量截图。
- `T173` Release Checklist v2：覆盖最终 UI、route、AI、数据、量化和安全。
- `T174` 文档同步：README、CHANGELOG、Manual、Security、Penpot 和 task board 保持一致。
- `T175` Packaged Smoke v2：安装包级验证首页、Asset、Research、AI、Factor、Strategy、Workflow 和安全锁定。

## M8 Security And Compliance：T176–T185

目标：保持 local-first、安全、审计、非投资建议和受控执行边界。

- `T176` Secret 存储复核：secret 不进入 SQLite、DuckDB、logs、screenshots、exports、Penpot 或 AI artifact。
- `T177` 云上下文脱敏：用户看到发送给云端的页面、资产、Brief、Run 和证据范围。
- `T178` 审计事件 UI：统一记录 AI、导出、provider、Binance、安全和 route 事件。
- `T179` Public Exposure Guard：sidecar 继续只绑定本机，route 和 AI 不改变边界。
- `T180` 授权矩阵：数据源 license、再分发、商业风险和 AI 使用范围。
- `T181` 投资建议边界：UI、AI、研究报告和 export 明确非投资建议。
- `T182` 截图敏感扫描：防 token、key、path、凭证、内部 URL 和 AI 云上下文泄漏。
- `T183` Binance Safety UI：只读默认、Kill Switch、风险门槛、人工确认；AI 不直接执行。
- `T184` 安全 smoke evidence：打包级安全证据覆盖 route、AI、凭证和锁定状态。
- `T185` 私有部署边界：私有/团队模式的账号、权限、同步和审计前置条件。

## M9 Commercialization：T186–T195

目标：让 Pengbo 具备对外展示、试用、商业验证的形态，同时保持锁定 UI 和 local-first 边界。

- `T186` 用户分层：个人、进阶分析师、投行/买方、小团队，并映射不同 route 和 AI 能力。
- `T187` 定价假设：Pro Desktop、模板包、连接器、私有部署，不承诺远程同步。
- `T188` 模板市场种子：内置研究、投行、因子、风险和通用 AI 模板包。
- `T189` 私有部署手册：本地部署、更新、route、AI、数据和安全边界。
- `T190` 三分钟 Demo 脚本：no-key → Asset → 上下文 AI → Research → 证据 → 报告导出。
- `T191` README 产品化：展示 Penpot 锁定 UI、全量 route、独立 AI 和上下文 AI 边界。
- `T192` Landing Page Later：官网暂缓，但准备最终 UI、route 和 AI 展示素材。
- `T193` 反馈闭环：收集具体 route、页面状态、AI 入口和证据问题。
- `T194` 早期用户试用计划：定义搜索、研究、AI、因子和报告验证任务。
- `T195` 商业风险复盘：数据授权、AI 成本、维护成本、页面规模和 route 复杂度。

## 建议审核重点

1. 是否同意把 Penpot `FINAL - All Pengbo Pages` 作为 T96–T195 的唯一 UI 基线。
2. 是否同意保留 T 编号，不删除任务，只修改任务内容和验收标准。
3. 是否同意把 T110/T111 从单页面任务改为页面族任务。
4. 是否同意把 T117 明确扩展为独立 AI Assistant + 上下文 AI。
5. 是否同意把 T102–T106 作为全量 route UI 基础，而非只做组件和截图。
