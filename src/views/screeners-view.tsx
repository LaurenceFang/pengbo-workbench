import { Check, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InlineState, MetricCard, PanelState, formatPercent, formatPrice } from "../components/shared";
import { Badge, InspectorPanel, Input } from "../components/ui-kit";
import { useAsyncResource } from "../hooks/use-async-resource";
import { usePengboNavigation } from "../hooks/use-pengbo-navigation";
import { useRouteContext } from "../routes/route-context";
import {
  api,
  type ScreenerPreset,
  type ScreenerPresetVariant,
  type ScreenerRunResult,
  type ScreenerScoreLabel,
  type ScreenerTuningLevel,
  type ScreenerUniverseSource,
} from "../lib/api";
import { useAppStore } from "../store/app-store";

export type ScreenerRouteSection =
  | "screenerCatalog"
  | "screenerVariant"
  | "screenerTuning"
  | "screenerUniverse";

type ScreenersViewProps = {
  onGlobalRefresh: () => Promise<void>;
  routeSection?: ScreenerRouteSection;
};

type TuningFieldConfig = {
  key: string;
  label: string;
  helper: string;
  levels: Record<ScreenerTuningLevel, string>;
};

const LEVELS: ScreenerTuningLevel[] = ["low", "medium", "high"];

type ScreenerCopy = {
  eyebrow: string;
  preset: string;
  variant: string;
  control: string;
  selectPreset: string;
  variantHeading: string;
  controlHeading: string;
  resultHeading: string;
  resultBinding: string;
  universe: string;
  presetMetric: string;
  variantMetric: string;
  research: string;
  quality: string;
  completeness: string;
  rank: string;
  score: string;
  notAvailable: string;
  unknown: string;
  loadingPresets: string;
  loadingVariants: string;
  retry: string;
  noPresets: string;
  noVariants: string;
  noVariant: string;
  statusRunning: string;
  statusFailed: string;
  statusCompleted: string;
  statusPending: string;
  researchOnly: string;
  runCurrent: string;
  save: string;
  saveChanges: string;
  activate: string;
  active: string;
  delete: string;
  openResearch: string;
  cache: string;
  observed: string;
  noRunTitle: string;
  noRunCopy: string;
  bindingNote: string;
  pageTitle: string;
  create: string;
  creating: string;
  activeVariant: string;
  systemDefault: string;
  custom: string;
  recentHits: string;
  crypto: string;
  equities: string;
  runScope: string;
  expanded: string;
  catalog: string;
  configName: string;
  configDescription: string;
  readOnlyNote: string;
  summary: string;
  evaluated: string;
  hitScore: string;
  explanation: string;
  matchedBy: string;
  missingMetrics: string;
  keyMetrics: string;
  noExplanation: string;
  none: string;
  factorEvidence: string;
  source: string;
  cached: string;
  realtime: string;
  notes: string;
  createFailed: string;
  saveFailed: string;
  activateFailed: string;
  deleteFailed: string;
  runFailed: string;
  readOnlyError: string;
};

