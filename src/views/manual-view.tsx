import { BookOpen, CheckCircle2, ShieldAlert } from "lucide-react";
import { InlineState, MetricCard } from "../components/shared";
import { Badge } from "../components/ui-kit";
import { useAsyncResource } from "../hooks/use-async-resource";
import { useI18n } from "../i18n";
import { api } from "../lib/api";

type ManualSectionKey = "workflows" | "security" | "analysis" | "ai" | "screeners" | "factors" | "simulation" | "binance" | "translation";

export type ManualRouteSection =
  | "manualGettingStarted"
  | "manualResearchData"
  | "manualStrategyWorkflows"
  | "manualSecurityExecution"
  | "manualTroubleshooting";

const MANUAL_ROUTE_CHAPTER_KEYS: Record<ManualRouteSection, readonly ManualSectionKey[]> = {
  manualGettingStarted: ["workflows"],
  manualResearchData: ["analysis", "screeners", "factors"],
  manualStrategyWorkflows: ["simulation"],
  manualSecurityExecution: ["security", "binance"],
  manualTroubleshooting: ["ai", "translation"],
};

const SECTION_DEFINITIONS: Record<ManualSectionKey, { zh: ManualSectionContent; en: ManualSectionContent }> = {
  workflows: {
    zh: {
      label: "工作流",
      title: "从筛选到研究、因子、回测、模拟和证据导出",
      items: [
        "筛选器到研究：运行受控 universe 和 variant，选择结果后生成单资产研究简报。",
        "数据源到研究：抽取宏观、事件或加密只读来源，带 provenance 写入研究上下文。",
        "研究到因子：围绕当前资产运行本地因子快照，保留研究来源和缺失数据说明。",
        "因子到回测：把可排名的因子结果交给 Top-N 轮动模板做本地模拟。",
        "回测到纸面交易：把策略结果转换为本地 paper session，不触达 broker。",
        "纸面交易到 Binance intent：只创建 Binance 意图，然后停在人工作确认边界。",
      ],
    },
    en: {
      label: "Workflows",
      title: "From screening to research, factors, backtests, simulation, and evidence export",
      items: [
        "Screeners to research: run a controlled universe and variant, then create a single-asset research brief.",
        "Sources to research: bring in macro, event, or crypto read-only sources with provenance.",
        "Research to factors: run a local factor snapshot around the active asset and retain missing-data notes.",
        "Factors to backtests: pass rankable factor results to a local Top-N rotation simulation.",
        "Backtests to paper trading: turn strategy results into a local paper session without touching a broker.",
        "Paper trading to Binance intent: create an intent and stop at the human confirmation boundary.",
      ],
    },
  },
  security: {
    zh: {
      label: "本地安全",
      title: "本机 PIN/口令、空闲锁定与重置边界",
      items: [
        "首次进入敏感工作区时，需要设置本机 PIN 或口令；它只以 salted hash 保存在本机 sidecar，不会发送到远程服务。",
        "提供商凭证、执行/风控设置、安全审计等敏感表面需要先完成本地解锁。",
        "解锁后如果长时间无操作，敏感表面会自动重新锁定；也可以从界面手动锁定。",
        "如果忘记 PIN 或口令，可以在锁屏页或 Settings 的本地安全区域选择重置本地解锁。",
        "重置只清除 local unlock state，不删除 EDGAR/FRED/CoinGecko/Binance 凭证、组合、研究记录、工作流记录或本地数据库。",
        "重置后，下次进入敏感工作区会要求重新设置新的 PIN 或口令；旧口令不会被恢复，也不会写入日志或诊断包。",
      ],
    },
    en: {
      label: "Local security",
      title: "Local PIN/passphrase, idle locking, and reset boundaries",
      items: [
        "The first sensitive workspace visit asks for a local PIN or passphrase, stored only as a salted hash in the local sidecar.",
        "Provider credentials, execution and risk settings, and security audit surfaces require local unlock first.",
        "Sensitive surfaces relock after inactivity and can also be locked manually from the interface.",
        "If you forget the PIN or passphrase, reset local unlock from the lock screen or Settings.",
        "Reset clears only local unlock state; it does not delete provider credentials, portfolios, research, workflows, or local databases.",
        "After reset, the next sensitive workspace visit asks you to set a new PIN or passphrase; the old one is not recovered or logged.",
      ],
    },
  },
  analysis: {
    zh: { label: "分析", title: "研究页结构化分析模块", items: ["资产质量快照会读取报价、基本面、公告和 provider 能力状态。", "筛选器上下文会记录 preset、variant、universe、命中规则和解释。", "因子上下文会记录因子 run、排名、分位、贡献项和缺失字段。", "证据链会串起因子、回测、纸面交易、Binance intent 和审计事件。"] },
    en: { label: "Analysis", title: "Structured analysis modules for the research page", items: ["The asset-quality snapshot reads quotes, fundamentals, filings, and provider capability state.", "Screener context records the preset, variant, universe, matched rules, and explanation.", "Factor context records factor runs, ranks, percentiles, contributions, and missing fields.", "The evidence chain connects factors, backtests, paper trading, Binance intents, and audit events."] },
  },
  ai: {
    zh: { label: "AI 助手", title: "本地优先、证据约束和云端显式确认", items: ["Dashboard 的 AI Control 是全局入口；默认关闭，保存为本地模式或云端模式后，Research 页才会生成。", "本地模式默认指向 Ollama 接口，生成内容只能引用当前 Research brief、结构化证据、provenance 和 data-quality 边界。", "云端模式在 Dashboard 选择 ChatGPT、Gemini、Grok、Claude、DeepSeek、Qwen 或自定义接口，但单次生成仍必须在 Research 页确认脱敏预览。", "云端密钥只读取本机环境变量 PENGBO_AI_CLOUD_API_KEY；未确认、预览过期或缺少本机 API key 时会 blocked。", "AI 不读取 Stronghold、API key、session token、原始日志、执行提交 payload 或 kill-switch 修改请求。", "生成文本保存进 notes 或导出前仍是用户动作；审计只记录 provider、模板、引用数量和 blocked 原因，不记录密钥。"] },
    en: { label: "AI assistant", title: "Local-first behavior, evidence boundaries, and explicit cloud confirmation", items: ["Dashboard AI Control is the global entry point. It is off by default, and Research generates only after a local or cloud mode is saved.", "Local mode defaults to Ollama; generated content may cite only the active research brief, structured evidence, provenance, and data-quality boundaries.", "Cloud mode supports the configured provider, but every generation still requires confirmation of the redacted preview in Research.", "Cloud keys are read only from PENGBO_AI_CLOUD_API_KEY; missing confirmation, expired previews, or a missing key remain blocked.", "AI does not read Stronghold, API keys, session tokens, raw logs, execution payloads, or kill-switch requests.", "Saving generated text to notes or exporting it remains a user action; audit records provider, template, citation count, and blocked reason, never keys."] },
  },
  screeners: {
    zh: { label: "筛选", title: "预设筛选器与变体调参", items: ["系统默认变体只读，用来保证基准结果稳定。", "点击任意调参项会复制为自定义变体，再保存流动性、趋势和过热护栏设置。", "运行结果始终绑定 preset、variant 和 universe，避免配置和输出错位。", "加密筛选器只使用受控 Binance 主流币池或稳定 catalog，不做无限市场爬取。"] },
    en: { label: "Screeners", title: "Preset screeners and variant tuning", items: ["The system default variant is read-only so baseline results stay stable.", "Changing a tuning field creates a custom variant where liquidity, trend, and overheating guardrails can be saved.", "Runs stay bound to the preset, variant, and universe so configuration and output do not drift.", "Crypto screeners use a controlled Binance asset pool or stable catalog, not unlimited market crawling."] },
  },
  factors: {
    zh: { label: "因子", title: "免费数据可计算的股票、指数和加密因子", items: ["股票因子覆盖动量、价值、质量、保守成长和低波动风险。", "加密因子覆盖动量强度、成交量确认和过热护栏。", "指数/ETF 因子覆盖趋势结构和防御质量。", "短期反转因子用于寻找中期仍有支撑但短期回撤的候选。", "所有因子都是 research-only 信号，不会直接发起真实订单。"] },
    en: { label: "Factors", title: "Stock, index, and crypto factors computed from free data", items: ["Stock factors cover momentum, value, quality, conservative growth, and low-volatility risk.", "Crypto factors cover momentum strength, volume confirmation, and overheating guardrails.", "Index and ETF factors cover trend structure and defensive quality.", "Short-term reversal finds candidates with medium-term support after a short-term pullback.", "All factors are research-only signals and never initiate live orders directly."] },
  },
  simulation: {
    zh: { label: "回测与模拟", title: "本地回测、纸面交易与报告", items: ["回测使用本地因子快照、Top-N 参数、再平衡频率、交易成本和滑点假设。", "纸面交易只在本地生成订单、成交、现金流水和持仓，不调用交易所。", "报告导出使用 observed、simulated、blocked、audited 等谨慎证据语言。"] },
    en: { label: "Backtests and simulation", title: "Local backtests, paper trading, and reports", items: ["Backtests use local factor snapshots, Top-N parameters, rebalance frequency, trading costs, and slippage assumptions.", "Paper trading creates orders, fills, cash flows, and holdings locally without calling an exchange.", "Report exports use cautious evidence terms such as observed, simulated, blocked, and audited."] },
  },
  binance: {
    zh: { label: "币安真实交易", title: "从交易意图到真实提交的保护边界", items: ["先在策略实验室或工作流中创建 Binance execution intent。", "点击风险提交后，系统检查 live mode、风险确认、凭证、kill switch、白名单、行情新鲜度、订单限额、纸面证据和余额。", "任何检查失败都会把 intent 标记为 blocked，并写入审计。", "只有在用户显式开启 live mode、完成风险确认、清除 kill switch、配置凭证并再次点击提交后，才会调用 Binance submit。", "工作流页面不会替用户提交、不会清除 kill switch、不会修改风险确认。"] },
    en: { label: "Binance live trading", title: "Protection boundary from trading intent to live submission", items: ["Create a Binance execution intent in Strategy Lab or a workflow first.", "Risk submission checks live mode, risk confirmation, credentials, kill switch, allowlist, market freshness, order limits, paper evidence, and balance.", "Any failed check marks the intent blocked and records it in the audit.", "Binance submit runs only after the user enables live mode, confirms risk, clears the kill switch, configures credentials, and clicks submit again.", "The workflow page never submits for the user, clears the kill switch, or changes risk confirmation."] },
  },
  translation: {
    zh: { label: "翻译", title: "本地 i18n 管线与在线翻译适配层", items: ["本地词典负责产品运行时文案，缺失键和固定英文由脚本扫描。", "在线翻译只用于辅助生成译文建议，不会在运行时自动改动交易或研究内容。", "未配置翻译 API key 时，桌面端继续使用本地词典和术语表。"] },
    en: { label: "Translation", title: "Local i18n pipeline and online translation adapter", items: ["The local dictionary owns runtime product copy, while missing keys and fixed English are scanned by the check script.", "Online translation only helps draft suggestions and never changes trading or research content at runtime.", "Without a translation API key, the desktop app continues using the local dictionary and glossary."] },
  },
};

