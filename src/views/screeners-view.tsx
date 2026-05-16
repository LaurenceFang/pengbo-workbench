import { Check, Plus, RefreshCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InlineState, MetricCard, PanelState, formatPercent, formatPrice } from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
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

type TuningFieldConfig = {
  key: string;
  label: string;
  helper: string;
  levels: Record<ScreenerTuningLevel, string>;
};

const LEVELS: ScreenerTuningLevel[] = ["low", "medium", "high"];

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

function getUniverseSummary(universeSource: ScreenerUniverseSource, assetType: string): string {
  if (universeSource === "expanded") {
    return assetType === "crypto" ? "范围：受控扩容 Binance 主流币池" : "范围：受控扩容股票 + ETF 池";
  }
  return assetType === "crypto" ? "范围：当前可搜索加密目录" : "范围：当前可搜索股票目录";
}

function getScoreLabelText(scoreLabel: ScreenerScoreLabel): string {
  if (scoreLabel === "high") {
    return "高分";
  }
  if (scoreLabel === "medium") {
    return "中分";
  }
  return "观察";
}

function getVariantDraftName(preset: ScreenerPreset, variants: ScreenerPresetVariant[]): string {
  const customCount = variants.filter((item) => !item.is_system_default).length;
  return `${preset.title} 自定义 ${customCount + 1}`;
}

function getScreenerSummaryAutomationName(variantKey: string, index: number): string {
  return `screener-summary variant=${variantKey} index=${index}`;
}