const SCREENER_COPY: Record<"zh-CN" | "en-US", ScreenerCopy> = {
  "zh-CN": {
    eyebrow: "筛选器",
    preset: "预设",
    variant: "变体",
    control: "控制",
    selectPreset: "选择策略预设",
    variantHeading: "新建、选择或删除变体",
    controlHeading: "当前配置与运行参数",
    resultHeading: "结果",
    resultBinding: "结果会绑定到当前预设 + 变体 + 范围",
    universe: "范围",
    presetMetric: "预设",
    variantMetric: "变体",
    research: "研究",
    quality: "质量",
    completeness: "完整度",
    rank: "排名",
    score: "评分",
    notAvailable: "暂无",
    unknown: "未知",
    loadingPresets: "正在加载筛选器预设...",
    loadingVariants: "正在加载变体...",
    retry: "重试",
    noPresets: "暂无可用筛选预设。请先刷新本地数据服务。",
    noVariants: "暂无可用变体。可以从当前预设新建一个自定义配置。",
    noVariant: "当前预设还没有可用变体。",
    statusRunning: "运行中",
    statusFailed: "失败",
    statusCompleted: "已完成",
    statusPending: "待运行",
    researchOnly: "仅研究",
    runCurrent: "运行当前配置",
    save: "保存配置",
    saveChanges: "保存配置更改",
    activate: "设为活动配置",
    active: "已是活动配置",
    delete: "删除自定义配置",
    openResearch: "打开研究",
    cache: "缓存",
    observed: "已观测",
    noRunTitle: "还没有运行结果",
    noRunCopy: "选择一个预设和变体后运行，页面会显示范围规模、命中数、评分排序、解释和缺失指标。",
    bindingNote: "运行结果始终绑定预设、变体和范围。",
    pageTitle: "固定预设 + 显式变体管理",
    create: "新建",
    creating: "新建中...",
    activeVariant: "当前活动",
    systemDefault: "系统默认",
    custom: "自定义",
    recentHits: "最近命中",
    crypto: "加密",
    equities: "股票",
    runScope: "运行范围",
    expanded: "受控扩容",
    catalog: "稳定目录回退",
    configName: "配置名称",
    configDescription: "配置说明",
    readOnlyNote: "系统默认配置只读；请先新建自定义变体，再调整下方选项。",
    summary: "当前配置摘要",
    evaluated: "已评估",
    hitScore: "高/中评分",
    explanation: "解释",
    matchedBy: "命中依据",
    missingMetrics: "缺失指标",
    keyMetrics: "关键指标",
    noExplanation: "暂无足够解释。",
    none: "无",
    factorEvidence: "因子证据",
    source: "来源",
    cached: "缓存数据",
    realtime: "实时数据",
    notes: "备注",
    createFailed: "创建自定义配置失败。",
    saveFailed: "保存配置失败。",
    activateFailed: "激活配置失败。",
    deleteFailed: "删除配置失败。",
    runFailed: "运行筛选器失败。",
    readOnlyError: "系统默认配置只读。请先新建自定义变体，再调整这些选项。",
  },
  "en-US": {
    eyebrow: "Screeners",
    preset: "Preset",
    variant: "Variant",
    control: "Control",
    selectPreset: "Select a strategy preset",
    variantHeading: "Create, select, or delete a variant",
    controlHeading: "Current configuration and run parameters",
    resultHeading: "Results",
    resultBinding: "Results are bound to the current preset + variant + universe",
    universe: "Universe",
    presetMetric: "Preset",
    variantMetric: "Variant",
    research: "Research",
    quality: "Quality",
    completeness: "completeness",
    rank: "rank",
    score: "score",
    notAvailable: "n/a",
    unknown: "unknown",
    loadingPresets: "Loading screener presets...",
    loadingVariants: "Loading variants...",
    retry: "Retry",
    noPresets: "No screener presets are available. Refresh the local service first.",
    noVariants: "No variants are available. Create a custom configuration from the current preset.",
    noVariant: "No usable variant is available for the current preset.",
    statusRunning: "Running",
    statusFailed: "Failed",
    statusCompleted: "Completed",
    statusPending: "Pending",
    researchOnly: "research-only",
    runCurrent: "Run current configuration",
    save: "Save configuration",
    saveChanges: "Save configuration changes",
    activate: "Set active configuration",
    active: "Already active",
    delete: "Delete custom configuration",
    openResearch: "Open Research",
    cache: "Cached",
    observed: "Observed",
    noRunTitle: "No run result yet",
    noRunCopy: "Select a preset and variant to show universe size, hit count, score ranking, explanations, and missing metrics.",
    bindingNote: "Run results are always bound to the selected preset, variant, and universe.",
    pageTitle: "Fixed presets + explicit variant management",
    create: "Create",
    creating: "Creating...",
    activeVariant: "Active",
    systemDefault: "System default",
    custom: "Custom",
    recentHits: "Recent hits",
    crypto: "Crypto",
    equities: "Equities",
    runScope: "Run scope",
    expanded: "Controlled expansion",
    catalog: "Stable catalog fallback",
    configName: "Configuration name",
    configDescription: "Configuration description",
    readOnlyNote: "System defaults are read-only; create a custom variant before adjusting these options.",
    summary: "Current configuration summary",
    evaluated: "Evaluated",
    hitScore: "High / medium score",
    explanation: "Explanation",
    matchedBy: "Matched by",
    missingMetrics: "Missing metrics",
    keyMetrics: "Key metrics",
    noExplanation: "Not enough explanation was returned.",
    none: "None",
    factorEvidence: "Factor evidence",
    source: "Source",
    cached: "Cached data",
    realtime: "Live data",
    notes: "Notes",
    createFailed: "Failed to create the custom configuration.",
    saveFailed: "Failed to save the configuration.",
    activateFailed: "Failed to activate the configuration.",
    deleteFailed: "Failed to delete the configuration.",
    runFailed: "Failed to run the screener.",
    readOnlyError: "System defaults are read-only. Create a custom variant before adjusting these options.",
  },
};

const TUNING_CONFIG: Record<string, TuningFieldConfig[]> = {
  "quality-equities": [
    {
      key: "quality_floor",
      label: "质量门槛",
      helper: "控制利润率与 ROE 的严格程度。",
      levels: { low: "宽松", medium: "标准", high: "严格" },
    },
    {
      key: "trend_requirement",
      label: "趋势要求",
      helper: "控制 30 日趋势与回撤的容忍区间。",
      levels: { low: "早期", medium: "标准", high: "确认" },
    },
    {
      key: "size_bias",
      label: "市值偏好",
      helper: "控制更偏大盘还是更偏超大盘龙头。",
      levels: { low: "广谱", medium: "标准", high: "龙头" },
    },
  ],
  "growth-rebound": [
    {
      key: "rebound_strength",
      label: "反弹强度",
      helper: "控制对反弹确认力度的要求。",
      levels: { low: "抢先", medium: "标准", high: "确认" },
    },
    {
      key: "pullback_window",
      label: "回撤窗口",
      helper: "控制对回撤深度和修复区间的偏好。",
      levels: { low: "偏浅", medium: "标准", high: "偏深" },
    },
    {
      key: "quality_guardrail",
      label: "基本面护栏",
      helper: "控制对利润率和比率覆盖的要求。",
      levels: { low: "宽松", medium: "标准", high: "严格" },
    },
  ],
  "trend-crypto": [
    {
      key: "momentum_bias",
      label: "动量偏好",
      helper: "控制趋势币对 24H / 7D / 30D 的确认要求。",
      levels: { low: "抢先", medium: "标准", high: "强势" },
    },
    {
      key: "liquidity_floor",
      label: "流动性门槛",
      helper: "控制最低成交深度要求。",
      levels: { low: "放宽", medium: "标准", high: "主流" },
    },
    {
      key: "volatility_tolerance",
      label: "波动容忍",
      helper: "控制对高波动趋势币的接受程度。",
      levels: { low: "保守", medium: "标准", high: "积极" },
    },
  ],
  "majors-crypto": [
    {
      key: "liquidity_bias",
      label: "流动性偏好",
      helper: "控制更偏广义主流还是超深流动性龙头。",
      levels: { low: "广谱", medium: "标准", high: "龙头" },
    },
    {
      key: "trend_requirement",
      label: "趋势要求",
      helper: "控制对持续走强的要求。",
      levels: { low: "宽松", medium: "标准", high: "强势" },
    },
    {
      key: "exhaustion_guardrail",
      label: "过热护栏",
      helper: "控制对极端单日波动和高波动币的回避力度。",
      levels: { low: "宽松", medium: "标准", high: "严格" },
    },
  ],
};