type ManualSectionContent = { label: string; title: string; items: string[] };

function manualChapter(routeSection: ManualRouteSection, language: "zh-CN" | "en-US"): ManualSectionContent {
  const languageKey = language === "zh-CN" ? "zh" : "en";
  const chapters = MANUAL_ROUTE_CHAPTER_KEYS[routeSection].map((key) => SECTION_DEFINITIONS[key][languageKey]);
  const primary = chapters[0];
  return {
    label: primary.label,
    title: primary.title,
    items: chapters.flatMap((chapter) => chapter.items),
  };
}

export function ManualView({
  routeSection = "manualGettingStarted",
}: {
  routeSection?: ManualRouteSection;
}) {
  const i18n = useI18n();
  const copy = manualCopy(i18n.language);
  const active = manualChapter(routeSection, i18n.language);
  const translation = useAsyncResource(async () => api.getTranslationStatus(), [routeSection], {
    enabled: routeSection === "manualTroubleshooting",
  });

  return (
    <div
      aria-label={`manual-view section=${routeSection}`}
      className="p2-page p2-manual-page"
      data-manual-section={routeSection}
      data-primary-task={routeSection}
    >
      <header className="p2-page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p className="p2-page-description">{copy.description}</p>
        </div>
        <div className="p2-page-header-meta">
          <Badge tone="info">{copy.researchOnly}</Badge>
          <span className="p2-header-count">{active.items.length} {copy.topics}</span>
        </div>
      </header>
      <div className="manual-workspace">
        <section className="manual-content research-panel p2-section-card p2-primary-section">
          <div className="card-header">
            <div>
              <p className="eyebrow">{active.label}</p>
              <h3>{active.title}</h3>
            </div>
            <div className="p2-page-header-meta">
              <BookOpen size={18} />
              <Badge tone="warning">{copy.gated}</Badge>
            </div>
          </div>
          <div className="manual-step-list">
            {active.items.map((item, index) => (
              <div className="manual-step" key={item}>
                <span>{index + 1}</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
          {routeSection === "manualSecurityExecution" ? (
            <div className="task-list">
              <InlineState label={copy.liveConfirmation} />
              <InlineState label={copy.nonBinanceBoundary} />
              <InlineState label={copy.resetBoundary} />
              <InlineState label={copy.deleteBoundary} />
            </div>
          ) : null}
        </section>

        {routeSection === "manualTroubleshooting" ? (
          <section className="manual-side research-panel p2-section-card p2-inspector-section">
          <div className="screeners-column-head">
            <div>
              <p className="eyebrow">{copy.status}</p>
              <strong>{copy.toolStatus}</strong>
            </div>
            <ShieldAlert size={18} />
          </div>
          <div className="metric-grid manual-metric-grid">
            <MetricCard label={copy.klineDefault} value={copy.thirtyMinutes} />
            <MetricCard label={copy.tradingBoundary} value={copy.humanConfirmation} />
            <MetricCard label={copy.factorUse} value={copy.researchSignal} />
            <MetricCard label={copy.localUnlock} value={copy.resettable} />
            <MetricCard label={copy.translation} value={translation.data?.provider ?? copy.local} />
          </div>
          {translation.loading ? <InlineState label={copy.translationLoading} /> : null}
          {translation.error ? <InlineState label={translation.error} actionLabel={copy.retry} onAction={translation.reload} /> : null}
          {translation.data ? (
            <div className="translation-status-card">
              <CheckCircle2 size={18} />
              <div>
                <strong>{translation.data.configured ? copy.translationConfigured : copy.localDictionary}</strong>
                <p>{translation.data.message}</p>
              </div>
            </div>
          ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function manualCopy(language: "zh-CN" | "en-US") {
  const zh = language === "zh-CN";
  return {
    eyebrow: zh ? "设置 / 手册" : "Settings / Manual",
    title: zh ? "工作台手册" : "Workbench manual",
    description: zh ? "了解本地研究流程、证据边界和确认门槛。" : "Understand the local research flow, evidence boundaries, and confirmation gates.",
    researchOnly: zh ? "仅限研究" : "Research only",
    topics: zh ? "个主题" : "topics",
    manual: zh ? "手册" : "Manual",
    guide: zh ? "说明书" : "Guide",
    gated: zh ? "仅限研究 / 需确认" : "Research-only / confirmation-gated",
    liveConfirmation: zh ? "真实交易必须经过用户可见确认；系统不会静默提交订单。" : "Live trading always requires visible user confirmation; the system never submits silently.",
    nonBinanceBoundary: zh ? "非 Binance 资产保持研究、回测、模拟或只读分析，不新增真实提交路径。" : "Non-Binance assets remain research, backtest, simulation, or read-only analysis; no live submission path is added.",
    resetBoundary: zh ? "重置本地解锁不是清空应用数据；它只让你重新设置进入敏感区域所需的本机 PIN/口令。" : "Resetting local unlock does not clear app data; it only lets you set the local PIN/passphrase required for sensitive areas again.",
    deleteBoundary: zh ? "如果要删除凭证或本地研究数据，需要在对应模块中单独操作。" : "Deleting credentials or local research data requires a separate action in the relevant module.",
    status: zh ? "状态" : "Status",
    toolStatus: zh ? "工具状态" : "Tool status",
    klineDefault: zh ? "K 线默认" : "Chart default",
    thirtyMinutes: zh ? "30 分钟" : "30 minutes",
    tradingBoundary: zh ? "交易边界" : "Trading boundary",
    humanConfirmation: zh ? "人工确认" : "Human confirmation",
    factorUse: zh ? "因子用途" : "Factor use",
    researchSignal: zh ? "研究信号" : "Research signal",
    localUnlock: zh ? "本地解锁" : "Local unlock",
    resettable: zh ? "可重置" : "Resettable",
    translation: zh ? "翻译" : "Translation",
    local: zh ? "本地" : "Local",
    translationLoading: zh ? "正在读取翻译工具状态..." : "Loading translation tool status...",
    translationConfigured: zh ? "在线翻译已配置" : "Online translation configured",
    localDictionary: zh ? "本地词典运行中" : "Local dictionary active",
    retry: zh ? "重试" : "Retry",
  };
}
