# 开源 Bloomberg Terminal 替代调研

更新日期：2026-04-14  
范围：只讨论“免费、公开仓库、可严肃试用”的项目；不把问题简化成几个金融 Python 包，而是按数据、研究、筛选、图表、组合监控、终端/UI、平台化、自托管、执行集成来拆 Bloomberg Terminal 的能力栈。

---

## 0. 先说结论

### 最短结论

- **最容易被开源替代的部分**：图表组件、个人投资组合监控、量化研究框架、回测/执行引擎、SEC/财报解析、加密市场连接器、部分 screeners。
- **最难被开源替代的部分**：机构级实时多资产数据、统一新闻流、宏观/财务/事件一体化语义层、成熟的一体化终端工作流、销售端支持和数据许可合规。
- **现实可行路线**不是“找一个开源彭博”，而是：
  - 用 `OpenBB / CCXT / EdgarTools / FinanceToolkit` 这类项目搭数据与研究层；
  - 用 `Ghostfolio / Wealthfolio / Portfolio Performance / rotki` 承担组合监控层；
  - 用 `Lightweight Charts / KLineChart` 做图表层；
  - 用 `Lean / NautilusTrader / Freqtrade / Hummingbot / OpenAlgo` 承担执行层；
  - 用 `QuestDB` 一类时序库做自建数据底座；
  - 最终拼成“穷人版彭博终端”，而不是一个单仓库替代品。

### 这份报告的判断标准

- `活跃维护`：2025-10-01 之后仍有明确提交/发布。
- `更新缓慢`：2024-10-01 到 2025-09-30 之间有活动，但明显偏慢或高度依赖少数维护者。
- `基本废弃`：2024-09-30 之后缺少实质活动，或者安装/文档/依赖明显失效。
- `严肃栈判断`：
  - `主力组件`：我会放进严肃可用技术栈。
  - `辅助组件`：可放进组合方案，但只解决某一个角落。
  - `有条件纳入`：技术上强，但有地域、许可、生态、运维或数据边界。
  - `不建议新项目采用`：历史价值大，但今天不适合作为新栈核心。

---

## 1. 分层结论：Bloomberg 的哪些层可以被谁替代

### 1.1 市场数据获取

这一层最像“拼基础设施”，而不是找一个终端。

- **第一梯队**：`OpenBB`、`CCXT`
- **第二梯队/底座**：`QuestDB`
- **区域性执行+行情一体层**：`OpenAlgo`

结论：

- 股票/ETF/宏观/公开数据接入，`OpenBB` 很强。
- 加密统一市场接入，`CCXT` 是事实标准。
- 如果要自建时序数据平台，`QuestDB` 比很多老项目更值得优先看。
- 真正的机构级实时 consolidated feed 仍然很难靠纯开源获得；开源项目解决的是“软件层”和“接口层”，**不是** Bloomberg 级数据许可。

### 1.2 基本面 / 财务报表

- **第一梯队**：`FinanceToolkit`、`EdgarTools`
- **补充层**：`OpenBB`

结论：

- `EdgarTools` 很适合做 **美国 SEC / XBRL / 10-K / 10-Q** 解析。
- `FinanceToolkit` 很适合做 **比率、透明公式、横向可比分析**。
- 这一层开源能做得不错，但前提是你接受“公共/准公共数据源 + 自己拼装方法学”，而不是直接得到 Bloomberg 那种全球统一标准化基本面库。

### 1.3 金融分析 / 量化研究

- **第一梯队**：`Qlib`、`Lean`、`NautilusTrader`
- **专业分析补充**：`QuantLib`、`Open Source Risk Engine`
- **组合优化补充**：`skfolio`

结论：

- 研究和回测是开源世界最强的一块之一。
- `Qlib` 偏因子/ML 研究，`Lean` 偏多资产回测到实盘，`NautilusTrader` 偏底层交易引擎和事件驱动架构。
- `QuantLib + ORE` 是 Bloomberg 很多定价/风险分析能力里，开源最接近“专业级”的部分，但它们不是终端。

### 1.4 股票 / 期货 / 加密筛选器

- **可直接用的主力**：`OpenBB`
- **执行联动型筛选/信号**：`OpenAlgo`、`Freqtrade`
- **结论性判断**：这一层 **纯开源独立成品并不强**，很多 serious screener 最终还是要自己搭。

结论：

- 开源生态里，真正像 Bloomberg EQS 那样成熟的“通用多资产筛选器”并不多。
- 最现实的路是：`OpenBB + FinanceToolkit + EdgarTools + 自己前端`。
- 很多看上去像成品 screener 的项目，要么太早期、要么高度依赖失效/脆弱 API、要么范围太窄，不值得进入主推荐榜。

### 1.5 图表 / 可视化

- **第一梯队**：`TradingView Lightweight Charts`
- **第二梯队**：`KLineChart`
- **应用层图表**：`Ghostfolio`、`Wealthfolio`

结论：

- 图表是最容易被开源替代的 Bloomberg 能力之一。
- 但开源项目更多是“图表引擎”，而不是“图表 + 全部数据 + 全部研究 + 全部工作流”。

### 1.6 投资组合监控

- **第一梯队**：`Ghostfolio`、`Wealthfolio`、`Portfolio Performance`
- **加密优先**：`rotki`

结论：