function getUniverseSummary(universeSource: ScreenerUniverseSource, assetType: string, copy: ScreenerCopy): string {
  if (copy === SCREENER_COPY["en-US"]) {
    if (universeSource === "expanded") {
      return assetType === "crypto" ? "Scope: controlled Binance major-coin pool" : "Scope: controlled equity + ETF pool";
    }
    return assetType === "crypto" ? "Scope: searchable crypto catalog" : "Scope: searchable equity catalog";
  }
  if (universeSource === "expanded") {
    return assetType === "crypto" ? "范围：受控扩容 Binance 主流币池" : "范围：受控扩容股票 + ETF 池";
  }
  return assetType === "crypto" ? "范围：当前可搜索加密目录" : "范围：当前可搜索股票目录";
}

function getScoreLabelText(scoreLabel: ScreenerScoreLabel, copy: ScreenerCopy): string {
  if (scoreLabel === "high") {
    return copy === SCREENER_COPY["en-US"] ? "High" : "高分";
  }
  if (scoreLabel === "medium") {
    return copy === SCREENER_COPY["en-US"] ? "Medium" : "中分";
  }
  return copy === SCREENER_COPY["en-US"] ? "Watch" : "观察";
}

function getVariantDraftName(preset: ScreenerPreset, variants: ScreenerPresetVariant[], copy: ScreenerCopy): string {
  const customCount = variants.filter((item) => !item.is_system_default).length;
  return copy === SCREENER_COPY["en-US"] ? `${preset.title} Custom ${customCount + 1}` : `${preset.title} 自定义 ${customCount + 1}`;
}

function getScreenerSummaryAutomationName(variantKey: string, index: number): string {
  return `screener-summary variant=${variantKey} index=${index}`;
}

function formatMetricHighlights(item: ScreenerRunResult, copy: ScreenerCopy): string {
  const parts: string[] = [];
  if (typeof item.metrics.market_cap === "string") {
    parts.push(`${copy === SCREENER_COPY["en-US"] ? "Market cap" : "市值"} ${item.metrics.market_cap}`);
  }
  if (typeof item.metrics.thirty_day_change_pct === "number") {
    parts.push(`30D ${formatPercent(item.metrics.thirty_day_change_pct)}`);
  }
  if (typeof item.metrics.seven_day_change_pct === "number") {
    parts.push(`7D ${formatPercent(item.metrics.seven_day_change_pct)}`);
  }
  if (typeof item.metrics.volatility_pct === "number") {
    parts.push(`${copy === SCREENER_COPY["en-US"] ? "Volatility" : "波动"} ${item.metrics.volatility_pct.toFixed(1)}%`);
  }
  if (typeof item.metrics.avg_volume === "number") {
    const label = copy === SCREENER_COPY["en-US"]
      ? item.asset_class === "crypto" ? "Average daily value" : "Average daily volume"
      : item.asset_class === "crypto" ? "日均成交额" : "日均成交量";
    parts.push(`${label} ${item.metrics.avg_volume.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`);
  }
  return parts.join(" / ");
}

function tuningSummary(variant: ScreenerPresetVariant, fields: TuningFieldConfig[], draft: Record<string, ScreenerTuningLevel>) {
  if (fields.length === 0) {
    return variant.filters;
  }
  return fields.map((field) => `${field.label}: ${field.levels[draft[field.key] ?? variant.tuning[field.key] ?? "medium"]}`);
}

function sameTuning(left: Record<string, ScreenerTuningLevel>, right: Record<string, ScreenerTuningLevel>): boolean {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (left[key] !== right[key]) {
      return false;
    }
  }
  return true;
}

