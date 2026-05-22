import { BookOpen, CheckCircle2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { InlineState, MetricCard } from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import { api } from "../lib/api";

const SECTIONS = [
  {
    key: "workflows",
    label: "工作流",
    title: "从筛选到研究、因子、回测、模拟和证据导出",
    items: [
      "筛选器到研究：运行受控 universe 和 variant，选择结果后生成单资产研究简报。",
      "数据源到研究：抽取宏观、事件或加密只读来源，带 provenance 写入研究上下文。",
      "研究到因子：围绕当前资产运行本地因子快照，保留研究来源和缺失数据说明。",
      "因子到回测：把可排名的因子结果交给 Top-N 轮动模板做本地模拟。",
      "回测到纸面交易：把策略结果转换为本地 paper session，不触达 broker。",
      "纸面交易到 Binance intent：只创建 Binance 意图，然后停在人工确认边界。",
    ],
  },
  {
    key: "security",
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
  {
    key: "analysis",
    label: "分析",
    title: "研究页结构化分析模块",
    items: [
      "资产质量快照会读取报价、基本面、公告和 provider 能力状态。",
      "筛选器上下文会记录 preset、variant、universe、命中规则和解释。",
      "因子上下文会记录因子 run、排名、分位、贡献项和缺失字段。",
      "证据链会串起因子、回测、纸面交易、Binance intent 和审计事件。",
    ],
  },
  {
    key: "ai",
    label: "AI 助手",
    title: "本地优先、证据约束和云端显式确认",
    items: [
      "研究页 AI 助手默认不生成；需要先预览将进入上下文的研究证据、数据质量、引用和已脱敏笔记。",
      "本地模式是默认模式，生成内容只能引用当前 Research brief、结构化证据、provenance 和 data-quality 边界。",
      "云端模式必须在单次请求中选择 Cloud，并勾选只发送可见脱敏预览；未确认、预览过期或缺少本机 API key 时会 blocked。",
      "AI 不读取 Stronghold、API key、session token、原始日志、执行提交 payload 或 kill-switch 修改请求。",
      "生成文本保存进 notes 或导出前仍是用户动作；审计只记录 provider、模板、引用数量和 blocked 原因，不记录密钥。",
    ],
  },
  {
    key: "screeners",
    label: "筛选",
    title: "预设筛选器与变体调参",
    items: [
      "系统默认变体只读，用来保证基准结果稳定。",
      "点击任意调参项会复制为自定义变体，再保存流动性、趋势和过热护栏设置。",
      "运行结果始终绑定 preset、variant 和 universe，避免配置和输出错位。",
      "加密筛选器只使用受控 Binance 主流币池或稳定 catalog，不做无限市场爬取。",
    ],
  },
  {
    key: "factors",
    label: "因子",
    title: "免费数据可计算的股票、指数和加密因子",
    items: [
      "股票因子覆盖动量、价值、质量、保守成长和低波动风险。",
      "加密因子覆盖动量强度、成交量确认和过热护栏。",
      "指数/ETF 因子覆盖趋势结构和防御质量。",
      "短期反转因子用于寻找中期仍有支撑但短期回撤的候选。",
      "所有因子都是 research-only 信号，不会直接发起真实订单。",
    ],
  },
  {
    key: "simulation",
    label: "回测与模拟",
    title: "本地回测、纸面交易与报告",
    items: [
      "回测使用本地因子快照、Top-N 参数、再平衡频率、交易成本和滑点假设。",
      "纸面交易只在本地生成订单、成交、现金流水和持仓，不调用交易所。",
      "报告导出使用 observed、simulated、blocked、audited 等谨慎证据语言。",
    ],
  },
  {
    key: "binance",
    label: "币安真实交易",
    title: "从交易意图到真实提交的保护边界",
    items: [
      "先在策略实验室或工作流中创建 Binance execution intent。",
      "点击风险提交后，系统检查 live mode、风险确认、凭证、kill switch、白名单、行情新鲜度、订单限额、纸面证据和余额。",
      "任何检查失败都会把 intent 标记为 blocked，并写入审计。",
      "只有在用户显式开启 live mode、完成风险确认、清除 kill switch、配置凭证并再次点击提交后，才会调用 Binance submit。",
      "工作流页面不会替用户提交、不会清除 kill switch、不会修改风险确认。",
    ],
  },
  {
    key: "translation",
    label: "翻译",
    title: "本地 i18n 管线与在线翻译适配层",
    items: [
      "本地词典负责产品运行时文案，缺失键和固定英文由脚本扫描。",
      "在线翻译只用于辅助生成译文建议，不会在运行时自动改动交易或研究内容。",
      "未配置翻译 API key 时，桌面端继续使用本地词典和术语表。",
    ],
  },
];

export function ManualView() {
  const [activeKey, setActiveKey] = useState(SECTIONS[0].key);
  const translation = useAsyncResource(async () => api.getTranslationStatus(), []);
  const active = SECTIONS.find((section) => section.key === activeKey) ?? SECTIONS[0];

  return (
    <div aria-label={`manual-view section=${active.key}`} className="manual-workspace">
      <section className="manual-sidebar research-panel">
        <div className="screeners-column-head">
          <div>
            <p className="eyebrow">Manual</p>
            <strong>说明书</strong>
          </div>
          <BookOpen size={18} />
        </div>
        <div className="manual-tab-list">
          {SECTIONS.map((section) => (
            <button
              aria-label={`manual-section key=${section.key} selected=${String(section.key === active.key)}`}
              className={`variant-card ${section.key === active.key ? "selected" : ""}`}
              key={section.key}
              onClick={() => setActiveKey(section.key)}
              type="button"
            >
              <strong>{section.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="manual-content research-panel">
        <div className="card-header">
          <div>
            <p className="eyebrow">{active.label}</p>
            <h3>{active.title}</h3>
          </div>
          <span className="mini-pill accent">research-only / confirmation-gated</span>
        </div>
        <div className="manual-step-list">
          {active.items.map((item, index) => (
            <div className="manual-step" key={item}>
              <span>{index + 1}</span>
              <p>{item}</p>
            </div>
          ))}
        </div>
        {active.key === "binance" ? (
          <div className="task-list">
            <InlineState label="真实交易必须经过用户可见确认；系统不会静默提交订单。" />
            <InlineState label="非 Binance 资产保持研究、回测、模拟或只读分析，不新增真实提交路径。" />
          </div>
        ) : null}
        {active.key === "security" ? (
          <div className="task-list">
            <InlineState label="重置本地解锁不是清空应用数据；它只让你重新设置进入敏感区域所需的本机 PIN/口令。" />
            <InlineState label="如果要删除凭证或本地研究数据，需要在对应模块中单独操作。" />
          </div>
        ) : null}
      </section>

      <section className="manual-side research-panel">
        <div className="screeners-column-head">
          <div>
            <p className="eyebrow">Status</p>
            <strong>工具状态</strong>
          </div>
          <ShieldAlert size={18} />
        </div>
        <div className="metric-grid manual-metric-grid">
          <MetricCard label="K线默认" value="30分钟" />
          <MetricCard label="交易边界" value="人工确认" />
          <MetricCard label="因子用途" value="研究信号" />
          <MetricCard label="本地解锁" value="可重置" />
          <MetricCard label="翻译" value={translation.data?.provider ?? "local"} />
        </div>
        {translation.loading ? <InlineState label="正在读取翻译工具状态..." /> : null}
        {translation.error ? <InlineState label={translation.error} actionLabel="重试" onAction={translation.reload} /> : null}
        {translation.data ? (
          <div className="translation-status-card">
            <CheckCircle2 size={18} />
            <div>
              <strong>{translation.data.configured ? "在线翻译已配置" : "本地词典运行中"}</strong>
              <p>{translation.data.message}</p>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
