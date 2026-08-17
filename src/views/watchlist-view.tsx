import { ChartCandlestick, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InlineState, MiniTrend, PanelState, formatPrice } from "../components/shared";
import { useI18n } from "../i18n";
import { Badge, SegmentedControl } from "../components/ui-kit";
import {
  assetCategoryDefinitions,
  assetOptionLabel,
  getAssetCategoryKey,
  groupAssetOptions,
  normalizeAssetOptions,
  type AssetCategoryKey,
} from "../lib/asset-options";
import type { AssetSearchResult, WatchlistAssetSnapshot } from "../lib/api";

type WatchlistViewProps = {
  watchlist: WatchlistAssetSnapshot[];
  assetUniverse: AssetSearchResult[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelectAsset: (symbol: string) => void;
  onWatchlistChange: (symbols: string[]) => Promise<void>;
  routeSection?: WatchlistRouteSection;
};

export type WatchlistRouteSection = "watchlistIndex";

export function WatchlistView({
  watchlist,
  assetUniverse,
  loading,
  error,
  onRetry,
  onSelectAsset,
  onWatchlistChange,
  routeSection = "watchlistIndex",
}: WatchlistViewProps) {
  const i18n = useI18n();
  const copy = watchlistCopy(i18n.language);
  const [selectedCategory, setSelectedCategory] = useState<AssetCategoryKey>("usMarket");
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [query, setQuery] = useState("");
  const [busySymbol, setBusySymbol] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [localSymbols, setLocalSymbols] = useState<string[]>(() => watchlist.map((asset) => asset.symbol));

  useEffect(() => {
    if (busySymbol === null) {
      setLocalSymbols(watchlist.map((asset) => asset.symbol));
    }
  }, [busySymbol, watchlist]);

  const normalizedUniverse = useMemo(() => normalizeAssetOptions(assetUniverse), [assetUniverse]);
  const universeMap = useMemo(
    () => new Map(normalizedUniverse.map((asset) => [asset.symbol, asset] as const)),
    [normalizedUniverse],
  );
  const snapshotMap = useMemo(() => new Map(watchlist.map((asset) => [asset.symbol, asset] as const)), [watchlist]);
  const displayWatchlist = useMemo(
    () =>
      localSymbols
        .map((symbol) => snapshotMap.get(symbol) ?? snapshotFromSearchResult(universeMap.get(symbol), copy.waitingSnapshot))
        .filter(Boolean) as WatchlistAssetSnapshot[],
    [copy.waitingSnapshot, localSymbols, snapshotMap, universeMap],
  );
  const currentSymbols = useMemo(() => new Set(localSymbols), [localSymbols]);
  const availableCandidates = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return normalizedUniverse.filter((asset) => {
      if (currentSymbols.has(asset.symbol) || getAssetCategoryKey(asset) !== selectedCategory) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return `${asset.symbol} ${asset.name} ${asset.market}`.toLowerCase().includes(keyword);
    });
  }, [currentSymbols, normalizedUniverse, query, selectedCategory]);
  const groupedWatchlist = groupAssetOptions(displayWatchlist);
  const activeCandidate =
    availableCandidates.find((asset) => asset.symbol === selectedSymbol) ?? availableCandidates[0] ?? null;

  async function commitSymbols(nextSymbols: string[], successMessage: string, rollbackSymbols: string[]) {
    setLocalSymbols(nextSymbols);
    setActionError(null);
    setActionMessage(null);
    try {
      await onWatchlistChange(nextSymbols);
      setActionMessage(successMessage);
    } catch (error) {
      setLocalSymbols(rollbackSymbols);
      setActionError(error instanceof Error ? error.message : copy.updateFailed);
    }
  }

  async function addSymbol(symbol: string) {
    if (!symbol || currentSymbols.has(symbol)) {
      return;
    }
    const previousSymbols = localSymbols;
    const nextSymbols = [...localSymbols, symbol];
    setBusySymbol(symbol);
    try {
      await commitSymbols(nextSymbols, `${copy.added} ${symbol}`, previousSymbols);
      setSelectedSymbol("");
    } finally {
      setBusySymbol(null);
    }
  }

  async function removeSymbol(symbol: string) {
    if (!currentSymbols.has(symbol)) {
      return;
    }
    const previousSymbols = localSymbols;
    const nextSymbols = localSymbols.filter((item) => item !== symbol);
    setBusySymbol(symbol);
    try {
      await commitSymbols(nextSymbols, `${copy.removed} ${symbol}`, previousSymbols);
    } finally {
      setBusySymbol(null);
    }
  }

  if (loading && displayWatchlist.length === 0) {
    return <PanelState title={copy.loadingTitle} copy={copy.loadingCopy} />;
  }

  return (
    <div
      className="p2-page p2-watchlist-page"
      data-primary-task={routeSection}
      data-watchlist-section={routeSection}
    >
      <header className="p2-page-header">
        <div>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p className="p2-page-description">{copy.description}</p>
        </div>
        <div className="p2-page-header-meta">
          <Badge tone="info">{copy.local}</Badge>
          <span className="p2-header-count">{displayWatchlist.length} {copy.tracked}</span>
        </div>
      </header>

      <div className="watchlist-manager-layout p2-page-sections">
        <section className="card p2-section-card p2-primary-section">
          <div className="card-header">
            <div>
              <p className="eyebrow">{copy.watchlist}</p>
              <h3>{copy.watchlist}</h3>
            </div>
            <span className="mini-pill">{displayWatchlist.length}</span>
          </div>
          {error ? <InlineState label={error} actionLabel={copy.retry} onAction={onRetry} /> : null}
          {actionMessage ? <InlineState label={actionMessage} /> : null}
          {actionError ? <InlineState label={actionError} /> : null}
          <div className="watchlist-page-groups">
            {groupedWatchlist.length === 0 ? (
              <InlineState label={copy.empty} />
            ) : (
              groupedWatchlist.map((group) => (
                <div className="watchlist-page-group" key={group.category.key}>
                  <div className="section-header">
                    <span className="section-caption">{copy.categories[group.category.key].label}</span>
                    <span className="mini-pill">{group.options.length}</span>
                  </div>
                  <div className="watchlist-page-grid">
                    {group.options.map((asset) => (
                      <article className="watchlist-card watchlist-page-card" key={asset.symbol}>
                        <button
                          aria-label={`watchlist-open symbol=${asset.symbol}`}
                          className="watchlist-card-main"
                          onClick={() => onSelectAsset(asset.symbol)}
                          type="button"
                        >
                          <div className="watchlist-head">
                            <div>
                              <strong>{asset.symbol}</strong>
                              <span>{asset.market}</span>
                            </div>
                            <ChartCandlestick size={16} />
                          </div>
                          <div className="watchlist-price">{formatPrice(asset.price, asset.currency, asset.asset_class)}</div>
                          <div className={`delta-pill ${asset.change < 0 ? "down" : "up"}`}>
                            {asset.change_pct.toFixed(2)}%
                          </div>
                          <MiniTrend trend={asset.trend} />
                        </button>
                        <div className="watchlist-card-actions">
                          <button
                            aria-label={`watchlist-remove symbol=${asset.symbol}`}
                            className="ghost-button danger"
                            disabled={busySymbol === asset.symbol}
                            onClick={() => void removeSymbol(asset.symbol)}
                            type="button"
                          >
                            <Trash2 size={16} />
                            {busySymbol === asset.symbol ? copy.removing : copy.remove}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card p2-section-card p2-inspector-section">
          <div className="card-header">
            <div>
              <p className="eyebrow">{copy.manage}</p>
              <h3>{copy.addTitle}</h3>
            </div>
          </div>
          <SegmentedControl
            options={assetCategoryDefinitions.map((category) => ({ value: category.key, label: copy.categories[category.key].label }))}
            value={selectedCategory}
            onChange={(value) => {
              setSelectedCategory(value as AssetCategoryKey);
              setSelectedSymbol("");
            }}
          />
          <p className="panel-note">{copy.categories[selectedCategory].helper}</p>
          <div className="search-box research-search-box">
            <Search size={16} />
            <input
              aria-label="watchlist-candidate-search"
              placeholder={copy.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="form-grid">
            <label className="field">
              <span>{copy.availableAssets}</span>
              <select
                aria-label="watchlist-candidate-select"
                value={activeCandidate?.symbol ?? ""}
                onChange={(event) => setSelectedSymbol(event.target.value)}
              >
                {availableCandidates.map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {assetOptionLabel(asset)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="candidate-list">
            {availableCandidates.slice(0, 8).map((asset) => (
              <div
                aria-label={`watchlist-candidate symbol=${asset.symbol}`}
                className={`variant-card ${activeCandidate?.symbol === asset.symbol ? "selected" : ""}`}
                key={asset.symbol}
              >
                <button className="variant-card-main" onClick={() => setSelectedSymbol(asset.symbol)} type="button">
                  <div className="variant-card-head">
                    <strong>{asset.symbol}</strong>
                    <span className="mini-pill">{asset.market}</span>
                  </div>
                  <p>{asset.name}</p>
                </button>
                <button
                  aria-label={`watchlist-add-option symbol=${asset.symbol}`}
                  className="ghost-button"
                  disabled={busySymbol !== null}
                  onClick={() => void addSymbol(asset.symbol)}
                  type="button"
                >
                  <Plus size={16} />
                  {busySymbol === asset.symbol ? copy.adding : copy.add}
                </button>
              </div>
            ))}
            {availableCandidates.length === 0 ? <InlineState label={copy.noMoreAssets} /> : null}
          </div>
          <div className="form-actions">
            <button
              aria-label={`watchlist-add symbol=${activeCandidate?.symbol ?? "none"}`}
              className="primary-button"
              disabled={!activeCandidate || busySymbol !== null}
              onClick={() => void addSymbol(activeCandidate?.symbol ?? "")}
              type="button"
            >
              <Plus size={16} />
              {copy.addSelected}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function snapshotFromSearchResult(asset: AssetSearchResult | undefined, waitingSnapshot: string): WatchlistAssetSnapshot | null {
  if (!asset) {
    return null;
  }
  return {
    ...asset,
    price: 0,
    change: 0,
    change_pct: 0,
    trend: [0, 0, 0, 0, 0, 0],
    summary: waitingSnapshot,
  };
}

function watchlistCopy(language: "zh-CN" | "en-US") {
  const zh = language === "zh-CN";
  return {
    eyebrow: zh ? "市场 / 自选列表" : "Markets / Watchlist",
    title: zh ? "自选列表工作区" : "Watchlist workspace",
    description: zh ? "维护一组聚焦的本地资产，随时进入研究和交接流程。" : "Keep a focused local set of assets ready for research and handoff.",
    local: zh ? "本地" : "Local",
    tracked: zh ? "项跟踪" : "tracked",
    watchlist: zh ? "自选列表" : "Watchlist",
    manage: zh ? "管理" : "Manage",
    addTitle: zh ? "添加自选" : "Add to watchlist",
    retry: zh ? "重试" : "Retry",
    loadingTitle: zh ? "自选列表加载中" : "Loading watchlist",
    loadingCopy: zh ? "正在读取本地 watchlist 和可添加资产范围。" : "Reading the local watchlist and available assets.",
    empty: zh ? "当前没有自选资产，先从右侧添加。" : "No watchlist assets yet. Add one from the panel on the right.",
    updateFailed: zh ? "自选列表更新失败" : "Failed to update the watchlist.",
    added: zh ? "已添加" : "Added",
    removed: zh ? "已删除" : "Removed",
    removing: zh ? "删除中..." : "Removing...",
    remove: zh ? "删除" : "Remove",
    searchPlaceholder: zh ? "筛选代码 / 名称 / 市场" : "Filter by symbol / name / market",
    availableAssets: zh ? "可添加资产" : "Available assets",
    adding: zh ? "添加中..." : "Adding...",
    add: zh ? "添加" : "Add",
    noMoreAssets: zh ? "这一类里没有更多可添加资产。" : "No more assets are available in this category.",
    addSelected: zh ? "添加所选" : "Add selected",
    waitingSnapshot: zh ? "等待本地服务刷新行情快照。" : "Waiting for the local service to refresh the quote snapshot.",
    categories: {
      usMarket: { label: zh ? "美股 / ETF" : "US stocks / ETFs", helper: zh ? "美股大盘股、ETF 与常用市场基准" : "US large caps, ETFs, and common market benchmarks" },
      leveragedNasdaq: { label: zh ? "三倍做多纳指" : "3x Nasdaq long", helper: zh ? "纳斯达克 100 三倍做多工具" : "3x long Nasdaq-100 instrument" },
      crypto: { label: zh ? "加密货币" : "Crypto", helper: zh ? "Binance 加密货币现货交易对" : "Binance crypto spot pairs" },
    },
  };
}