export function ScreenersView({ onGlobalRefresh, routeSection }: ScreenersViewProps) {
  const language = useAppStore((state) => state.language);
  const copy = SCREENER_COPY[language];
  const { params } = useRouteContext();
  const selectedAssetId = useAppStore((state) => state.selectedAssetId);
  const { openRoute, openView: setActiveView } = usePengboNavigation();
  const setSelectedAssetId = useAppStore((state) => state.setSelectedAssetId);
  const setSelectedResearchBriefId = useAppStore((state) => state.setSelectedResearchBriefId);
  const setPendingResearchSource = useAppStore((state) => state.setPendingResearchSource);
  const selectedKey = useAppStore((state) => state.selectedScreenerPresetKey);
  const setSelectedKey = useAppStore((state) => state.setSelectedScreenerPresetKey);
  const selectedVariantKey = useAppStore((state) => state.selectedScreenerVariantKey);
  const setSelectedVariantKey = useAppStore((state) => state.setSelectedScreenerVariantKey);
  const universeSource = useAppStore((state) => state.selectedScreenerUniverseSource);
  const setUniverseSource = useAppStore((state) => state.setSelectedScreenerUniverseSource);
  const runResult = useAppStore((state) => state.lastScreenerRunResult);
  const setRunResult = useAppStore((state) => state.setLastScreenerRunResult);

  const needsScreenerPresets = routeSection === undefined || routeSection === "screenerCatalog" || routeSection === "screenerVariant" || routeSection === "screenerTuning" || routeSection === "screenerUniverse";
  const needsScreenerVariants = routeSection === undefined || routeSection === "screenerVariant" || routeSection === "screenerTuning";
  const presets = useAsyncResource<ScreenerPreset[]>(async () => api.getScreenerPresets(), [], { enabled: needsScreenerPresets });
  const [variantName, setVariantName] = useState("");
  const [variantDescription, setVariantDescription] = useState("");
  const [tuningDraft, setTuningDraft] = useState<Record<string, ScreenerTuningLevel>>({});
  const [pendingSelectedVariantKey, setPendingSelectedVariantKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "save" | "activate" | "delete" | "run" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => presets.data?.find((item) => item.key === (params.presetKey ?? selectedKey)) ?? presets.data?.find((item) => item.key === selectedKey) ?? presets.data?.[0] ?? null,
    [params.presetKey, presets.data, selectedKey],
  );
  const variants = useAsyncResource<ScreenerPresetVariant[]>(
    async () => (selectedPreset ? api.getScreenerPresetVariants(selectedPreset.key) : []),
    [selectedPreset?.key],
    { enabled: needsScreenerVariants && selectedPreset !== null },
  );
  const selectedVariant = useMemo(
    () => variants.data?.find((item) => item.variant_key === (params.variantKey ?? selectedVariantKey)) ?? variants.data?.find((item) => item.variant_key === selectedVariantKey) ?? variants.data?.[0] ?? null,
    [params.variantKey, variants.data, selectedVariantKey],
  );
  const tuningFields = selectedPreset ? TUNING_CONFIG[selectedPreset.key] ?? [] : [];
  const isEditableVariant = selectedVariant ? !selectedVariant.is_system_default : false;
  const hasUnsavedTuning = selectedVariant ? !sameTuning(tuningDraft, selectedVariant.tuning) : false;
  const selectedResult = useMemo(
    () => runResult?.results.find((item) => item.symbol === selectedAssetId) ?? runResult?.results[0] ?? null,
    [runResult, selectedAssetId],
  );

  useEffect(() => {
    if (!presets.data || presets.data.length === 0) {
      return;
    }
    if (params.presetKey && presets.data.some((item) => item.key === params.presetKey)) {
      if (selectedKey !== params.presetKey) setSelectedKey(params.presetKey);
      return;
    }
    if (!selectedKey || !presets.data.some((item) => item.key === selectedKey)) {
      setSelectedKey(presets.data[0].key);
    }
  }, [params.presetKey, presets.data, selectedKey, setSelectedKey]);

  useEffect(() => {
    if (variants.loading) {
      return;
    }
    if (!variants.data || variants.data.length === 0) {
      return;
    }
    if (params.variantKey && variants.data.some((item) => item.variant_key === params.variantKey)) {
      if (selectedVariantKey !== params.variantKey) setSelectedVariantKey(params.variantKey);
      setPendingSelectedVariantKey(null);
      return;
    }
    if (variants.data.some((item) => item.variant_key === selectedVariantKey)) {
      setPendingSelectedVariantKey(null);
      return;
    }
    if (pendingSelectedVariantKey && selectedVariantKey === pendingSelectedVariantKey) {
      return;
    }
    const nextVariant = variants.data.find((item) => item.is_active) ?? variants.data[0];
    setSelectedVariantKey(nextVariant.variant_key);
  }, [params.variantKey, pendingSelectedVariantKey, variants.data, variants.loading, selectedVariantKey, setSelectedVariantKey]);

  useEffect(() => {
    if (!selectedVariant) {
      return;
    }
    setVariantName(selectedVariant.name);
    setVariantDescription(selectedVariant.description);
    setTuningDraft(selectedVariant.tuning);
    setActionError(null);
  }, [selectedVariant?.variant_key]);

  async function reloadPresetData(nextSelectedVariantKey?: string) {
    if (nextSelectedVariantKey) {
      setPendingSelectedVariantKey(nextSelectedVariantKey);
      setSelectedVariantKey(nextSelectedVariantKey);
    }
    await Promise.all([presets.reload(), variants.reload(), onGlobalRefresh()]);
  }

  function navigateToScreenerVariant(variantKey: string) {
    if (!selectedPreset || (routeSection !== "screenerVariant" && routeSection !== "screenerTuning")) return;
    const route = routeSection === "screenerTuning"
      ? "/automation/screeners/:presetKey/variants/:variantKey/tuning"
      : "/automation/screeners/:presetKey/variants/:variantKey";
    openRoute(route, { params: { presetKey: selectedPreset.key, variantKey }, replace: true });
  }

  async function handleCreateVariant() {
    if (!selectedPreset || !variants.data) {
      return;
    }
    setBusy("create");
    setActionError(null);
    try {
      const created = await api.createScreenerPresetVariant(selectedPreset.key, {
        name: getVariantDraftName(selectedPreset, variants.data, copy),
        description: selectedVariant
          ? language === "en-US"
            ? `Custom configuration copied from ${selectedVariant.name}.`
            : `从 ${selectedVariant.name} 复制的新自定义配置。`
          : undefined,
      });
      const copied = selectedVariant
        ? await api.updateScreenerPresetVariant(selectedPreset.key, created.variant_key, {
            name: created.name,
            description: created.description,
            tuning: selectedVariant.tuning,
          })
        : created;
      await reloadPresetData(copied.variant_key);
      navigateToScreenerVariant(copied.variant_key);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.createFailed);
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveVariant() {
    if (!selectedPreset || !selectedVariant || !isEditableVariant) {
      return;
    }
    setBusy("save");
    setActionError(null);
    try {
      const updated = await api.updateScreenerPresetVariant(selectedPreset.key, selectedVariant.variant_key, {
        name: variantName.trim(),
        description: variantDescription.trim(),
        tuning: tuningDraft,
      });
      await reloadPresetData(updated.variant_key);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.saveFailed);
    } finally {
      setBusy(null);
    }
  }

  async function handleActivateVariant() {
    if (!selectedPreset || !selectedVariant) {
      return;
    }
    setBusy("activate");
    setActionError(null);
    try {
      await api.activateScreenerPresetVariant(selectedPreset.key, selectedVariant.variant_key);
      await reloadPresetData(selectedVariant.variant_key);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.activateFailed);
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteVariant() {
    if (!selectedPreset || !selectedVariant || !isEditableVariant) {
      return;
    }
    if (
      !window.confirm(
        language === "en-US"
          ? `Delete “${selectedVariant.name}”? The default configuration will be restored.`
          : `确认删除“${selectedVariant.name}”吗？删除后会回到默认配置。`,
      )
    ) {
      return;
    }
    setBusy("delete");
    setActionError(null);
    try {
      await api.deleteScreenerPresetVariant(selectedPreset.key, selectedVariant.variant_key);
      if (runResult?.variant_key === selectedVariant.variant_key) {
        setRunResult(null);
      }
      await reloadPresetData();
      navigateToScreenerVariant("default");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.deleteFailed);
    } finally {
      setBusy(null);
    }
  }

  async function handleRun() {
    if (!selectedPreset || !selectedVariant) {
      return;
    }
    setBusy("run");
    setActionError(null);
    try {
      if (isEditableVariant && hasUnsavedTuning) {
        await api.updateScreenerPresetVariant(selectedPreset.key, selectedVariant.variant_key, {
          name: variantName.trim(),
          description: variantDescription.trim(),
          tuning: tuningDraft,
        });
      }
      const result = await api.runScreener({
        preset: selectedPreset.key,
        asset_type: selectedPreset.asset_type,
        universeSource,
        variantKey: selectedVariant.variant_key,
      });
      setRunResult(result);
      await reloadPresetData(selectedVariant.variant_key);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : copy.runFailed);
    } finally {
      setBusy(null);
    }
  }

  function handleTuningSelect(fieldKey: string, level: ScreenerTuningLevel) {
    if (!selectedVariant) {
      return;
    }
    if (!isEditableVariant) {
      setActionError(copy.readOnlyError);
      return;
    }
    setTuningDraft((current) => ({ ...current, [fieldKey]: level }));
    setActionError(null);
  }

  function openResearch(symbol: string) {
    if (!selectedPreset || !selectedVariant) {
      return;
    }
    setSelectedAssetId(symbol);
    setSelectedResearchBriefId(null);
    setPendingResearchSource({
      sourcePresetKey: selectedPreset.key,
      sourceVariantKey: selectedVariant.variant_key,
      sourceUniverseSource: universeSource,
    });
    setActiveView("research");
  }

  return (
    <div
      aria-label={`screeners-view preset=${selectedPreset?.key ?? "none"} selected-variant=${selectedVariant?.variant_key ?? "none"}`}
      className="stack-layout p3-page"
      data-route-id="/automation/screeners"
      data-context-inspector="screener-result"
      data-screener-section={routeSection ?? "legacy"}
    >
      <section className="card">
        <div className="card-header p3-page-header">
          <div>
            <p className="eyebrow">筛选器</p>
            <h3>{copy.pageTitle}</h3>
          </div>
          <div className="p3-status-cluster">
          <Badge tone={busy === "run" ? "info" : actionError ? "danger" : runResult ? "success" : "neutral"}>
            {busy === "run" ? copy.statusRunning : actionError ? copy.statusFailed : runResult ? copy.statusCompleted : copy.statusPending}
          </Badge>
          <span className="mini-pill accent">
            {getUniverseSummary(universeSource, selectedPreset?.asset_type ?? "equity", copy)}
          </span>
          </div>
        </div>

        {presets.loading && !selectedPreset ? <InlineState label={copy.loadingPresets} /> : null}
        {presets.error && !selectedPreset ? <InlineState label={presets.error} actionLabel={copy.retry} onAction={presets.reload} /> : null}
        {!selectedPreset && routeSection === "screenerCatalog" ? <div data-primary-task="screenerCatalog"><PanelState state="empty" title={copy.noPresets} copy={copy.loadingPresets} /></div> : null}
        {!selectedPreset && routeSection === "screenerVariant" ? <div data-primary-task="screenerVariant"><PanelState state="empty" title={copy.noPresets} copy={copy.loadingPresets} /></div> : null}
        {!selectedPreset && routeSection === "screenerTuning" ? <div data-primary-task="screenerTuning"><PanelState state="empty" title={copy.noPresets} copy={copy.loadingPresets} /></div> : null}
        {!selectedPreset && routeSection === "screenerUniverse" ? <div data-primary-task="screenerUniverse"><PanelState state="empty" title={copy.noPresets} copy={copy.loadingPresets} /></div> : null}

        {selectedPreset ? (
          <div className="screeners-workspace">
            {routeSection === undefined || routeSection === "screenerCatalog" ? <div className="screeners-column" data-primary-task="screenerCatalog">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">{copy.preset}</p>
                  <strong>{copy.selectPreset}</strong>
                </div>
                <span className="mini-pill">{presets.data?.length ?? 0}</span>
              </div>
              <div className="screeners-preset-grid">
                {(presets.data ?? []).length > 0 ? (presets.data ?? []).map((preset) => (
                  <button
                    aria-label={`screener-preset key=${preset.key} selected=${String(
                      preset.key === selectedPreset.key,
                    )} active-variant=${preset.active_variant_key ?? "none"}`}
                    key={preset.key}
                    className={`preset-card selectable ${preset.key === selectedPreset.key ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedKey(preset.key);
                      if (routeSection === "screenerCatalog") openRoute("/automation/screeners/:presetKey/variants/:variantKey", { params: { presetKey: preset.key, variantKey: preset.active_variant_key ?? "default" } });
                    }}
                    type="button"
                  >
                    <div className="preset-head">
                      <span className="mini-pill">{preset.badge}</span>
                      <strong>{preset.title}</strong>
                    </div>
                    <p>{preset.description}</p>
                    <div className="variant-badge-row">
                    <span className="mini-pill">{preset.active_variant_name ?? copy.notAvailable}</span>
                    <small>{copy.recentHits} {preset.hit_count}</small>
                    </div>
                  </button>
                )) : <InlineState label={copy.noPresets} actionLabel={copy.retry} onAction={presets.reload} />}
              </div>
            </div> : null}

            {routeSection === undefined || routeSection === "screenerVariant" ? <div className="screeners-column" data-primary-task="screenerVariant">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">{copy.variant}</p>
                  <strong>{copy.variantHeading}</strong>
                </div>
                <button
                  aria-label="screener-variant-create"
                  className="ghost-button"
                  disabled={busy === "create"}
                  onClick={handleCreateVariant}
                  type="button"
                >
                  <Plus size={16} />
                  {busy === "create" ? copy.creating : copy.create}
                </button>
              </div>

              {variants.loading && !selectedVariant ? <InlineState label={copy.loadingVariants} /> : null}
              {variants.error && !selectedVariant ? (
                <InlineState label={variants.error} actionLabel={copy.retry} onAction={variants.reload} />
              ) : null}

              <div className="screeners-variant-list">
                {(variants.data ?? []).length > 0 ? (variants.data ?? []).map((variant) => (
                  <button
                    aria-label={`screener-variant key=${variant.variant_key} selected=${String(
                      variant.variant_key === selectedVariant?.variant_key,
                    )} active=${String(variant.is_active)} system=${String(variant.is_system_default)}`}
                    key={variant.variant_key}
                    className={`variant-card ${variant.variant_key === selectedVariant?.variant_key ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedVariantKey(variant.variant_key);
                      navigateToScreenerVariant(variant.variant_key);
                    }}
                    type="button"
                  >
                    <div className="variant-card-head">
                      <strong>{variant.name}</strong>
                      {variant.is_active ? <span className="mini-pill accent">{copy.activeVariant}</span> : null}
                    </div>
                    <p>{variant.description}</p>
                    <div className="variant-badge-row">
                      <span className="mini-pill">{variant.is_system_default ? copy.systemDefault : copy.custom}</span>
                      <small>{copy.recentHits} {variant.last_hit_count}</small>
                    </div>
                  </button>
                )) : <InlineState label={copy.noVariants} actionLabel={copy.retry} onAction={variants.reload} />}
              </div>
            </div> : null}

            {routeSection === undefined || routeSection === "screenerTuning" ? <div className="screeners-column" data-primary-task="screenerTuning">
              {selectedVariant ? (
                <>
                  <div className="screeners-column-head">
                    <div>
                      <p className="eyebrow">{copy.control}</p>
                      <strong>{copy.controlHeading}</strong>
                    </div>
                  <span className="mini-pill">{selectedPreset.asset_type === "crypto" ? copy.crypto : copy.equities}</span>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                        <span>{copy.runScope}</span>
                      <select
                        value={universeSource}
                        onChange={(event) => setUniverseSource(event.target.value as ScreenerUniverseSource)}
                      >
                        <option value="expanded">{copy.expanded}</option>
                        <option value="catalog">{copy.catalog}</option>
                      </select>
                        <small className="field-note">{copy.bindingNote}</small>
                    </label>

                    <label className="field">
                        <span>{copy.configName}</span>
                      <Input
                        disabled={!isEditableVariant}
                        value={variantName}
                        onChange={(event) => setVariantName(event.target.value)}
                      />
                      {!isEditableVariant ? (
                        <small className="field-note">{copy.readOnlyNote}</small>
                      ) : null}
                    </label>

                    <label className="field">
                        <span>{copy.configDescription}</span>
                      <textarea
                        disabled={!isEditableVariant}
                        rows={3}
                        value={variantDescription}
                        onChange={(event) => setVariantDescription(event.target.value)}
                      />
                    </label>
                  </div>

                  <div
                    aria-label={`screener-summary-list variant=${selectedVariant.variant_key} count=${tuningFields.length || selectedVariant.filters.length}`}
                    className="screeners-summary-card"
                  >
                    <strong>{copy.summary}</strong>
                    <ul className="filter-list">
                      {tuningSummary(selectedVariant, tuningFields, tuningDraft).map((item, index) => (
                        <li aria-label={getScreenerSummaryAutomationName(selectedVariant.variant_key, index)} key={item}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="tuning-grid">
                    {tuningFields.map((field) => (
                      <article key={field.key} className="tuning-card">
                        <div className="tuning-card-head">
                          <strong>{field.label}</strong>
                          <span>{field.helper}</span>
                        </div>
                        <div className="segment-row">
                          {LEVELS.map((level) => (
                            <button
                              key={level}
                              className={`segment-button ${tuningDraft[field.key] === level ? "active" : ""}`}
                              disabled={busy === "create" || busy === "save" || !isEditableVariant}
                              onClick={() => handleTuningSelect(field.key, level)}
                              type="button"
                            >
                              {field.levels[level]}
                            </button>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>

                  <div className="form-actions">
                    <button
                      aria-label={`screener-run variant=${selectedVariant.variant_key} universe=${universeSource}`}
                      className="primary-button"
                      disabled={busy === "run"}
                      onClick={handleRun}
                      type="button"
                    >
                      <RefreshCcw size={16} />
                      {busy === "run" ? `${copy.statusRunning}...` : copy.runCurrent}
                    </button>

                    <button
                      aria-label={`screener-variant-save key=${selectedVariant.variant_key}`}
                      className="ghost-button"
                      disabled={busy === "save" || !isEditableVariant}
                      onClick={handleSaveVariant}
                      type="button"
                    >
                      <Save size={16} />
                      {busy === "save" ? `${copy.statusRunning}...` : hasUnsavedTuning ? copy.saveChanges : copy.save}
                    </button>

                    <button
                      aria-label={`screener-variant-activate key=${selectedVariant.variant_key}`}
                      className="ghost-button"
                      disabled={busy === "activate" || selectedVariant.is_active}
                      onClick={handleActivateVariant}
                      type="button"
                    >
                      <Check size={16} />
                      {busy === "activate" ? `${copy.statusRunning}...` : selectedVariant.is_active ? copy.active : copy.activate}
                    </button>

                    <button
                      aria-label={`screener-variant-delete key=${selectedVariant.variant_key}`}
                      className="ghost-button danger"
                      disabled={busy === "delete" || !isEditableVariant}
                      onClick={handleDeleteVariant}
                      type="button"
                    >
                      <Trash2 size={16} />
                      {busy === "delete" ? `${copy.statusRunning}...` : copy.delete}
                    </button>
                  </div>

                  {routeSection === "screenerTuning" && runResult ? (
                    <div
                      aria-label={`screener-run-attribution preset=${runResult.preset} variant=${runResult.variant_key} universe=${runResult.universe_source}`}
                      className="metric-grid screener-run-metrics"
                    >
                      <MetricCard label={copy.universe} value={runResult.universe_label} />
                      <MetricCard label={copy.presetMetric} value={runResult.preset} />
                      <MetricCard label={copy.variantMetric} value={runResult.variant_name} />
                      <MetricCard label={copy.hitScore} value={String(runResult.hit_count)} />
                    </div>
                  ) : null}

                  {actionError ? <InlineState label={actionError} /> : null}
                </>
              ) : (
                <InlineState label={copy.noVariant} />
              )}
            </div> : null}

            {routeSection === "screenerUniverse" ? <div className="screeners-column" data-primary-task="screenerUniverse">
              <div className="screeners-column-head"><div><p className="eyebrow">{copy.universe}</p><strong>{getUniverseSummary(universeSource, selectedPreset.asset_type, copy)}</strong></div><span className="mini-pill">{selectedPreset.asset_type === "crypto" ? copy.crypto : copy.equities}</span></div>
              <label className="field"><span>{copy.runScope}</span><select value={universeSource} onChange={(event) => setUniverseSource(event.target.value as ScreenerUniverseSource)}><option value="expanded">{copy.expanded}</option><option value="catalog">{copy.catalog}</option></select><small className="field-note">{copy.bindingNote}</small></label>
              <div className="metric-grid"><MetricCard label={copy.presetMetric} value={selectedPreset.title} /><MetricCard label={copy.variantMetric} value={selectedPreset.active_variant_name ?? copy.notAvailable} /><MetricCard label={copy.recentHits} value={String(selectedPreset.hit_count)} /><MetricCard label={copy.source} value={universeSource === "expanded" ? copy.expanded : copy.catalog} /></div>
              <p className="body-copy">{selectedPreset.description}</p>
            </div> : null}
          </div>
        ) : null}
      </section>

      {routeSection === undefined ? <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{copy.resultHeading}</p>
            <h3>{copy.resultBinding}</h3>
          </div>
        </div>
        {runResult ? (
          <>
            <p className="body-copy">{runResult.data_source_note}</p>
            <div
              aria-label={`screener-run-attribution preset=${runResult.preset} variant=${runResult.variant_key} universe=${runResult.universe_source}`}
              className="metric-grid screener-run-metrics"
            >
              <MetricCard label={copy.universe} value={runResult.universe_label} />
              <MetricCard label={copy.presetMetric} value={runResult.preset} />
              <MetricCard label={copy.variantMetric} value={runResult.variant_name} />
              <MetricCard label={copy.evaluated} value={String(runResult.evaluated_count)} />
              <MetricCard label={copy.hitScore} value={String(runResult.hit_count)} />
            </div>
            <div className="p3-result-layout">
            <div className="table-list p3-result-table">
              {runResult.results.map((item) => (
                <div
                  key={item.symbol}
                  className={`table-row tall screener-result-row ${item.symbol === selectedResult?.symbol ? "selected" : ""}`}
                  aria-current={item.symbol === selectedResult?.symbol ? "true" : undefined}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAssetId(item.symbol)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedAssetId(item.symbol);
                    }
                  }}
                >
                  <div className="screener-result-head">
                    <div className="table-main">
                      <strong>
                        {item.symbol} <span className="inline-symbol">{item.market}</span>
                      </strong>
                      <span className="panel-note">{item.name}</span>
                      <span>
                        {formatPrice(item.price, item.asset_class === "crypto" ? "USDT" : "USD", item.asset_class)} /{" "}
                        {formatPercent(item.change_pct)}
                      </span>
                    </div>
                    <div className="screener-score-block">
                      <span className={`score-pill ${item.score_label}`}>{getScoreLabelText(item.score_label, copy)}</span>
                      <strong>{item.score.toFixed(1)}</strong>
                      <button
                        className="ghost-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openResearch(item.symbol);
                        }}
                        type="button"
                      >
                        {copy.research}
                      </button>
                    </div>
                  </div>
                  <div className="table-notes">
                    <span>{copy.explanation}：{item.explanations.join("；") || copy.noExplanation}</span>
                    <span>{copy.matchedBy}：{item.matched_rules.join("；") || copy.none}</span>
                    <span>{copy.missingMetrics}：{item.missing_metrics.join("；") || copy.none}</span>
                    <span>{copy.keyMetrics}：{formatMetricHighlights(item, copy) || copy.notAvailable}</span>
                    {item.factor_context ? (
                      <span>
                        {copy.factorEvidence}：{item.factor_context.run_id} / {copy.rank} {item.factor_context.rank ?? copy.notAvailable} / {copy.score}{" "}
                        {item.factor_context.composite_score ?? copy.notAvailable} / {item.factor_context.bucket}
                      </span>
                    ) : null}
                    <span>
                      {copy.quality}: {item.data_quality?.overall ?? copy.unknown} / {copy.completeness}{" "}
                      {item.data_quality?.completeness.level ?? copy.unknown}
                    </span>
                    <span>
                    {copy.source}：{item.data_source} / {item.stale ? copy.cached : copy.realtime}
                    </span>
                    {item.notes.length > 0 ? <span>{copy.notes}：{item.notes.join("；")}</span> : null}
                  </div>
                </div>
              ))}
            </div>
            {selectedResult ? (
              <InspectorPanel
                context={{
                  routeId: "automation/screeners/runs/:runId",
                  objectType: "screener-result",
                  objectId: selectedResult.symbol,
                  assetId: selectedResult.symbol,
                  evidenceScope: ["screener result", "matched rules", "data quality"],
                  source: selectedResult.data_source,
                  freshness: selectedResult.stale ? copy.cache : copy.observed,
                  permissionState: "read_only",
                  aiState: "available",
                }}
                title={selectedResult.symbol}
                status={<Badge tone={selectedResult.stale ? "warning" : "success"}>{selectedResult.stale ? copy.cache : copy.observed}</Badge>}
                rows={[
                  { label: "名称", value: selectedResult.name },
                  { label: "评分", value: selectedResult.score.toFixed(1) },
                  { label: "关键规则", value: selectedResult.matched_rules.join("、") || "暂无" },
                  { label: copy.quality, value: selectedResult.data_quality?.overall ?? copy.unknown },
                  { label: "来源", value: selectedResult.data_source },
                ]}
                actions={<button className="primary-button" onClick={() => openResearch(selectedResult.symbol)} type="button">打开研究</button>}
              />
            ) : null}
            </div>
          </>
        ) : (
          <PanelState
            title="还没有运行结果"
            copy={copy.noRunCopy}
          />
        )}
      </section> : null}
    </div>
  );
}