- 个人用户最容易得到高质量开源替代的，就是组合跟踪、收益分析、持仓分解和净值视图。
- 这一层已经能做到“够漂亮、够实用、够稳定”。

### 1.7 终端式 UI / Web Dashboard

- **最像产品的纯开源 UI**：`Ghostfolio`、`Wealthfolio`
- **更偏交易工作台**：`OpenAlgo`、`Freqtrade`
- **历史上最像“开源终端”的项目**：`OpenBBTerminal`，但已归档

结论：

- 真正像 Bloomberg 那样的信息密度终端式 UI，纯开源选择并不多。
- 今天更接近现实的，是“高质量 Web Dashboard / Desktop Dashboard”，而不是终端味很强的 TUI。

### 1.8 可自托管的一体化金融平台

- **最值得认真搭的底座**：`OpenBB`
- **最成熟的组合平台**：`Ghostfolio`
- **最像执行工作台的自托管平台**：`OpenAlgo`
- **加密自动化平台**：`Freqtrade`、`Hummingbot`

结论：

- 这一层不存在一个纯开源、真正 1:1 覆盖 Bloomberg 的成品。
- 但已经可以拼出一个相当像样的“自托管研究 + 组合 + 图表 + 执行”平台。

### 1.9 券商 / API / 交易执行集成

- **加密连接器标准层**：`CCXT`
- **多资产研究到执行**：`Lean`
- **底层高性能执行**：`NautilusTrader`
- **加密实盘自动化**：`Freqtrade`、`Hummingbot`
- **印度本地化执行平台**：`OpenAlgo`

结论：

- 执行层在开源世界很强，但和 Bloomberg 的终端体验不是同一个问题。
- 开源能解决“把策略连到 broker/exchange”的问题，解决不了“Bloomberg 那样一屏把数据、新闻、分析、交易全部串起来”的工作流成熟度。

---

## 2. 核心项目卡

> 下面只列我认为值得认真评估的项目。每个卡片都明确说它替代 Bloomberg 的哪一小块，而不会包装成“整体替代方案”。

### OpenBB

