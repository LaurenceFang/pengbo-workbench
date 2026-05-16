import type { AssetSearchResult, WatchlistAssetSnapshot } from "./api";

export type AssetOption = Pick<
  AssetSearchResult,
  "symbol" | "name" | "market" | "asset_class" | "currency" | "provider"
>;

export type AssetCategoryKey = "usMarket" | "leveragedNasdaq" | "crypto";

export const assetCategoryDefinitions: Array<{
  key: AssetCategoryKey;
  label: string;
  helper: string;
}> = [
  {
    key: "usMarket",
    label: "美股 / ETF",
    helper: "美股大盘股、ETF 与常用市场基准",
  },
  {
    key: "leveragedNasdaq",
    label: "三倍做多纳指",
    helper: "纳斯达克 100 三倍做多工具",
  },
  {
    key: "crypto",
    label: "加密货币",
    helper: "Binance 加密货币现货交易对",
  },
];

const categoryOrder = new Map(assetCategoryDefinitions.map((item, index) => [item.key, index]));

export function getAssetCategoryKey(asset: AssetOption): AssetCategoryKey {
  if (asset.symbol === "TQQQ") {
    return "leveragedNasdaq";
  }
  if (asset.asset_class === "crypto") {
    return "crypto";
  }
  return "usMarket";
}

export function getAssetCategoryLabel(asset: AssetOption): string {
  const key = getAssetCategoryKey(asset);
  return assetCategoryDefinitions.find((item) => item.key === key)?.label ?? key;
}

export function assetOptionLabel(asset: AssetOption): string {
  return `${asset.symbol} - ${asset.name}`;
}

export function normalizeAssetOptions<T extends AssetOption>(assets: T[]): T[] {
  const unique = new Map<string, T>();
  for (const asset of assets) {
    if (asset.asset_class === "macro") {
      continue;
    }
    unique.set(asset.symbol, asset);
  }
  return Array.from(unique.values()).sort((left, right) => {
    const leftCategory = categoryOrder.get(getAssetCategoryKey(left)) ?? 99;
    const rightCategory = categoryOrder.get(getAssetCategoryKey(right)) ?? 99;
    if (leftCategory !== rightCategory) {
      return leftCategory - rightCategory;
    }
    return left.symbol.localeCompare(right.symbol);
  });
}

export function groupAssetOptions<T extends AssetOption>(assets: T[]): Array<{
  category: (typeof assetCategoryDefinitions)[number];
  options: T[];
}> {
  const normalized = normalizeAssetOptions(assets);
  return assetCategoryDefinitions
    .map((category) => ({
      category,
      options: normalized.filter((asset) => getAssetCategoryKey(asset) === category.key),
    }))
    .filter((group) => group.options.length > 0);
}

export function watchlistToAssetOptions(assets: WatchlistAssetSnapshot[]): AssetOption[] {
  return assets.map(({ symbol, name, market, asset_class, currency, provider }) => ({
    symbol,
    name,
    market,
    asset_class,
    currency,
    provider,
  }));
}
