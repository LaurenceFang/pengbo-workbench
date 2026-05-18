import { ChartCandlestick, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InlineState, MiniTrend, PanelState, formatPrice } from "../components/shared";
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
};

export function WatchlistView({
  watchlist,
  assetUniverse,
  loading,
  error,
  onRetry,
  onSelectAsset,
  onWatchlistChange,
}: WatchlistViewProps) {
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
        .map((symbol) => snapshotMap.get(symbol) ?? snapshotFromSearchResult(universeMap.get(symbol)))
        .filter(Boolean) as WatchlistAssetSnapshot[],
    [localSymbols, snapshotMap, universeMap],
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
      setActionError(error instanceof Error ? error.message : "自选列表更新失败");
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
      await commitSymbols(nextSymbols, `已添加 ${symbol}`, previousSymbols);
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
      await commitSymbols(nextSymbols, `已删除 ${symbol}`, previousSymbols);
    } finally {
      setBusySymbol(null);
    }
  }

  if (loading && displayWatchlist.length === 0) {
    return <PanelState title="自选列表加载中" copy="正在读取本地 watchlist 和可添加资产范围。" />;
  }

  return (
    <div className="watchlist-manager-layout">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Watchlist</p>
            <h3>自选列表</h3>
          </div>
          <span className="mini-pill">{displayWatchlist.length}</span>
        </div>
        {error ? <InlineState label={error} actionLabel="重试" onAction={onRetry} /> : null}
        {actionMessage ? <InlineState label={actionMessage} /> : null}
        {actionError ? <InlineState label={actionError} /> : null}
        <div className="watchlist-page-groups">
          {groupedWatchlist.length === 0 ? (
            <InlineState label="当前没有自选资产，先从右侧添加。" />
          ) : (
            groupedWatchlist.map((group) => (
              <div className="watchlist-page-group" key={group.category.key}>
                <div className="section-header">
                  <span className="section-caption">{group.category.label}</span>
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
                        <div className="watchlist-price">
                          {formatPrice(asset.price, asset.currency, asset.asset_class)}
                        </div>
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
                          {busySymbol === asset.symbol ? "删除中..." : "删除"}
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

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Manage</p>
            <h3>添加自选</h3>
          </div>
        </div>
        <div className="segmented-control asset-category-tabs" aria-label="watchlist-category-tabs">
          {assetCategoryDefinitions.map((category) => (
            <button
              className={selectedCategory === category.key ? "active" : ""}
              key={category.key}
              onClick={() => {
                setSelectedCategory(category.key);
                setSelectedSymbol("");
              }}
              type="button"
            >
              {category.label}
            </button>
          ))}
        </div>
        <p className="panel-note">
          {assetCategoryDefinitions.find((category) => category.key === selectedCategory)?.helper}
        </p>
        <div className="search-box research-search-box">
          <Search size={16} />
          <input
            aria-label="watchlist-candidate-search"
            placeholder="筛选代码 / 名称 / 市场"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="form-grid">
          <label className="field">
            <span>可添加资产</span>
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
                {busySymbol === asset.symbol ? "添加中..." : "添加"}
              </button>
            </div>
          ))}
          {availableCandidates.length === 0 ? <InlineState label="这一类里没有更多可添加资产。" /> : null}
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
            添加所选
          </button>
        </div>
      </section>
    </div>
  );
}

function snapshotFromSearchResult(asset: AssetSearchResult | undefined): WatchlistAssetSnapshot | null {
  if (!asset) {
    return null;
  }
  return {
    ...asset,
    price: 0,
    change: 0,
    change_pct: 0,
    trend: [0, 0, 0, 0, 0, 0],
    summary: "等待本地服务刷新行情快照。",
  };
}
