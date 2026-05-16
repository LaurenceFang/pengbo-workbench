import { ChartCandlestick, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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

  const normalizedUniverse = useMemo(() => normalizeAssetOptions(assetUniverse), [assetUniverse]);
  const currentSymbols = useMemo(() => new Set(watchlist.map((asset) => asset.symbol)), [watchlist]);
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
  const groupedWatchlist = groupAssetOptions(watchlist);
  const activeCandidate =
    availableCandidates.find((asset) => asset.symbol === selectedSymbol) ?? availableCandidates[0] ?? null;

  async function addSymbol(symbol: string) {
    if (!symbol) {
      return;
    }
    setBusySymbol(symbol);
    setActionError(null);
    try {
      await onWatchlistChange([...watchlist.map((asset) => asset.symbol), symbol]);
      setSelectedSymbol("");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "添加自选失败");
    } finally {
      setBusySymbol(null);
    }
  }

  async function removeSymbol(symbol: string) {
    setBusySymbol(symbol);
    setActionError(null);
    try {
      await onWatchlistChange(watchlist.map((asset) => asset.symbol).filter((item) => item !== symbol));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "移除自选失败");
    } finally {
      setBusySymbol(null);
    }
  }

  if (loading && watchlist.length === 0) {
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
          <span className="mini-pill">{watchlist.length}</span>
        </div>
        {error ? <InlineState label={error} actionLabel="重试" onAction={onRetry} /> : null}
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
                      <button
                        aria-label={`watchlist-remove symbol=${asset.symbol}`}
                        className="icon-button danger"
                        disabled={busySymbol === asset.symbol}
                        onClick={() => void removeSymbol(asset.symbol)}
                        type="button"
                      >
                        <Trash2 size={16} />
                      </button>
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
            <button
              aria-label={`watchlist-candidate symbol=${asset.symbol}`}
              className={`variant-card ${activeCandidate?.symbol === asset.symbol ? "selected" : ""}`}
              key={asset.symbol}
              onClick={() => setSelectedSymbol(asset.symbol)}
              type="button"
            >
              <div className="variant-card-head">
                <strong>{asset.symbol}</strong>
                <span className="mini-pill">{asset.market}</span>
              </div>
              <p>{asset.name}</p>
            </button>
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
            添加
          </button>
        </div>
        {actionError ? <InlineState label={actionError} /> : null}
      </section>
    </div>
  );
}
