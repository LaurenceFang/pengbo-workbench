import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSearch,
  RefreshCcw,
  ScrollText,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { useMemo, useState } from "react";
import { InlineState, type BackendStatus } from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import { api, type AssetSearchResult, type SecurityAuditEvent } from "../lib/api";
import { useAppStore } from "../store/app-store";

type CommandCenterViewProps = {
  backendStatus: BackendStatus;
  onGlobalRefresh: () => Promise<void>;
};

type ActionState = {
  tone: "success" | "error";
  title: string;
  detail: string;
};

const providerActions = ["edgar", "binance", "fred", "coingecko"];

export function CommandCenterView({ backendStatus, onGlobalRefresh }: CommandCenterViewProps) {
  const sidecarReady = backendStatus === "online";
  const language = useAppStore((state) => state.language);
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const selectedResearchBriefId = useAppStore((state) => state.selectedResearchBriefId);
  const setActiveView = useAppStore((state) => state.setActiveView);
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
  const setLatestCommandFeedback = useAppStore((state) => state.setLatestCommandFeedback);
  const [query, setQuery] = useState(selectedAssetId || "AAPL");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [assetResults, setAssetResults] = useState<AssetSearchResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  const recentBriefs = useAsyncResource(async () => api.getRecentResearchBriefs(6), [], {
    enabled: sidecarReady,
  });
  const dataSourceStatus = useAsyncResource(async () => api.getDataSourceStatus(), [], {
    enabled: sidecarReady,
  });
  const localSecurity = useAsyncResource(async () => api.getLocalSecurityStatus(), [], {
    enabled: sidecarReady,
  });
  const securityAudit = useAsyncResource<SecurityAuditEvent[]>(async () => api.getSecurityAudit(8), [], {
    enabled: false,
  });
  const executionAudit = useAsyncResource(async () => api.getBinanceExecutionAudit(8), [], {
    enabled: false,
  });

  const selectedBrief = useMemo(
    () => (recentBriefs.data ?? []).find((brief) => brief.brief_id === selectedResearchBriefId) ?? null,
    [recentBriefs.data, selectedResearchBriefId],
  );
  const providerSummary = dataSourceStatus.data?.providers ?? [];

  const copy = {
    eyebrow: language === "zh-CN" ? "命令中心" : "Command Center",
    title: language === "zh-CN" ? "常用研究与审核动作" : "Frequent research and review actions",
    subtitle:
      language === "zh-CN"
        ? "从一个紧凑界面完成资产选择、研究简报、数据源刷新、报告导出、审计查看和安全检查。"
        : "Search assets, open briefs, refresh providers, export reports, inspect audits, and run safe local checks from one compact surface.",
    offline:
      language === "zh-CN"
        ? "Command Center 正在等待本地 sidecar；数据动作会保持不可用。"
        : "Command Center is waiting for the local sidecar; data actions remain unavailable.",
  };

  function setFeedback(state: ActionState) {
    setActionState(state);
    setLatestCommandFeedback({
      tone: state.tone,
      title: state.title,
      detail: state.detail,
    });
  }

  async function runAction(key: string, action: () => Promise<ActionState>) {
    if (!sidecarReady || busyKey !== null) {
      return;
    }
    setBusyKey(key);
    setActionState(null);
    try {
      setFeedback(await action());
    } catch (error) {
      setFeedback({
        tone: "error",
        title: language === "zh-CN" ? "动作被阻止" : "Action blocked",
        detail: error instanceof Error ? error.message : "Command Center action failed.",
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function searchAssets() {
    if (!query.trim() || !sidecarReady) {
      setAssetResults([]);
      return;
    }
    setBusyKey("asset-search");
    setSearchError(null);
    try {
      const results = await api.searchAssets(query.trim());
      setAssetResults(results.slice(0, 6));
      setFeedback({
        tone: "success",
        title: language === "zh-CN" ? "资产搜索完成" : "Asset search complete",
        detail: `${results.length} ${language === "zh-CN" ? "个匹配结果" : "matching assets"}.`,
      });
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Asset search failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function openOrCreateBrief(symbol: string): Promise<ActionState> {
    const normalized = symbol.trim().toUpperCase();
    const existing = (recentBriefs.data ?? []).find((brief) => brief.symbol === normalized);
    if (existing) {
      setSelectedAssetId(normalized);
      setSelectedResearchBriefId(existing.brief_id);
      setActiveView("research");
      return {
        tone: "success",
        title: language === "zh-CN" ? `已打开 ${normalized} 研究简报` : `Opened ${normalized} brief`,
        detail: existing.title,
      };
    }

    const created = await api.createResearchBrief({ symbol: normalized });
    setSelectedAssetId(normalized);
    setSelectedResearchBriefId(created.brief_id);
    setActiveView("research");
    recentBriefs.reload();
    return {
      tone: "success",
      title: language === "zh-CN" ? `已创建 ${normalized} 研究简报` : `Created ${normalized} brief`,
      detail: created.brief_id,
    };
  }

  function openAsset(symbol: string) {
    setSelectedAssetId(symbol);
    setActiveView("asset");
    setFeedback({
      tone: "success",
      title: language === "zh-CN" ? `已打开 ${symbol}` : `Opened ${symbol}`,
      detail: language === "zh-CN" ? "资产工作区已激活。" : "The asset workspace is now active.",
    });
  }

  return (
    <div aria-label="command-center" className="command-center-workspace">
      <section className="hero-panel command-center-hero">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h3>{copy.title}</h3>
          <p className="hero-copy">{copy.subtitle}</p>
        </div>
        <div className="command-center-hero-status">
          <span className={`mini-pill ${sidecarReady ? "accent" : ""}`}>{backendStatus}</span>
          <span className="mini-pill">
            {localSecurity.data?.initialized
              ? localSecurity.data.locked
                ? language === "zh-CN" ? "本地锁定" : "locked"
                : language === "zh-CN" ? "已解锁" : "unlocked"
              : language === "zh-CN" ? "未初始化" : "not initialized"}
          </span>
        </div>
      </section>

      {!sidecarReady ? (
        <section className="card">
          <InlineState label={copy.offline} />
        </section>
      ) : null}

      <section className="command-center-grid">
        <div className="card command-center-panel command-center-main">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{language === "zh-CN" ? "资产入口" : "Asset Entry"}</p>
              <h3>{language === "zh-CN" ? "搜索标的并进入研究流" : "Search a symbol and enter the research flow"}</h3>
            </div>
            <FileSearch size={18} />
          </div>
          <div className="command-center-search">
            <input
              aria-label="command-center-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void searchAssets();
                }
              }}
            />
            <button className="primary-button" disabled={!sidecarReady || busyKey === "asset-search"} onClick={() => void searchAssets()} type="button">
              <FileSearch size={16} />
              {busyKey === "asset-search" ? (language === "zh-CN" ? "搜索中" : "Searching") : language === "zh-CN" ? "搜索" : "Search"}
            </button>
          </div>
          {searchError ? <p className="panel-note danger">{searchError}</p> : null}
          <div className="command-center-result-list">
            {assetResults.map((asset) => (
              <div aria-label={`command-center-asset symbol=${asset.symbol}`} className="command-center-result" key={asset.symbol}>
                <div>
                  <strong>{asset.symbol}</strong>
                  <span>{asset.name} / {asset.market}</span>
                </div>
                <div className="hero-actions compact-actions">
                  <button className="ghost-button" onClick={() => openAsset(asset.symbol)} type="button">
                    <ArrowRight size={15} />
                    {language === "zh-CN" ? "资产" : "Asset"}
                  </button>
                  <button
                    aria-label={`command-center-action-open-brief symbol=${asset.symbol}`}
                    className="ghost-button"
                    disabled={busyKey !== null}
                    onClick={() => void runAction(`brief-${asset.symbol}`, () => openOrCreateBrief(asset.symbol))}
                    type="button"
                  >
                    <ScrollText size={15} />
                    {language === "zh-CN" ? "研究" : "Brief"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card command-center-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{language === "zh-CN" ? "最近研究" : "Recent Briefs"}</p>
              <h3>{language === "zh-CN" ? "继续已有简报" : "Continue existing briefs"}</h3>
            </div>
            <ScrollText size={18} />
          </div>
          <div className="command-center-stack">
            {(recentBriefs.data ?? []).slice(0, 5).map((brief) => (
              <button
                aria-label={`command-center-action-recent-brief brief=${brief.brief_id}`}
                className="command-center-row-button"
                key={brief.brief_id}
                onClick={() => {
                  setSelectedAssetId(brief.symbol);
                  setSelectedResearchBriefId(brief.brief_id);
                  setActiveView("research");
                }}
                type="button"
              >
                <strong>{brief.symbol}</strong>
                <span>{brief.title}</span>
              </button>
            ))}
            {!recentBriefs.loading && (recentBriefs.data ?? []).length === 0 ? (
              <p className="panel-note">{language === "zh-CN" ? "暂无研究简报。" : "No research briefs yet."}</p>
            ) : null}
          </div>
        </div>

        <div className="card command-center-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{language === "zh-CN" ? "数据源" : "Providers"}</p>
              <h3>{language === "zh-CN" ? "刷新与凭证边界" : "Refresh and credential boundaries"}</h3>
            </div>
            <RefreshCcw size={18} />
          </div>
          <div className="command-center-provider-grid">
            {providerActions.map((provider) => {
              const status = providerSummary.find((item) => item.provider === provider);
              return (
                <button
                  aria-label={`command-center-action-provider provider=${provider}`}
                  className="command-center-provider"
                  disabled={!sidecarReady || busyKey !== null}
                  key={provider}
                  onClick={() =>
                    void runAction(`provider-${provider}`, async () => {
                      const result = await api.testConnection(provider);
                      dataSourceStatus.reload();
                      await onGlobalRefresh();
                      return {
                        tone: result.status === "ok" || result.status === "cached" ? "success" : "error",
                        title: `${provider} ${result.status}`,
                        detail: result.message,
                      };
                    })
                  }
                  type="button"
                >
                  <strong>{provider}</strong>
                  <span>{status?.health ?? "unknown"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card command-center-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{language === "zh-CN" ? "报告导出" : "Report Export"}</p>
              <h3>{language === "zh-CN" ? "本地 Markdown 证据包" : "Local Markdown evidence packs"}</h3>
            </div>
            <Download size={18} />
          </div>
          <div className="command-center-stack">
            <button
              aria-label="command-center-action-export-research"
              className="command-center-row-button"
              disabled={!selectedResearchBriefId || busyKey !== null}
              onClick={() =>
                void runAction("export-research", async () => {
                  if (!selectedResearchBriefId) {
                    throw new Error("No active research brief is selected.");
                  }
                  const result = await api.exportResearchBrief(selectedResearchBriefId);
                  await onGlobalRefresh();
                  return {
                    tone: "success",
                    title: language === "zh-CN" ? "研究报告已导出" : "Research report exported",
                    detail: result.export_path,
                  };
                })
              }
              type="button"
            >
              <strong>{language === "zh-CN" ? "导出当前研究" : "Export active research"}</strong>
              <span>{selectedBrief?.symbol ?? selectedAssetId ?? "none"}</span>
            </button>
            <button
              aria-label="command-center-action-export-data-sources"
              className="command-center-row-button"
              disabled={busyKey !== null}
              onClick={() =>
                void runAction("export-data-sources", async () => {
                  const result = await api.exportDataSourceReport({
                    macroProvider: "worldbank",
                    macroSeriesId: "NY.GDP.MKTP.CD",
                    macroCountry: "CN",
                    newsQuery: selectedAssetId || "market OR earnings",
                    cryptoIds: "bitcoin,ethereum,solana",
                  });
                  return {
                    tone: "success",
                    title: language === "zh-CN" ? "数据源报告已导出" : "Data source report exported",
                    detail: result.export_path,
                  };
                })
              }
              type="button"
            >
              <strong>{language === "zh-CN" ? "导出数据源报告" : "Export data-source report"}</strong>
              <span>{language === "zh-CN" ? "只读来源、缓存和新鲜度" : "Read-only source, cache, and freshness"}</span>
            </button>
          </div>
        </div>

        <div aria-label="command-center-audit" className="card command-center-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{language === "zh-CN" ? "审计" : "Audit"}</p>
              <h3>{language === "zh-CN" ? "红acted 本地事件" : "Redacted local events"}</h3>
            </div>
            <ShieldCheck size={18} />
          </div>
          <div className="hero-actions compact-actions">
            <button
              aria-label="command-center-action-security-audit"
              className="ghost-button"
              disabled={busyKey !== null}
              onClick={() => void runAction("security-audit", async () => {
                securityAudit.reload();
                const events = await api.getSecurityAudit(8);
                return {
                  tone: "success",
                  title: language === "zh-CN" ? "安全审计已读取" : "Security audit loaded",
                  detail: `${events.length} ${language === "zh-CN" ? "条事件" : "events"}.`,
                };
              })}
              type="button"
            >
              <ShieldCheck size={15} />
              {language === "zh-CN" ? "安全审计" : "Security"}
            </button>
            <button
              aria-label="command-center-action-execution-audit"
              className="ghost-button"
              disabled={busyKey !== null}
              onClick={() => void runAction("execution-audit", async () => {
                executionAudit.reload();
                const events = await api.getBinanceExecutionAudit(8);
                setActiveView("strategyLab");
                return {
                  tone: "success",
                  title: language === "zh-CN" ? "执行审计已读取" : "Execution audit loaded",
                  detail: `${events.length} ${language === "zh-CN" ? "条 Binance 事件" : "Binance events"}.`,
                };
              })}
              type="button"
            >
              <Activity size={15} />
              Binance
            </button>
          </div>
          <div className="command-center-stack">
            {(securityAudit.data ?? []).slice(0, 3).map((event) => (
              <div className="task-item" key={event.event_id}>
                <ShieldCheck size={15} />
                <span>{event.category}: {event.summary}</span>
              </div>
            ))}
          </div>
        </div>

        <div aria-label="command-center-safe-checks" className="card command-center-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{language === "zh-CN" ? "安全检查" : "Safe Checks"}</p>
              <h3>{language === "zh-CN" ? "无密钥本地健康检查" : "No-secret local readiness"}</h3>
            </div>
            <TerminalSquare size={18} />
          </div>
          <button
            aria-label="command-center-action-safe-check"
            className="primary-button full-width-button"
            disabled={busyKey !== null}
            onClick={() =>
              void runAction("safe-check", async () => {
                const [health, routes] = await Promise.all([
                  api.getHealth(),
                  api.getRoutePermissionClassification(),
                ]);
                return {
                  tone: "success",
                  title: language === "zh-CN" ? "安全检查通过" : "Safe check passed",
                  detail: `${health.app_version} / routes=${routes.length}`,
                };
              })
            }
            type="button"
          >
            <CheckCircle2 size={16} />
            {busyKey === "safe-check" ? (language === "zh-CN" ? "检查中" : "Checking") : language === "zh-CN" ? "运行安全检查" : "Run safe check"}
          </button>
          <p className="panel-note">
            {language === "zh-CN"
              ? "这里只读取健康状态和路由权限分类；不会执行任意 shell，也不会提交真实交易。"
              : "This reads health and route classification only; it does not execute arbitrary shell commands or submit live trades."}
          </p>
        </div>
      </section>

      {actionState ? (
        <section className={`card command-center-feedback ${actionState.tone}`}>
          <strong>{actionState.title}</strong>
          <span>{actionState.detail}</span>
        </section>
      ) : null}
    </div>
  );
}