function formatMetricHighlights(item: ScreenerRunResult): string {
  const parts: string[] = [];
  if (typeof item.metrics.market_cap === "string") {
    parts.push(`市值 ${item.metrics.market_cap}`);
  }
  if (typeof item.metrics.thirty_day_change_pct === "number") {
    parts.push(`30D ${formatPercent(item.metrics.thirty_day_change_pct)}`);
  }
  if (typeof item.metrics.seven_day_change_pct === "number") {
    parts.push(`7D ${formatPercent(item.metrics.seven_day_change_pct)}`);
  }
  if (typeof item.metrics.volatility_pct === "number") {
    parts.push(`波动 ${item.metrics.volatility_pct.toFixed(1)}%`);
  }
  if (typeof item.metrics.avg_volume === "number") {
    const label = item.asset_class === "crypto" ? "日均成交额" : "日均成交量";
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

export function ScreenersView({ onGlobalRefresh }: { onGlobalRefresh: () => Promise<void> }) {
  const setActiveView = useAppStore((state) => state.setActiveView);
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

  const presets = useAsyncResource<ScreenerPreset[]>(async () => api.getScreenerPresets(), []);
  const [variantName, setVariantName] = useState("");
  const [variantDescription, setVariantDescription] = useState("");
  const [tuningDraft, setTuningDraft] = useState<Record<string, ScreenerTuningLevel>>({});
  const [pendingSelectedVariantKey, setPendingSelectedVariantKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "save" | "activate" | "delete" | "run" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => presets.data?.find((item) => item.key === selectedKey) ?? presets.data?.[0] ?? null,
    [presets.data, selectedKey],
  );
  const variants = useAsyncResource<ScreenerPresetVariant[]>(
    async () => (selectedPreset ? api.getScreenerPresetVariants(selectedPreset.key) : []),
    [selectedPreset?.key],
    { enabled: selectedPreset !== null },
  );
  const selectedVariant = useMemo(
    () => variants.data?.find((item) => item.variant_key === selectedVariantKey) ?? variants.data?.[0] ?? null,
    [variants.data, selectedVariantKey],
  );
  const tuningFields = selectedPreset ? TUNING_CONFIG[selectedPreset.key] ?? [] : [];
  const isEditableVariant = selectedVariant ? !selectedVariant.is_system_default : false;
  const hasUnsavedTuning = selectedVariant ? !sameTuning(tuningDraft, selectedVariant.tuning) : false;

  useEffect(() => {
    if (!presets.data || presets.data.length === 0) {
      return;
    }
    if (!selectedKey || !presets.data.some((item) => item.key === selectedKey)) {
      setSelectedKey(presets.data[0].key);
    }
  }, [presets.data, selectedKey, setSelectedKey]);

  useEffect(() => {
    if (variants.loading) {
      return;
    }
    if (!variants.data || variants.data.length === 0) {
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
  }, [pendingSelectedVariantKey, variants.data, variants.loading, selectedVariantKey, setSelectedVariantKey]);

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

  async function handleCreateVariant() {
    if (!selectedPreset || !variants.data) {
      return;
    }
    setBusy("create");
    setActionError(null);
    try {
      const created = await api.createScreenerPresetVariant(selectedPreset.key, {
        name: getVariantDraftName(selectedPreset, variants.data),
        description: selectedVariant ? `从 ${selectedVariant.name} 复制的新自定义配置。` : undefined,
      });
      const copied = selectedVariant
        ? await api.updateScreenerPresetVariant(selectedPreset.key, created.variant_key, {
            name: created.name,
            description: created.description,
            tuning: selectedVariant.tuning,
          })
        : created;
      await reloadPresetData(copied.variant_key);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "创建自定义配置失败。");
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
      setActionError(error instanceof Error ? error.message : "保存配置失败。");
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
      setActionError(error instanceof Error ? error.message : "激活配置失败。");
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteVariant() {
    if (!selectedPreset || !selectedVariant || !isEditableVariant) {
      return;
    }
    if (!window.confirm(`确认删除“${selectedVariant.name}”吗？删除后会回到默认配置。`)) {
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
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "删除配置失败。");
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
      setActionError(error instanceof Error ? error.message : "运行筛选器失败。");
    } finally {
      setBusy(null);
    }
  }

  function handleTuningSelect(fieldKey: string, level: ScreenerTuningLevel) {
    if (!selectedVariant) {
      return;
    }
    if (!isEditableVariant) {
      setActionError("系统默认配置只读。请先新建自定义变体，再调整这些选项。");
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
      className="stack-layout"
    >
      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">筛选器</p>
            <h3>固定预设 + 显式变体管理</h3>
          </div>
          <span className="mini-pill accent">
            {getUniverseSummary(universeSource, selectedPreset?.asset_type ?? "equity")}
          </span>
        </div>

        {presets.loading && !selectedPreset ? <InlineState label="正在加载筛选器预设..." /> : null}
        {presets.error && !selectedPreset ? <InlineState label={presets.error} actionLabel="重试" onAction={presets.reload} /> : null}

        {selectedPreset ? (
          <div className="screeners-workspace">
            <div className="screeners-column">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">Preset</p>
                  <strong>选择策略预设</strong>
                </div>
                <span className="mini-pill">{presets.data?.length ?? 0}</span>
              </div>
              <div className="screeners-preset-grid">
                {(presets.data ?? []).map((preset) => (
                  <button
                    aria-label={`screener-preset key=${preset.key} selected=${String(
                      preset.key === selectedPreset.key,
                    )} active-variant=${preset.active_variant_key ?? "none"}`}
                    key={preset.key}
                    className={`preset-card selectable ${preset.key === selectedPreset.key ? "selected" : ""}`}
                    onClick={() => setSelectedKey(preset.key)}
                    type="button"
                  >
                    <div className="preset-head">
                      <span className="mini-pill">{preset.badge}</span>
                      <strong>{preset.title}</strong>
                    </div>
                    <p>{preset.description}</p>
                    <div className="variant-badge-row">
                      <span className="mini-pill">{preset.active_variant_name ?? "未激活"}</span>
                      <small>最近命中 {preset.hit_count}</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="screeners-column">
              <div className="screeners-column-head">
                <div>
                  <p className="eyebrow">Variant</p>
                  <strong>新建、选择或删除变体</strong>
                </div>
                <button
                  aria-label="screener-variant-create"
                  className="ghost-button"
                  disabled={busy === "create"}
                  onClick={handleCreateVariant}
                  type="button"
                >
                  <Plus size={16} />
                  {busy === "create" ? "新建中..." : "新建"}
                </button>
              </div>

              {variants.loading && !selectedVariant ? <InlineState label="正在加载变体..." /> : null}
              {variants.error && !selectedVariant ? (
                <InlineState label={variants.error} actionLabel="重试" onAction={variants.reload} />
              ) : null}

              <div className="screeners-variant-list">
                {(variants.data ?? []).map((variant) => (
                  <button
                    aria-label={`screener-variant key=${variant.variant_key} selected=${String(
                      variant.variant_key === selectedVariant?.variant_key,
                    )} active=${String(variant.is_active)} system=${String(variant.is_system_default)}`}
                    key={variant.variant_key}
                    className={`variant-card ${variant.variant_key === selectedVariant?.variant_key ? "selected" : ""}`}
                    onClick={() => setSelectedVariantKey(variant.variant_key)}
                    type="button"
                  >
                    <div className="variant-card-head">
                      <strong>{variant.name}</strong>
                      {variant.is_active ? <span className="mini-pill accent">当前活动</span> : null}
                    </div>
                    <p>{variant.description}</p>
                    <div className="variant-badge-row">
                      <span className="mini-pill">{variant.is_system_default ? "系统默认" : "自定义"}</span>
                      <small>最近命中 {variant.last_hit_count}</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="screeners-column">
              {selectedVariant ? (
                <>
                  <div className="screeners-column-head">
                    <div>
                      <p className="eyebrow">Control</p>
                      <strong>当前配置与运行参数</strong>
                    </div>
                    <span className="mini-pill">{selectedPreset.asset_type === "crypto" ? "加密" : "股票"}</span>
                  </div>

                  <div className="form-grid">
                    <label className="field">
                      <span>运行范围</span>
                      <select
                        value={universeSource}
                        onChange={(event) => setUniverseSource(event.target.value as ScreenerUniverseSource)}
                      >
                        <option value="expanded">受控扩容</option>
                        <option value="catalog">稳定目录回退</option>
                      </select>
                      <small className="field-note">运行结果始终绑定 preset、variant 和 universe。</small>
                    </label>

                    <label className="field">
                      <span>配置名称</span>
                      <input
                        disabled={!isEditableVariant}
                        value={variantName}
                        onChange={(event) => setVariantName(event.target.value)}
                      />
                      {!isEditableVariant ? (
                        <small className="field-note">系统默认配置只读；请先新建自定义变体，再调整下方选项。</small>
                      ) : null}
                    </label>

                    <label className="field">
                      <span>配置说明</span>
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
                    <strong>当前配置摘要</strong>
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
                      {busy === "run" ? "运行中..." : "运行当前配置"}
                    </button>

                    <button
                      aria-label={`screener-variant-save key=${selectedVariant.variant_key}`}
                      className="ghost-button"
                      disabled={busy === "save" || !isEditableVariant}
                      onClick={handleSaveVariant}
                      type="button"
                    >
                      <Save size={16} />
                      {busy === "save" ? "保存中..." : hasUnsavedTuning ? "保存配置更改" : "保存配置"}
                    </button>

                    <button
                      aria-label={`screener-variant-activate key=${selectedVariant.variant_key}`}
                      className="ghost-button"
                      disabled={busy === "activate" || selectedVariant.is_active}
                      onClick={handleActivateVariant}
                      type="button"
                    >
                      <Check size={16} />
                      {busy === "activate" ? "切换中..." : selectedVariant.is_active ? "已是活动配置" : "设为活动配置"}
                    </button>

                    <button
                      aria-label={`screener-variant-delete key=${selectedVariant.variant_key}`}
                      className="ghost-button danger"
                      disabled={busy === "delete" || !isEditableVariant}
                      onClick={handleDeleteVariant}
                      type="button"
                    >
                      <Trash2 size={16} />
                      {busy === "delete" ? "删除中..." : "删除自定义配置"}
                    </button>
                  </div>

                  {actionError ? <InlineState label={actionError} /> : null}
                </>
              ) : (
                <InlineState label="当前预设还没有可用变体。" />
              )}
            </div>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">结果</p>
            <h3>结果会绑定到当前 preset + variant + universe</h3>
          </div>
        </div>
        {runResult ? (
          <>
            <p className="body-copy">{runResult.data_source_note}</p>
            <div
              aria-label={`screener-run-attribution preset=${runResult.preset} variant=${runResult.variant_key} universe=${runResult.universe_source}`}
              className="metric-grid screener-run-metrics"
            >
              <MetricCard label="Universe" value={runResult.universe_label} />
              <MetricCard label="Preset" value={runResult.preset} />
              <MetricCard label="Variant" value={runResult.variant_name} />
              <MetricCard label="已评估" value={String(runResult.evaluated_count)} />
              <MetricCard label="高/中评分" value={String(runResult.hit_count)} />
            </div>
            <div className="table-list">
              {runResult.results.map((item) => (
                <div key={item.symbol} className="table-row tall screener-result-row">
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
                      <span className={`score-pill ${item.score_label}`}>{getScoreLabelText(item.score_label)}</span>
                      <strong>{item.score.toFixed(1)}</strong>
                      <button className="ghost-button" onClick={() => openResearch(item.symbol)} type="button">
                        Research
                      </button>
                    </div>
                  </div>
                  <div className="table-notes">
                    <span>解释：{item.explanations.join("；") || "暂无足够解释。"}</span>
                    <span>命中依据：{item.matched_rules.join("；") || "无"}</span>
                    <span>缺失指标：{item.missing_metrics.join("；") || "无"}</span>
                    <span>关键指标：{formatMetricHighlights(item) || "当前结果未返回额外指标摘要。"}</span>
                    {item.factor_context ? (
                      <span>
                        因子证据：{item.factor_context.run_id} / rank {item.factor_context.rank ?? "n/a"} / score{" "}
                        {item.factor_context.composite_score ?? "n/a"} / {item.factor_context.bucket}
                      </span>
                    ) : null}
                    <span>
                      来源：{item.data_source} / {item.stale ? "缓存数据" : "实时数据"}
                    </span>
                    {item.notes.length > 0 ? <span>备注：{item.notes.join("；")}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <PanelState
            title="还没有运行结果"
            copy="选择一个预设和变体后运行，页面会显示 universe 规模、命中数、评分排序、解释和缺失指标。"
          />
        )}
      </section>
    </div>
  );
}