- 项目名称：[OpenBB](https://github.com/OpenBB-finance/OpenBB)
- 项目类型：开源金融数据平台 / Python SDK / REST API / CLI
- 主要语言/技术栈：Python；开放数据平台、REST API、Python 包、Excel/MCP 集成
- 替代 Bloomberg 的哪部分：市场数据获取、部分基本面、研究 API 层、screeners、统一数据接入层
- 支持资产类别：股票、ETF、期权、外汇、加密、宏观/经济数据，部分固定收益能力取决于数据源
- 是否有图形界面：开源核心本身没有成熟终端式 GUI；有 CLI；更完整的 Workspace UI 是单独边界案例
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：覆盖面广；“connect once, consume everywhere”思路很适合自建平台；Python/API 友好；文档与示例较完整
- 缺点：最好的 UI 不在纯开源核心里；数据质量和可用性高度依赖具体 provider；离 Bloomberg 的一体化终端体验仍有明显距离
- 最适合的使用场景：作为“穷人版 Bloomberg”数据与 API 骨架
- 严肃栈判断：**主力组件**
- 主要风险点：数据源异构；需要自己拼 UI 和工作流；很多人会误以为 OpenBB 自带开源版 Bloomberg 式工作区，其实不是

### FinanceToolkit

- 项目名称：[FinanceToolkit](https://github.com/JerBouma/FinanceToolkit)
- 项目类型：金融分析 / 基本面 / 风险收益分析库
- 主要语言/技术栈：Python、pandas
- 替代 Bloomberg 的哪部分：基本面比率、财务分析、跨资产风险收益指标
- 支持资产类别：股票、期权、货币、加密、ETF、基金、指数、商品、经济指标
- 是否有图形界面：没有
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：方法学透明；150+ 指标/比率；适合 notebook 研究；非常适合作为“自己算而不是信第三方网页数值”的分析层
- 缺点：不是终端；没有 GUI；仍依赖外部数据输入质量
- 最适合的使用场景：Python 基本面研究、横向可比分析、做自定义 screener 的计算层
- 严肃栈判断：**主力组件**
- 主要风险点：偏单维护者项目；不提供 Bloomberg 那种全球统一标准化基本面仓

### EdgarTools

- 项目名称：[EdgarTools](https://github.com/dgunning/edgartools)
- 项目类型：SEC/EDGAR/XBRL 财报解析库
- 主要语言/技术栈：Python
- 替代 Bloomberg 的哪部分：美国上市公司财报、SEC 文件、XBRL statements、filings pipeline
- 支持资产类别：美国股票/发行人
- 是否有图形界面：没有
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：对 SEC/EDGAR 这条线非常实用；XBRL 与 filings 能力强；文档、notebooks、examples 完整
- 缺点：美国中心；不是通用全球基本面平台；没有终端式界面
- 最适合的使用场景：美国股票基本面与 filings 研究、自建财务报表服务
- 严肃栈判断：**主力组件**
- 主要风险点：地域覆盖窄；更像“高质量原材料库”，不是现成终端

### CCXT

- 项目名称：[CCXT](https://github.com/ccxt/ccxt)
- 项目类型：加密交易所统一 API/连接器库
- 主要语言/技术栈：JavaScript/TypeScript、Python、C#、PHP、Go
- 替代 Bloomberg 的哪部分：加密市场数据接入、加密交易执行接口抽象
- 支持资产类别：加密现货、永续、部分衍生品；覆盖 100+ 交易所
- 是否有图形界面：没有
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：事实标准级统一接口；语言覆盖广；适合做自己的行情、执行和套利工具
- 缺点：它不是平台也不是终端；WebSocket/Pro 能力有商业边界；交易所差异仍然存在
- 最适合的使用场景：加密行情与交易连接层
- 严肃栈判断：**主力组件**
- 主要风险点：容易被误当成“完整交易系统”；其实它更像底层 adapter

### QuestDB

- 项目名称：[QuestDB](https://github.com/questdb/questdb)
- 项目类型：开源时序数据库
- 主要语言/技术栈：自研时序数据库、SQL、时间序列高吞吐写入
- 替代 Bloomberg 的哪部分：自建市场数据底座、K 线/quote/tick 存储层
- 支持资产类别：资产无关，任何时间序列都可以
- 是否有图形界面：有基础数据库控制台，但不是终端产品
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：很适合自建市场数据湖；吞吐与查询能力强；对“穷人版终端”的后端很关键
- 缺点：不负责数据许可、不负责终端 UI、不负责金融语义层
- 最适合的使用场景：自托管 Web 终端的数据存储底座
- 严肃栈判断：**辅助组件**
- 主要风险点：如果没有上游采集和前端，它本身不解决 Bloomberg 体验问题

### Qlib

- 项目名称：[Qlib](https://github.com/microsoft/qlib)
- 项目类型：AI-oriented quant investment platform
- 主要语言/技术栈：Python、机器学习工作流、数据集与回测框架
- 替代 Bloomberg 的哪部分：量化研究、因子研究、ML 研究工作流、数据处理与回测
- 支持资产类别：以股票为主；官方数据与样例对中国/美国市场支持较好
- 是否有图形界面：没有成熟终端 GUI
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：研究范式完整；AI/ML 方向很强；适合 serious quant research
- 缺点：多资产能力和交易执行体验不如 Lean；学习曲线较陡；更像研究平台而不是产品终端
- 最适合的使用场景：因子研究、ML alpha、研究流水线
- 严肃栈判断：**主力组件**
- 主要风险点：股票中心；市场覆盖和数据清洗仍需自己确认

### QuantConnect Lean

- 项目名称：[Lean](https://github.com/QuantConnect/Lean)
- 项目类型：开源算法交易引擎 / 回测与实盘框架
- 主要语言/技术栈：C#、Python、Docker、Jupyter、CLI
- 替代 Bloomberg 的哪部分：回测、研究环境、策略开发、券商连接、部分执行工作流
- 支持资产类别：股票、期权、期货、外汇、加密、CFD
- 是否有图形界面：以 CLI/Jupyter 为主，没有成熟开源终端界面
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：多资产、成熟、生态强；从研究到执行链路完整；对 serious quant 非常实用
- 缺点：最顺滑的体验与 QuantConnect 生态绑定较深；本地 CLI/研究工作流存在账号/付费边界
- 最适合的使用场景：多资产量化研究与执行引擎
- 严肃栈判断：**主力组件（但有生态边界）**
- 主要风险点：不是纯本地零依赖的一体化体验；数据与工作流常常会碰到 QuantConnect 商业边界

### NautilusTrader

- 项目名称：[NautilusTrader](https://github.com/nautechsystems/nautilus_trader)
- 项目类型：生产级事件驱动交易引擎
- 主要语言/技术栈：Rust + Python
- 替代 Bloomberg 的哪部分：低延迟研究/回测/实盘执行底层、事件驱动交易基础设施
- 支持资产类别：多资产；当前生态里对电子交易、加密和衍生品尤其友好
- 是否有图形界面：没有
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：架构非常认真；性能和确定性强；适合从一开始就按“生产级系统”来搭
- 缺点：不是成品终端；对个人用户偏硬核；需要工程投入
- 最适合的使用场景：做自己的交易基础设施或高要求量化平台
- 严肃栈判断：**主力组件**
- 主要风险点：不是开箱即用产品；UI 和日常 analyst 工作流基本需要自己补

### QuantLib

- 项目名称：[QuantLib](https://github.com/lballabio/QuantLib)
- 项目类型：定价与量化分析库
- 主要语言/技术栈：C++（有多语言绑定）
- 替代 Bloomberg 的哪部分：定价、固定收益、利率、期权、衍生品分析
- 支持资产类别：固定收益、利率、外汇、期权、信用与其他衍生品
- 是否有图形界面：没有
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：行业级声誉；衍生品/定价能力是开源世界的顶级资产之一
- 缺点：不是终端；不是数据平台；门槛高
- 最适合的使用场景：把 Bloomberg 的 analytics 一部分替换为自有定价库
- 严肃栈判断：**主力组件（专业分析向）**
- 主要风险点：需要强量化背景；不解决数据、UI、工作流

### Open Source Risk Engine

- 项目名称：[Open Source Risk Engine (ORE)](https://github.com/OpenSourceRisk/Engine)
- 项目类型：基于 QuantLib 的定价/风险/XVA 平台
- 主要语言/技术栈：C++、Excel/LibreOffice、Python、Jupyter
- 替代 Bloomberg 的哪部分：更接近机构级风险分析、XVA、情景与定价工作流
- 支持资产类别：机构衍生品与风险分析场景
- 是否有图形界面：有限；主要是 Excel / Jupyter / 配置驱动接口
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：在“专业风险引擎”层面非常少见；比大多数通用量化库更接近 sell-side / risk 语境
- 缺点：复杂；不是通用个人终端；UI 很弱
- 最适合的使用场景：需要 Bloomberg analytics / risk 的专业替代件，而不是日常看盘
- 严肃栈判断：**有条件纳入**
- 主要风险点：集成成本高；不适合作为个人用户第一选择

### skfolio

- 项目名称：[skfolio](https://github.com/skfolio/skfolio)
- 项目类型：投资组合优化库
- 主要语言/技术栈：Python、scikit-learn 风格 API
- 替代 Bloomberg 的哪部分：组合优化、配置、风险分解
- 支持资产类别：资产无关，适合股票/ETF/加密等时间序列组合问题
- 是否有图形界面：没有
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：非常适合补齐“组合优化”这一块；和 Python 研究栈很搭
- 缺点：不是终端；不负责数据接入；不负责执行
- 最适合的使用场景：Python 研究与资产配置
- 严肃栈判断：**辅助组件**
- 主要风险点：容易被误当成完整 portfolio platform，其实只是优化层

### Ghostfolio

- 项目名称：[Ghostfolio](https://github.com/ghostfolio/ghostfolio)
- 项目类型：开源财富管理 / 投资组合 Web 应用
- 主要语言/技术栈：Angular、NestJS、PostgreSQL、Prisma、Redis
- 替代 Bloomberg 的哪部分：投资组合监控、持仓分析、图表、资产分解、风险视图、watchlist 风格界面
- 支持资产类别：股票、ETF、加密
- 是否有图形界面：有，且是最成熟的纯开源 Web GUI 之一
- 是否支持自托管：支持，官方 Docker 镜像和 Compose 文档完整
- 维护状态：**活跃维护**
- 优点：界面完成度高；Web 端体验好；适合长期个人组合监控；有 demo
- 缺点：更像 wealth management app，不是研究终端；宏观、财报、新闻流都不深；部分更好的数据依赖 premium/cloud 方案
- 最适合的使用场景：普通个人用户的“开源投资看板”
- 严肃栈判断：**主力组件**
- 主要风险点：你会很容易把它想成“开源彭博前端”，但它其实只替代了 Bloomberg 的 portfolio/overview 一角
- 界面体验判断：**A-，是本次调研里最像成熟 SaaS 产品的纯开源 Web UI**

### Wealthfolio

- 项目名称：[Wealthfolio](https://github.com/afadil/wealthfolio)
- 项目类型：本地优先桌面投资跟踪器
- 主要语言/技术栈：Rust、Tauri、现代 Web 前端、可选本地 Web/Axum 服务
- 替代 Bloomberg 的哪部分：个人投资组合跟踪、绩效分析、账户视图、轻量 dashboard
- 支持资产类别：多账户、多资产类型的个人投资记录，适合股票/ETF/加密等日常投资资产
- 是否有图形界面：有，桌面 GUI 很漂亮；也支持以本地服务方式跑 Web UI
- 是否支持自托管：支持，本地优先；也提供 Docker/Web 运行方式
- 维护状态：**活跃维护**
- 优点：UI 很好看；本地优先、隐私友好；对个人用户门槛低；设计感强
- 缺点：生态和历史积累还不如 Ghostfolio/Portfolio Performance；研究能力弱；数据连接层不够 Bloomberg 式
- 最适合的使用场景：追求界面和隐私的个人投资监控
- 严肃栈判断：**主力组件**
- 主要风险点：项目较年轻；导入器和边缘资产支持还在演化
- 界面体验判断：**A-，桌面侧的产品感非常强**

### Portfolio Performance

- 项目名称：[Portfolio Performance](https://github.com/portfolio-performance/portfolio)
- 项目类型：桌面投资组合分析应用
- 主要语言/技术栈：Java / Eclipse RCP
- 替代 Bloomberg 的哪部分：组合监控、交易记录、绩效分析、报表与导入
- 支持资产类别：股票、加密、基金、债券和其他投资资产
- 是否有图形界面：有，桌面 GUI
- 是否支持自托管：本地桌面使用，不是服务器式自托管
- 维护状态：**活跃维护**
- 优点：成熟、稳、导入器和社区积累强；绩效分析很扎实
- 缺点：界面较传统；不适合当现代 Web 终端；研究与数据平台能力弱
- 最适合的使用场景：稳妥的长期组合记账与绩效复盘
- 严肃栈判断：**主力组件**
- 主要风险点：更像成熟桌面工具，不像 Bloomberg 那种实时工作台
- 界面体验判断：**C+，功能强但审美和交互明显偏老派**

### rotki

- 项目名称：[rotki](https://github.com/rotki/rotki)
- 项目类型：开源、自托管、隐私优先的组合管理与会计工具
- 主要语言/技术栈：Python + 前端应用
- 替代 Bloomberg 的哪部分：加密资产组合监控、链上分析、会计与税务相关流水整理
- 支持资产类别：加密、DeFi、钱包、交易所、NFT；股票等传统资产支持较弱或偏手工
- 是否有图形界面：有
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：加密与链上能力很深；隐私和数据所有权做得好；适合复杂 crypto portfolio
- 缺点：不是通用多资产终端；很多高级体验会碰到 premium 边界；股票/宏观/财报都不是强项
- 最适合的使用场景：crypto-heavy 用户的自托管组合与会计平台
- 严肃栈判断：**主力组件（加密场景）**
- 主要风险点：如果你的核心不是加密，它的覆盖面会明显不够
- 界面体验判断：**B，信息量足，但产品风格更偏功能型而不是优雅型**

### OpenAlgo

- 项目名称：[OpenAlgo](https://github.com/marketcalls/openalgo)
- 项目类型：自托管算法交易平台
- 主要语言/技术栈：Python Flask + React
- 替代 Bloomberg 的哪部分：执行层、券商抽象层、交易 dashboard、告警与自动化
- 支持资产类别：主要取决于接入的 30+ 印度券商，强项是印度股票/期货/期权交易工作流
- 是否有图形界面：有，Web 前端
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：是真正的 self-hosted trading platform；前端比很多量化项目更像产品；执行集成强
- 缺点：地域边界非常强；不是全球通用多资产终端；研究与基本面层薄弱
- 最适合的使用场景：印度市场交易自动化与个人交易工作台
- 严肃栈判断：**有条件纳入**
- 主要风险点：如果你不是印度市场用户，它的价值会大幅下降
- 界面体验判断：**B+，在执行平台里相当不错**

### Freqtrade

- 项目名称：[Freqtrade](https://github.com/freqtrade/freqtrade)
- 项目类型：开源加密交易机器人平台
- 主要语言/技术栈：Python、WebUI、Telegram
- 替代 Bloomberg 的哪部分：加密实盘执行、回测、策略优化、策略监控
- 支持资产类别：加密现货、部分期货/杠杆场景
- 是否有图形界面：有，内建 WebUI
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：功能完整；backtesting / hyperopt / WebUI / Telegram 链路成熟；社区大
- 缺点：只适用于加密；不是 analyst terminal；需要明确风控和运维能力
- 最适合的使用场景：crypto 量化执行平台
- 严肃栈判断：**主力组件（加密执行）**
- 主要风险点：如果你要的是 Bloomberg 式数据研究终端，它只替代执行层
- 界面体验判断：**B，实用型，不算精致但很能打**

### Hummingbot

- 项目名称：[Hummingbot](https://github.com/hummingbot/hummingbot)
- 项目类型：开源自动化交易框架
- 主要语言/技术栈：Python、Gateway、交易所/DEX 连接器
- 替代 Bloomberg 的哪部分：多交易场所自动化、market making、套利、DEX/CEX 接入
- 支持资产类别：加密现货、永续；CEX + DEX
- 是否有图形界面：核心仍偏 CLI/框架式；GUI 不是其最强项
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：连接器覆盖广；DEX/CEX 能力强；更适合复杂 crypto automation
- 缺点：UI 不如 Freqtrade；操作复杂度更高；不是研究终端
- 最适合的使用场景：加密多 venue 自动化交易
- 严肃栈判断：**有条件纳入**
- 主要风险点：工程和运维门槛较高；更像 bot framework 而不是终端

### TradingView Lightweight Charts

- 项目名称：[Lightweight Charts](https://github.com/TradingView/lightweight-charts)
- 项目类型：金融图表组件库
- 主要语言/技术栈：TypeScript、HTML5 Canvas
- 替代 Bloomberg 的哪部分：价格图表、交互式图表嵌入
- 支持资产类别：资产无关，可用于股票/期货/外汇/加密
- 是否有图形界面：是，但它是组件，不是完整应用
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：非常成熟；性能好；界面风格接近交易软件；Demo 和文档优秀
- 缺点：只解决图表；你仍需要后端、指标、筛选器和工作流
- 最适合的使用场景：自建 Web 终端的图表层
- 严肃栈判断：**主力组件**
- 主要风险点：不要把“图表库”误认为“终端产品”
- 界面体验判断：**A，图表层非常接近专业交易软件**

### KLineChart

- 项目名称：[KLineChart](https://github.com/klinecharts/KLineChart)
- 项目类型：K 线图表组件库
- 主要语言/技术栈：TypeScript、HTML5 Canvas
- 替代 Bloomberg 的哪部分：K 线图表与技术分析可视化
- 支持资产类别：资产无关
- 是否有图形界面：是，但属于嵌入式图表组件
- 是否支持自托管：支持
- 维护状态：**活跃维护**
- 优点：轻量、可定制、移动端友好；适合自建交易/行情前端
- 缺点：生态影响力不如 Lightweight Charts；仍然只是图表层
- 最适合的使用场景：自建行情页、技术分析页、移动端看盘页
- 严肃栈判断：**辅助组件**
- 主要风险点：如果你要的是产品级终端，仍然要自己补很多层
- 界面体验判断：**B+，很适合做漂亮的 K 线页面**

---

## 3. 重要但不应被误判为“纯开源整体替代”的边界案例

### OpenBB Workspace

- 链接：<https://pro.openbb.co>
- 为什么很多人会想到它：它确实是这批项目里**最像 Bloomberg 风格 analyst workspace** 的东西。
- 为什么我没把它放进纯开源主榜：`OpenBB` 开源核心是数据平台，但 `Workspace` 明确是单独的 enterprise UI / analyst workspace。
- 我会不会把它纳入严肃栈：**会，作为边界案例**。
- 风险点：不是纯开源；你得到的是“开源底座 + 商业工作区”的路线。

### vectorbt

- 链接：[vectorbt](https://github.com/polakowo/vectorbt)
- 为什么很多人会想到它：量化研究体验很好，速度快，生态有影响力。
- 为什么没放进纯开源主榜：仓库许可证是 **Apache 2.0 + Commons Clause**，严格说不是纯开源。
- 我会不会把它纳入严肃栈：**个人研究可考虑，严肃纯开源主榜不纳入**。
- 风险点：许可边界很重要，尤其是你未来要商业化或提供托管服务时。

### Investbrain

- 链接：[Investbrain](https://github.com/investbrainapp/investbrain)
- 为什么很多人会想到它：UI 路线对个人用户有吸引力。
- 为什么没放进纯开源主榜：许可证是 **CC BY-NC 4.0**，不是标准开源软件许可。
- 我会不会把它纳入严肃栈：**不纳入纯开源主榜**。
- 风险点：非商业限制非常明确。

### OpenBBTerminal / Legacy CLI

- 链接：[OpenBBTerminal（已归档）](https://github.com/OpenBB-finance/OpenBBTerminal)
- 历史意义：它是过去最像“开源 Bloomberg 终端”的东西之一。
- 今天为什么不能推荐：仓库已归档，路线已转向新的 OpenBB 平台/Workspace。
- 我会不会把它纳入严肃栈：**不会**。
- 风险点：维护终止。

### Backtrader

- 链接：[Backtrader](https://github.com/mementum/backtrader)
- 为什么仍值得提一下：影响力很大，教程多，很多旧项目仍在用。
- 为什么不建议新项目把它当核心：主仓库最近一次实质提交已很久，维护信号明显弱。
- 我会不会把它纳入严肃栈：**不建议新项目采用**。
- 风险点：生态老化、维护停滞。

### MarketStore

- 链接：[MarketStore](https://github.com/alpacahq/marketstore)
- 位置：历史上很典型的金融时序数据库项目。
- 为什么没有进主推荐：今天相比 `QuestDB`，我对它的生态热度与维护优先级判断明显更低。
- 我会不会把它纳入严肃栈：**优先级很低**。
- 风险点：更像历史项目而不是今天自建终端的首选底座。

---

## 4. 这次我会放进严肃可用技术栈的项目

### 主力组件

- OpenBB
- FinanceToolkit
- EdgarTools
- CCXT
- Qlib
- Lean（有生态边界）
- NautilusTrader
- QuantLib
- Ghostfolio
- Wealthfolio
- Portfolio Performance
- rotki（加密场景）
- Freqtrade（加密执行场景）
- TradingView Lightweight Charts

### 辅助组件

- QuestDB
- skfolio
- KLineChart

### 有条件纳入

- Open Source Risk Engine
- OpenAlgo
- Hummingbot

### 不建议新项目采用或不进纯开源主榜

- vectorbt（许可边界）
- Investbrain（非商业许可）
- OpenBB Workspace（不是纯开源）
- OpenBBTerminal（已归档）
- Backtrader（维护过弱）
- MarketStore（优先级低）

---

## 5. 最终榜单

### 5.1 最适合普通个人用户的前 5 个项目

1. **Ghostfolio**  
   最平衡的 Web 体验，界面成熟、Docker 友好、个人用户最容易直接长期用。
2. **Wealthfolio**  
   桌面端体验很强，本地优先和设计感是亮点。
3. **Portfolio Performance**  
   没有前两者漂亮，但非常稳，非常适合长期持有者做绩效复盘。
4. **OpenBB**  
   不是组合管理产品，但作为数据/研究入口价值非常高。
5. **rotki**  
   如果你有较重的加密仓位，它会比一般股票向工具更有价值。

### 5.2 最适合量化研究的前 5 个项目

1. **OpenBB**  
   研究栈的数据和 API 底座。
2. **Qlib**  
   因子/机器学习研究强。
3. **Lean**  
   多资产回测到执行链路成熟。
4. **NautilusTrader**  
   更偏工程化、生产级的事件驱动引擎。
5. **QuantLib**  
   如果你涉及期权、固定收益、利率或衍生品分析，它的重要性会陡增。

### 5.3 最适合自己搭“穷人版彭博终端”的前 5 个项目

1. **OpenBB**  
   这是最像“统一数据中台”的东西。
2. **Ghostfolio**  
   承担 portfolio 和 overview 层。
3. **QuestDB**  
   承担自建行情仓与时序数据层。
4. **Lightweight Charts**  
   承担高质量图表层。
5. **FinanceToolkit**  
   承担财务比率和分析层。

### 5.4 最接近 Bloomberg Terminal 使用体验的前 5 个项目

> 这里我分成“纯开源前提下”和“放宽到边界案例”两种理解。

**纯开源前提下：**

1. Ghostfolio
2. Wealthfolio
3. OpenAlgo
4. rotki
5. Portfolio Performance

**如果放宽到边界案例：**

1. OpenBB + OpenBB Workspace
2. Ghostfolio
3. Wealthfolio
4. OpenAlgo
5. rotki

说明：

- 这里的“接近 Bloomberg 使用体验”主要指“信息组织、界面完成度、工作台感”，不是数据深度。
- 真正最接近 Bloomberg 的通常不是最纯的开源方案，而是“开源底座 + 商业工作区”的路线。

---

## 6. 总对比表

| 项目 | 主要层次 | 资产覆盖 | GUI | 自托管 | 维护状态 | 是否主推荐 | 主要风险 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| OpenBB | 数据/研究/API/screener | 多资产 | 部分（CLI） | 是 | 活跃维护 | 是 | 最佳 UI 不在纯开源核心里 |
| FinanceToolkit | 基本面/分析 | 多资产 | 否 | 是 | 活跃维护 | 是 | 依赖外部数据输入质量 |
| EdgarTools | 财报/XBRL | 美股 | 否 | 是 | 活跃维护 | 是 | 美国中心 |
| CCXT | 加密接口/执行 | 加密 | 否 | 是 | 活跃维护 | 是 | 只是连接器，不是平台 |
| QuestDB | 数据底座 | 资产无关 | 基础控制台 | 是 | 活跃维护 | 有条件主推 | 不是终端 |
| Qlib | 量化研究 | 股票为主 | 否 | 是 | 活跃维护 | 是 | 多资产和终端体验一般 |
| Lean | 回测/执行 | 多资产 | CLI/Jupyter | 是 | 活跃维护 | 是 | 工作流与 QuantConnect 生态绑定较深 |
| NautilusTrader | 交易引擎 | 多资产 | 否 | 是 | 活跃维护 | 是 | 工程门槛高 |
| QuantLib | 定价分析 | 衍生品/固收/FX | 否 | 是 | 活跃维护 | 是 | 学习和集成成本高 |
| ORE | 风险/XVA | 专业衍生品 | 很有限 | 是 | 活跃维护 | 有条件 | 过于专业，不像终端 |
| skfolio | 组合优化 | 资产无关 | 否 | 是 | 活跃维护 | 辅助推荐 | 只是优化层 |
| Ghostfolio | 组合监控/Web | 股票/ETF/加密 | 是 | 是 | 活跃维护 | 是 | 不是研究终端 |
| Wealthfolio | 桌面组合监控 | 多资产个人投资 | 是 | 是 | 活跃维护 | 是 | 年轻项目，生态较小 |
| Portfolio Performance | 组合分析 | 股票/基金/债券/加密 | 是 | 本地桌面 | 活跃维护 | 是 | UI 老派 |
| rotki | 加密组合/会计 | 加密/DeFi/NFT | 是 | 是 | 活跃维护 | 是（加密场景） | 传统资产覆盖弱 |
| OpenAlgo | 自托管执行平台 | 印度市场为主 | 是 | 是 | 活跃维护 | 有条件 | 地域锁定 |
| Freqtrade | 加密执行/回测 | 加密 | 是 | 是 | 活跃维护 | 是（加密执行） | 只解决执行层 |
| Hummingbot | 多 venue crypto automation | 加密 | 有限 | 是 | 活跃维护 | 有条件 | UI 弱、运维复杂 |
| Lightweight Charts | 图表层 | 资产无关 | 组件级 | 是 | 活跃维护 | 是 | 只解决图表 |
| KLineChart | 图表层 | 资产无关 | 组件级 | 是 | 活跃维护 | 辅助推荐 | 生态较小 |

---

## 7. 哪些 Bloomberg 能力容易被开源替代，哪些很难

### 比较容易被替代的

- **图表系统**：Lightweight Charts / KLineChart 足够强。
- **个人投资组合监控**：Ghostfolio / Wealthfolio / Portfolio Performance 已经很成熟。
- **量化研究与回测**：Qlib / Lean / NautilusTrader / QuantLib 都很能打。
- **美国 SEC 财报解析**：EdgarTools 非常实用。
- **加密市场接入和执行**：CCXT / Freqtrade / Hummingbot 很成熟。
- **自定义分析和筛选器**：OpenBB + FinanceToolkit + 自己前端，可以做出很不错的 screener。

### 很难被替代的

- **机构级实时数据**：尤其是跨交易所、跨资产、低延迟、可再分发合规的数据。
- **Bloomberg News / 新闻流 / 事件与研究整合**：开源几乎没有同等级替代。
- **全球宏观 + 财务 + 行业 + 公司事件的一体化标准语义层**：开源项目通常只拿到“原材料”，很少有 Bloomberg 那种打磨好的统一语义层。
- **成熟工作流**：Bloomberg 真正强的不是单个功能，而是消息、图表、数据、筛选、财报、监控、导出、协作之间的连续工作流。
- **机构支持与许可治理**：终端价值里有很大一部分来自商业数据协议、支持体系、训练成本和组织流程适配，这些开源很难复制。

---

## 8. 三套组合方案

### A. 最低成本方案

目标：几乎零订阅、最少运维、个人日常看盘和组合跟踪够用。

- 数据层：`OpenBB`
- 财务分析：`FinanceToolkit`
- 美股 filings：`EdgarTools`
- 组合监控：`Ghostfolio` 或 `Wealthfolio`
- 图表：直接用产品自带图表；如自建页面就加 `Lightweight Charts`
- 可选加密：`rotki`

这套方案能替代 Bloomberg 的：

- 基础行情查看
- 简单 screeners
- 财务比率与 filings
- 个人 portfolio monitor

这套方案替代不了的：

- 机构级实时数据
- 新闻流
- 专业宏观库
- 一体化终端工作流

### B. Python 研究方案

目标：Notebook / script 优先，兼顾因子、基本面、回测和组合分析。

- 数据底座：`OpenBB`
- 基本面与指标：`FinanceToolkit`
- 美股 filings：`EdgarTools`
- 因子/ML 研究：`Qlib`
- 多资产回测/执行：`Lean`
- 组合优化：`skfolio`
- 衍生品分析：`QuantLib`

适合谁：

- 想把“终端里的分析”迁到 notebook / Python pipeline 的人

最大优点：

- 技术自由度高
- 可复现
- 可版本控制

最大短板：

- 没有 Bloomberg 那种随手可用的一体化前端

### C. 自托管 Web 终端方案

目标：浏览器使用、Docker 友好、可扩展图表与 dashboard，尽量接近“穷人版终端”。

- API / 数据中台：`OpenBB`
- 市场数据时序仓：`QuestDB`
- 财务/指标服务：`FinanceToolkit` + `EdgarTools`
- 图表前端：`Lightweight Charts`
- 组合模块：`Ghostfolio`
- 加密执行层：`CCXT` + `Freqtrade`
- 可选地区执行层：`OpenAlgo`（如果你是印度市场）

这套方案能做出来的东西：

- 一个像样的自托管 Web 工作台
- 自己的行情页、财务页、portfolio 页、strategy 页
- 可渐进扩展为团队内部工具

主要缺口：

- 没有 Bloomberg News
- 没有机构级许可数据
- 你要自己做身份、权限、缓存、ETL、告警和 UI 统一性

---

## 9. 我对整个问题的最终判断

- 如果你的目标是“**免费、开源、自己玩**”，那么最值得投入时间的不是找一个神奇单品，而是接受组合路线。
- 如果你的目标是“**最接近产品体验**”，优先看：`Ghostfolio`、`Wealthfolio`，以及边界案例 `OpenBB Workspace`。
- 如果你的目标是“**研究能力**”，优先看：`OpenBB`、`Qlib`、`Lean`、`NautilusTrader`、`QuantLib`。
- 如果你的目标是“**自己搭一个穷人版 Bloomberg**”，最佳骨架是：
  - `OpenBB` 负责数据中台
  - `FinanceToolkit + EdgarTools` 负责分析层
  - `QuestDB` 负责时间序列存储
  - `Lightweight Charts` 负责图表
  - `Ghostfolio` 负责组合与 dashboard
- 如果你的目标是“**我要一个开源 Bloomberg 终端成品**”，那么我会直接告诉你：**今天并不存在一个纯开源、严肃、活跃、漂亮、全栈、1:1 的替代品**。
- 但如果你接受“组合式替代”，开源世界已经可以替掉 Bloomberg 很大一块外围能力，尤其是：
  - 研究
  - 图表
  - 组合监控
  - 部分基本面
  - 加密/量化执行

---

## 10. 主要参考项目与文档

- OpenBB GitHub：<https://github.com/OpenBB-finance/OpenBB>
- OpenBB 文档：<https://docs.openbb.co/>
- OpenBB Workspace：<https://pro.openbb.co>
- FinanceToolkit：<https://github.com/JerBouma/FinanceToolkit>
- FinanceToolkit 文档：<https://www.jeroenbouma.com/projects/financetoolkit/docs>
- EdgarTools：<https://github.com/dgunning/edgartools>
- EdgarTools 文档：<https://edgartools.readthedocs.io/>
- Qlib：<https://github.com/microsoft/qlib>
- Qlib 文档：<https://qlib.readthedocs.io/>
- Lean：<https://github.com/QuantConnect/Lean>
- Lean 文档：<https://www.quantconnect.com/docs>
- NautilusTrader：<https://github.com/nautechsystems/nautilus_trader>
- NautilusTrader 文档：<https://nautilustrader.io/docs/latest/>
- QuantLib：<https://github.com/lballabio/QuantLib>
- ORE：<https://github.com/OpenSourceRisk/Engine>
- Ghostfolio：<https://github.com/ghostfolio/ghostfolio>
- Ghostfolio Demo：<https://ghostfol.io/en/demo>
- Wealthfolio：<https://github.com/afadil/wealthfolio>
- Portfolio Performance：<https://github.com/portfolio-performance/portfolio>
- Portfolio Performance Manual：<https://help.portfolio-performance.info/en>
- rotki：<https://github.com/rotki/rotki>
- rotki 文档：<https://docs.rotki.com/>
- OpenAlgo：<https://github.com/marketcalls/openalgo>
- OpenAlgo 文档：<https://docs.openalgo.in/>
- Freqtrade：<https://github.com/freqtrade/freqtrade>
- Freqtrade 文档：<https://www.freqtrade.io/>
- Hummingbot：<https://github.com/hummingbot/hummingbot>
- Hummingbot 文档：<https://hummingbot.org/>
- CCXT：<https://github.com/ccxt/ccxt>
- QuestDB：<https://github.com/questdb/questdb>
- Lightweight Charts：<https://github.com/TradingView/lightweight-charts>
- Lightweight Charts 文档：<https://tradingview.github.io/lightweight-charts/>
- KLineChart：<https://github.com/klinecharts/KLineChart>
- OpenBBTerminal（归档）：<https://github.com/OpenBB-finance/OpenBBTerminal>
- vectorbt：<https://github.com/polakowo/vectorbt>
- Investbrain：<https://github.com/investbrainapp/investbrain>
