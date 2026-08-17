import { Download, ExternalLink, RefreshCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DataStatusStrip, InlineState } from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import { usePengboNavigation } from "../hooks/use-pengbo-navigation";
import { useI18n } from "../i18n";
import {
  api,
  type ConnectorManifestResponse,
  type ConnectionsCatalogResponse,
  type CryptoMarketsResponse,
  type DataQualityLevel,
  type DataSourceRuntimeStatus,
  type DataSourceStatusResponse,
  type EquityQuoteResponse,
  type FreshnessState,
  type MacroSeriesResponse,
  type NewsEventsResponse,
} from "../lib/api";
import type { BackendStatus } from "../components/shared";
import { isTauriRuntime } from "../lib/runtime";
import { useRouteContext } from "../routes/route-context";

const DEFAULT_PROVIDER = "worldbank";
type MacroSelectOption = { value: string; label: string };
type MacroSourceConfig = {
  label: string;
  defaultSeries: string;
  defaultCountry: string;
  series: MacroSelectOption[];
  countries: MacroSelectOption[];
  buildSeriesId: (series: string, country: string) => string;
};

const WDI_SERIES_OPTIONS: MacroSelectOption[] = [
  { value: "NY.GDP.MKTP.CD", label: "GDP, current US$" },
  { value: "NY.GDP.MKTP.KD.ZG", label: "GDP growth, annual %" },
  { value: "FP.CPI.TOTL.ZG", label: "Inflation, consumer prices %" },
  { value: "SL.UEM.TOTL.ZS", label: "Unemployment, total %" },
  { value: "SP.POP.TOTL", label: "Population, total" },
  { value: "NE.EXP.GNFS.ZS", label: "Exports, % of GDP" },
];

const WORLDBANK_COUNTRIES: MacroSelectOption[] = [
  { value: "CN", label: "China" },
  { value: "US", label: "United States" },
  { value: "JP", label: "Japan" },
  { value: "DE", label: "Germany" },
  { value: "GB", label: "United Kingdom" },
  { value: "WLD", label: "World" },
];

const DBNOMICS_COUNTRIES: MacroSelectOption[] = [
  { value: "CHN", label: "China" },
  { value: "USA", label: "United States" },
  { value: "JPN", label: "Japan" },
  { value: "DEU", label: "Germany" },
  { value: "GBR", label: "United Kingdom" },
  { value: "WLD", label: "World" },
];

const MACRO_SOURCE_CONFIG: Record<string, MacroSourceConfig> = {
  worldbank: {
    label: "World Bank",
    defaultSeries: "NY.GDP.MKTP.CD",
    defaultCountry: "CN",
    series: WDI_SERIES_OPTIONS,
    countries: WORLDBANK_COUNTRIES,
    buildSeriesId: (series) => series,
  },
  dbnomics: {
    label: "DBnomics",
    defaultSeries: "NY.GDP.MKTP.CD",
    defaultCountry: "CHN",
    series: WDI_SERIES_OPTIONS,
    countries: DBNOMICS_COUNTRIES,
    buildSeriesId: (series, country) => `WB/WDI/A-${series}-${country}`,
  },
  fred: {
    label: "FRED",
    defaultSeries: "GDP",
    defaultCountry: "US",
    series: [
      { value: "GDP", label: "Gross Domestic Product" },
      { value: "GDPC1", label: "Real Gross Domestic Product" },
      { value: "CPIAUCSL", label: "Consumer Price Index" },
      { value: "UNRATE", label: "Unemployment Rate" },
      { value: "FEDFUNDS", label: "Effective Federal Funds Rate" },
      { value: "DGS10", label: "10-Year Treasury Rate" },
    ],
    countries: [{ value: "US", label: "United States" }],
    buildSeriesId: (series) => series,
  },
  hkma: {
    label: "HKMA",
    defaultSeries: "monetary_base_total",
    defaultCountry: "HK",
    series: [
      { value: "monetary_base_total", label: "Monetary base total" },
      { value: "m3_hkd", label: "M3 HKD" },
      { value: "exrate_hkd_usd", label: "HKD/USD" },
      { value: "hibor_fixing_3m", label: "HIBOR 3-month" },
    ],
    countries: [{ value: "HK", label: "Hong Kong" }],
    buildSeriesId: (series) => series,
  },
};
type AsyncResource<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

export type DataSourcesRouteSection =
  | "dataSourcesCatalog"
  | "dataSourceDetail"
  | "dataSourcePreview"
  | "dataSourceQuality"
  | "dataSourcesReport";

export function DataSourcesView({ backendStatus, routeSection }: { backendStatus: BackendStatus; routeSection: DataSourcesRouteSection }) {
  const i18n = useI18n();
  const { params } = useRouteContext();
  const { openRoute } = usePengboNavigation();
  const catalogEnabled = routeSection === "dataSourcesCatalog";
  const detailEnabled = routeSection === "dataSourceDetail";
  const previewEnabled = routeSection === "dataSourcePreview";
  const qualityEnabled = routeSection === "dataSourceQuality";
  const reportEnabled = routeSection === "dataSourcesReport";
  const sourceStatusEnabled = catalogEnabled || detailEnabled || previewEnabled || qualityEnabled || reportEnabled;
  const [selectedProvider, setSelectedProvider] = useState(DEFAULT_PROVIDER);
  const [macroProvider, setMacroProvider] = useState("worldbank");
  const [macroSeriesId, setMacroSeriesId] = useState("NY.GDP.MKTP.CD");
  const [macroCountry, setMacroCountry] = useState("CN");
  const [equitySymbol, setEquitySymbol] = useState("600519.SH");
  const [newsQuery, setNewsQuery] = useState("market OR earnings");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerProKey, setProviderProKey] = useState("");
  const [credentialBusy, setCredentialBusy] = useState<string | null>(null);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  useEffect(() => {
    if (!params.provider) return;
    setSelectedProvider(params.provider);
    if (MACRO_SOURCE_CONFIG[params.provider]) selectMacroProvider(params.provider);
  }, [params.provider]);
  const previewKind = MACRO_SOURCE_CONFIG[selectedProvider]
    ? "macro"
    : selectedProvider === "tushare"
      ? "equity"
      : selectedProvider === "coingecko"
        ? "crypto"
        : selectedProvider === "rss_events"
          ? "news"
          : "unsupported";
  const macroConfig = MACRO_SOURCE_CONFIG[macroProvider] ?? MACRO_SOURCE_CONFIG.worldbank;
  const macroApiSeriesId = macroConfig.buildSeriesId(macroSeriesId, macroCountry);
  const sourceStatus = useAsyncResource<DataSourceStatusResponse>(async () => api.getDataSourceStatus(), [], {
    enabled: backendStatus === "online" && sourceStatusEnabled,
  });
  const catalog = useAsyncResource<ConnectionsCatalogResponse>(async () => api.getConnectionsCatalog(), [], {
    enabled: backendStatus === "online" && (catalogEnabled || detailEnabled || reportEnabled),
  });
  const manifests = useAsyncResource<ConnectorManifestResponse>(async () => api.getDataSourceManifests(), [], {
    enabled: backendStatus === "online" && detailEnabled,
  });
  const macro = useAsyncResource<MacroSeriesResponse>(
    async () => api.getMacroSeries({ provider: macroProvider, seriesId: macroApiSeriesId, country: macroCountry, limit: 8 }),
    [macroProvider, macroApiSeriesId, macroCountry],
    { enabled: backendStatus === "online" && previewEnabled && previewKind === "macro" },
  );
  const providerItems = sourceStatus.data?.providers ?? [];
  const coingeckoStatus = providerItems.find((item) => item.provider === "coingecko") ?? null;
  const coingeckoConfigured = coingeckoStatus?.configured ?? false;
  const tushareStatus = providerItems.find((item) => item.provider === "tushare") ?? null;
  const tushareConfigured = tushareStatus?.configured ?? false;
  const equityQuote = useAsyncResource<EquityQuoteResponse>(
    async () => api.getEquityQuote({ provider: "tushare", symbol: equitySymbol }),
    [equitySymbol, tushareConfigured],
    { enabled: backendStatus === "online" && previewEnabled && previewKind === "equity" && tushareConfigured },
  );
  const crypto = useAsyncResource<CryptoMarketsResponse>(
    async () => api.getCryptoMarkets({ ids: "bitcoin,ethereum,solana", limit: 3 }),
    [coingeckoConfigured],
    { enabled: backendStatus === "online" && previewEnabled && previewKind === "crypto" && coingeckoConfigured },
  );
  const news = useAsyncResource<NewsEventsResponse>(
    async () => api.getNewsEvents({ query: newsQuery, limit: 8 }),
    [newsQuery],
    { enabled: backendStatus === "online" && previewEnabled && previewKind === "news" },
  );

  const selectedStatus = providerItems.find((item) => item.provider === selectedProvider) ?? providerItems[0] ?? null;
  const catalogMap = useMemo(
    () => new Map((catalog.data?.providers ?? []).map((item) => [item.provider, item] as const)),
    [catalog.data?.providers],
  );
  const catalogProviders = catalog.data?.providers ?? [];
  const readOnlyProviderCount = catalogProviders.filter((item) => item.read_only).length;
  const liveTradingProviderCount = catalogProviders.filter((item) => item.live_trading).length;
  const credentialGatedProviderCount = catalogProviders.filter((item) =>
    item.capabilities.some((capability) => capability.requires_credentials),
  ).length;
  const selectedCatalog = selectedStatus ? catalogMap.get(selectedStatus.provider) : null;
  const selectedManifest = selectedStatus
    ? (manifests.data?.manifests ?? []).find((item) => item.provider_key === selectedStatus.provider)
    : null;

  async function refreshAll() {
    sourceStatus.reload();
    if (catalogEnabled || detailEnabled || reportEnabled) catalog.reload();
    if (detailEnabled) manifests.reload();
    if (previewEnabled) {
      if (previewKind === "macro") macro.reload();
      if (previewKind === "equity") equityQuote.reload();
      if (previewKind === "crypto") crypto.reload();
      if (previewKind === "news") news.reload();
    }
  }

  async function saveDataSourceCredential(provider: string) {
    const apiKey = providerApiKey.trim();
    const proKey = providerProKey.trim();
    if (!apiKey && !proKey) {
      setCredentialError("Enter an API key before saving.");
      return;
    }
    setCredentialBusy(provider);
    setCredentialError(null);
    setCredentialMessage(null);
    try {
      await api.saveConnectionSecret(provider, {
        apiKey: apiKey || undefined,
        secret: provider === "coingecko" && proKey ? proKey : undefined,
      });
      await api.restartSidecar();
      const result = await api.testConnection(provider);
      setCredentialMessage(`${provider} ${result.status}: ${result.message}`);
      setProviderApiKey("");
      setProviderProKey("");
      refreshAll();
    } catch (error) {
      setCredentialError(error instanceof Error ? error.message : `Failed to save ${provider} credentials.`);
    } finally {
      setCredentialBusy(null);
    }
  }

  async function clearDataSourceCredential(provider: string) {
    setCredentialBusy(provider);
    setCredentialError(null);
    setCredentialMessage(null);
    try {
      await api.clearConnectionSecret(provider);
      await api.restartSidecar();
      await api.clearConnectionProfile(provider);
      setProviderApiKey("");
      setProviderProKey("");
      setCredentialMessage(`${provider} credentials cleared.`);
      refreshAll();
    } catch (error) {
      setCredentialError(error instanceof Error ? error.message : `Failed to clear ${provider} credentials.`);
    } finally {
      setCredentialBusy(null);
    }
  }

  async function exportReport() {
    setExportBusy(true);
    setExportError(null);
    try {
      const result = await api.exportDataSourceReport({
        macroProvider,
        macroSeriesId: macroApiSeriesId,
        macroCountry,
        newsQuery,
        cryptoIds: "bitcoin,ethereum,solana",
        equityProvider: "tushare",
        equitySymbol,
      });
      setExportPath(result.export_path);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : i18n.t("dataSources.exportFailed"));
    } finally {
      setExportBusy(false);
    }
  }

  function selectMacroProvider(provider: string) {
    const defaults = MACRO_SOURCE_CONFIG[provider] ?? MACRO_SOURCE_CONFIG.worldbank;
    setMacroProvider(provider);
    setMacroSeriesId(defaults.defaultSeries);
    setMacroCountry(defaults.defaultCountry);
  }

  if (backendStatus !== "online") {
    return <InlineState label={i18n.t("dataSources.waiting")} />;
  }

  return (
    <div className="p1-page p1-data-sources-page data-sources-page" aria-label={`data-sources-view providers=${providerItems.length} selected=${selectedProvider} section=${routeSection}`} data-route-id="/markets/data-sources/catalog" data-route-section={routeSection} data-context-inspector="data-source">
      <header className="p1-page-header data-source-overview">
        <div>
          <p className="eyebrow">{i18n.t("dataSources.eyebrow")}</p>
          <h2>{i18n.t("dataSources.title")}</h2>
          <p className="p1-page-lede">{i18n.language === "zh-CN" ? "在创建研究前，检查数据覆盖、新鲜度、缓存状态和只读边界。" : "Review provider coverage, freshness, cache state, and read-only boundaries before creating research."}</p>
        </div>
        <div className="p1-page-actions">
          <span className={`p1-status-dot ${backendStatus === "online" ? "is-live" : "is-offline"}`}>{backendStatus}</span>
          <button className="ghost-button" type="button" onClick={refreshAll}>
            <RefreshCcw size={16} />
            {i18n.t("dataSources.refresh")}
          </button>
        </div>
      </header>

      {routeSection === "dataSourcesCatalog" ? <section className="card p1-panel data-source-overview p1-source-overview" data-primary-task={routeSection}>
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.language === "zh-CN" ? "来源目录" : "Source catalog"}</p>
            <h3>{i18n.language === "zh-CN" ? "选择一个来源，检查它的数据契约" : "Select a provider to inspect its contract"}</h3>
          </div>
        </div>
        {sourceStatus.error ? <InlineState label={sourceStatus.error} actionLabel="Retry" onAction={sourceStatus.reload} /> : null}
        {exportPath ? (
          <p aria-label="data-source-report-export-path" className="panel-note">
            {i18n.t("dataSources.exported")}: {exportPath}
          </p>
        ) : null}
        {exportError ? <InlineState label={`${i18n.t("dataSources.exportFailed")}: ${exportError}`} /> : null}
        <div className="source-list">
          {providerItems.map((provider) => (
            <button
              aria-label={`data-source-provider provider=${provider.provider} health=${provider.health}`}
              className={`source-list-item ${selectedProvider === provider.provider ? "active" : ""}`}
              key={provider.provider}
              type="button"
              onClick={() => {
                setSelectedProvider(provider.provider);
                openRoute(`/markets/data-sources/${encodeURIComponent(provider.provider)}`);
              }}
            >
              <span>
                <strong>{provider.label}</strong>
                <small>{provider.provider}</small>
              </span>
              <span className={`mini-pill status-${provider.health}`}>{provider.health}</span>
            </button>
          ))}
        </div>
        {catalogProviders.length > 0 ? (
          <div
            aria-label={`data-source-catalog-summary providers=${catalogProviders.length} read_only=${readOnlyProviderCount} live_trading=${liveTradingProviderCount} credential_gated=${credentialGatedProviderCount}`}
            className="source-contract-grid"
          >
            <Metric label="Catalog providers" value={String(catalogProviders.length)} />
            <Metric label="Read-only contracts" value={`${readOnlyProviderCount}/${catalogProviders.length}`} />
            <Metric label="Live trading paths" value={String(liveTradingProviderCount)} />
            <Metric label="Credential-gated" value={String(credentialGatedProviderCount)} />
          </div>
        ) : null}
      </section> : null}

      {routeSection === "dataSourceDetail" ? <section className="card p1-panel data-source-detail p1-source-overview" data-primary-task={routeSection}>
          <div className="p1-section-heading">
            <div>
              <p className="eyebrow">{i18n.t("dataSources.sourceContract")}</p>
              <h3>{selectedStatus?.label ?? i18n.t("dataSources.selectSource")}</h3>
            </div>
            <span
              aria-label={`data-source-selected provider=${selectedStatus?.provider ?? "none"} health=${selectedStatus?.health ?? "planned"}`}
              className={`mini-pill status-${selectedStatus?.health ?? "planned"}`}
            >
              {selectedStatus?.configured ? "configured" : selectedStatus?.health ?? "planned"}
            </span>
          </div>
          {selectedStatus ? <ProviderStatusPanel status={selectedStatus} catalog={selectedCatalog} i18n={i18n} /> : null}
          {selectedCatalog ? (
            <>
              <div
                aria-label={`data-source-contract provider=${selectedCatalog.provider} read_only=${selectedCatalog.read_only} live_trading=${selectedCatalog.live_trading}`}
                className="source-contract-grid"
              >
                <Metric label={i18n.t("dataSources.domains")} value={selectedCatalog.data_domains.join(", ") || "--"} />
                <Metric label={i18n.t("dataSources.coverage")} value={selectedCatalog.asset_coverage.join(", ") || "--"} />
                <Metric label={i18n.t("dataSources.freshness")} value={selectedCatalog.freshness?.expected_lag ?? selectedCatalog.freshness?.label ?? "--"} />
                <Metric label={i18n.t("dataSources.testing")} value={selectedCatalog.testable ? selectedCatalog.test_mode ?? "testable" : "planned"} />
                <Metric label="Read only" value={selectedCatalog.read_only ? i18n.t("dataSources.yes") : i18n.t("dataSources.no")} />
                <Metric label="Live trading" value={selectedCatalog.live_trading ? i18n.t("dataSources.yes") : i18n.t("dataSources.no")} />
                <Metric label="License" value={selectedManifest?.license_status ?? "catalog"} />
                <Metric label="Redistribution" value={selectedManifest?.redistribution_risk ?? "unknown"} />
              </div>
              {selectedCatalog.rate_limit_note ? <p className="source-copy">{selectedCatalog.rate_limit_note}</p> : null}
              <p className="source-copy">{selectedCatalog.cache_policy ?? selectedCatalog.description}</p>
            </>
          ) : null}
          <div className="connector-instructions">
            <strong>{i18n.t("dataSources.setupTitle")}</strong>
            <p>{i18n.t("dataSources.setupCopy")}</p>
            <div className="button-row">
              {selectedStatus?.registration_url ? (
                <a className="ghost-button" href={selectedStatus.registration_url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  {i18n.t("dataSources.registrationGuide")}
                </a>
              ) : null}
              {selectedStatus?.paid_setup_url ? (
                <a className="ghost-button" href={selectedStatus.paid_setup_url} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  {i18n.t("dataSources.paidPlanSteps")}
                </a>
              ) : null}
            </div>
            {selectedStatus && isKeyedSource(selectedStatus.provider) ? (
              <div
                aria-label={`data-source-credential-panel provider=${selectedStatus.provider} configured=${String(selectedStatus.configured)}`}
                className="data-source-credential-panel"
              >
                {!isTauriRuntime() ? <InlineState label="Desktop credential storage is only available in the packaged app." /> : null}
                <div className="form-grid two-up">
                  <label className="field">
                    <span>{credentialPrimaryLabel(selectedStatus.provider)}</span>
                    <input
                      aria-label={`data-source-secret provider=${selectedStatus.provider} field=api-key`}
                      autoComplete="off"
                      type="password"
                      value={providerApiKey}
                      onChange={(event) => setProviderApiKey(event.target.value)}
                    />
                  </label>
                  {selectedStatus.provider === "coingecko" ? (
                    <label className="field">
                      <span>CoinGecko pro key (optional)</span>
                      <input
                        aria-label="data-source-secret provider=coingecko field=pro-key"
                        autoComplete="off"
                        type="password"
                        value={providerProKey}
                        onChange={(event) => setProviderProKey(event.target.value)}
                      />
                    </label>
                  ) : null}
                </div>
                <div className="form-actions">
                  <button
                    aria-label={`data-source-save provider=${selectedStatus.provider}`}
                    className="primary-button"
                    disabled={!isTauriRuntime() || credentialBusy === selectedStatus.provider}
                    onClick={() => void saveDataSourceCredential(selectedStatus.provider)}
                    type="button"
                  >
                    <Save size={16} />
                    {credentialBusy === selectedStatus.provider ? "Saving..." : "Save and verify"}
                  </button>
                  <button
                    aria-label={`data-source-clear provider=${selectedStatus.provider}`}
                    className="ghost-button danger"
                    disabled={!isTauriRuntime() || credentialBusy === selectedStatus.provider || !selectedStatus.configured}
                    onClick={() => void clearDataSourceCredential(selectedStatus.provider)}
                    type="button"
                  >
                    <Trash2 size={16} />
                    Clear stored credentials
                  </button>
                </div>
                {credentialMessage ? <InlineState label={credentialMessage} /> : null}
                {credentialError ? <InlineState label={credentialError} /> : null}
              </div>
            ) : null}
          </div>
      </section> : null}

      {routeSection === "dataSourcePreview" ? <section className="card p1-panel data-source-preview p1-source-overview" data-primary-task={routeSection}>
          <div className="p1-section-heading">
            <div>
              <p className="eyebrow">{i18n.t("dataSources.previewEyebrow")}</p>
              <h3>{i18n.t("dataSources.previewTitle")}</h3>
            </div>
          </div>
          {previewKind === "macro" ? <><div className="form-grid three-up">
            <label className="field">
              <span>{i18n.t("dataSources.macroProvider")}</span>
              <select value={macroProvider} onChange={(event) => selectMacroProvider(event.target.value)}>
                {Object.entries(MACRO_SOURCE_CONFIG).map(([provider, config]) => (
                  <option key={provider} value={provider}>
                    {config.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{i18n.t("dataSources.series")}</span>
              <select value={macroSeriesId} onChange={(event) => setMacroSeriesId(event.target.value)}>
                {macroConfig.series.map((series) => (
                  <option key={series.value} value={series.value}>
                    {series.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{i18n.t("dataSources.country")}</span>
              <select value={macroCountry} onChange={(event) => setMacroCountry(event.target.value)}>
                {macroConfig.countries.map((country) => (
                  <option key={country.value} value={country.value}>
                    {country.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <MacroPreview macro={macro} i18n={i18n} /></> : null}
          {previewKind === "equity" ? <><label className="field">
            <span>A-share symbol</span>
            <select value={equitySymbol} onChange={(event) => setEquitySymbol(event.target.value)}>
              <option value="600519.SH">600519.SH / Kweichow Moutai</option>
              <option value="000001.SZ">000001.SZ / Ping An Bank</option>
              <option value="300750.SZ">300750.SZ / CATL</option>
            </select>
          </label>
          <EquityPreview equityQuote={equityQuote} tushareStatus={tushareStatus} i18n={i18n} /></> : null}
          {previewKind === "crypto" ? <CryptoPreview crypto={crypto} coingeckoStatus={coingeckoStatus} i18n={i18n} /> : null}
          {previewKind === "news" ? <><label className="field">
            <span>{i18n.t("dataSources.eventQuery")}</span>
            <input value={newsQuery} onChange={(event) => setNewsQuery(event.target.value)} />
          </label>
          <NewsPreview news={news} i18n={i18n} /></> : null}
          {previewKind === "unsupported" ? (
            <InlineState label={`${selectedProvider} does not expose an interactive preview in M1. Review its detail and quality pages instead.`} />
          ) : null}
      </section> : null}

      {routeSection === "dataSourceQuality" ? <section className="card p1-panel data-source-quality p1-source-overview" data-primary-task={routeSection}>
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.t("dataSources.freshness")}</p>
            <h3>{i18n.language === "zh-CN" ? "来源质量与缓存状态" : "Source quality and cache state"}</h3>
          </div>
        </div>
        {sourceStatus.loading && !sourceStatus.data ? <InlineState label={i18n.t("dataSources.waiting")} /> : null}
        {sourceStatus.error ? <InlineState label={sourceStatus.error} actionLabel="Retry" onAction={sourceStatus.reload} /> : null}
        <div className="stack-layout">
          {providerItems.map((provider) => (
            <article className="data-preview-block" key={provider.provider} aria-label={`data-source-quality provider=${provider.provider} health=${provider.health} freshness=${provider.freshness_state}`}>
              <div className="p1-section-heading">
                <div><strong>{provider.label}</strong><p className="source-copy">{provider.provider}</p></div>
                <span className={`mini-pill ${statusTone(provider.health, provider.stale)}`}>{provider.health}</span>
              </div>
              <ProviderStatusPanel status={provider} catalog={catalogMap.get(provider.provider)} i18n={i18n} />
            </article>
          ))}
        </div>
      </section> : null}

      {routeSection === "dataSourcesReport" ? <section className="card p1-panel data-sources-report p1-source-overview" data-primary-task={routeSection}>
        <div className="p1-section-heading">
          <div>
            <p className="eyebrow">{i18n.t("dataSources.exportReport")}</p>
            <h3>{i18n.language === "zh-CN" ? "覆盖与新鲜度报告" : "Coverage and freshness report"}</h3>
          </div>
          <button
            aria-label={`data-source-report-export busy=${exportBusy}`}
            className="primary-button"
            type="button"
            disabled={exportBusy}
            onClick={() => void exportReport()}
          >
            <Download size={16} />
            {exportBusy ? i18n.t("dataSources.exporting") : i18n.t("dataSources.exportReport")}
          </button>
        </div>
        <div className="source-contract-grid" aria-label={`data-source-report-summary providers=${catalogProviders.length} read_only=${readOnlyProviderCount} live_trading=${liveTradingProviderCount} credential_gated=${credentialGatedProviderCount}`}>
          <Metric label="Catalog providers" value={String(catalogProviders.length)} />
          <Metric label="Read-only contracts" value={`${readOnlyProviderCount}/${catalogProviders.length}`} />
          <Metric label="Live trading paths" value={String(liveTradingProviderCount)} />
          <Metric label="Credential-gated" value={String(credentialGatedProviderCount)} />
        </div>
        {exportPath ? <p aria-label="data-source-report-export-path" className="panel-note">{i18n.t("dataSources.exported")}: {exportPath}</p> : null}
        {exportError ? <InlineState label={`${i18n.t("dataSources.exportFailed")}: ${exportError}`} /> : null}
      </section> : null}
    </div>
  );
}

function isKeyedSource(provider: string): boolean {
  return provider === "fred" || provider === "coingecko" || provider === "tushare";
}

function credentialPrimaryLabel(provider: string): string {
  if (provider === "fred") return "FRED API key";
  if (provider === "tushare") return "Tushare token";
  return "CoinGecko demo key";
}

function ProviderStatusPanel({
  status,
  catalog,
  i18n,
}: {
  status: DataSourceRuntimeStatus;
  catalog: ConnectionsCatalogResponse["providers"][number] | null | undefined;
  i18n: ReturnType<typeof useI18n>;
}) {
  return (
    <DataStatusStrip
      ariaLabel={`data-source-status-strip provider=${status.provider} health=${status.health} freshness=${status.freshness_state} stale=${String(status.stale)} read_only=${String(catalog?.read_only ?? true)} live_trading=${String(catalog?.live_trading ?? false)}`}
      items={[
        { label: "Health", value: status.health, detail: status.message, tone: statusTone(status.health, status.stale) },
        {
          label: i18n.t("dataSources.credentials"),
          value: status.requires_credentials ? i18n.t("dataSources.required") : i18n.t("dataSources.notRequired"),
          detail: status.configured ? "configured" : "no local secret material exposed",
          tone: status.requires_credentials && !status.configured ? "credential_required" : "observed",
        },
        {
          label: i18n.t("dataSources.freshness"),
          value: formatFreshnessState(status.freshness_state),
          detail: freshnessDetail(status),
          tone: freshnessTone(status.freshness_state),
        },
        {
          label: "Quality",
          value: status.data_quality?.overall ?? "unknown",
          detail: status.data_quality
            ? `${status.data_quality.completeness.level} completeness; ${status.data_quality.source_confidence.level} source confidence.`
            : "No structured quality contract attached.",
          tone: qualityTone(status.data_quality?.overall),
        },
        {
          label: "Boundary",
          value: catalog?.read_only === false ? "mutation capable" : "read-only",
          detail: catalog?.live_trading ? "live trading path; protected by execution gates" : "no live trading path",
          tone: catalog?.live_trading ? "blocked" : "audited",
        },
      ]}
    />
  );
}

function formatFreshnessState(state: FreshnessState): string {
  return state.replace("_", " ");
}

function freshnessDetail(status: DataSourceRuntimeStatus): string {
  const age = status.cache_age_seconds == null ? "no cached success yet" : `cache age ${formatDuration(status.cache_age_seconds)}`;
  const ttl =
    status.freshness?.cache_ttl_seconds == null ? "TTL not specified" : `TTL ${formatDuration(status.freshness.cache_ttl_seconds)}`;
  const behavior = status.freshness_state === "credential_required" ? status.freshness?.refresh_behavior : status.freshness?.offline_behavior;
  return [age, ttl, behavior].filter(Boolean).join("; ");
}

function freshnessTone(state: FreshnessState) {
  if (state === "fresh") return "observed";
  if (state === "cached" || state === "stale" || state === "refresh_failed") return "cached";
  if (state === "credential_required") return "credential_required";
  if (state === "offline" || state === "unavailable") return "degraded";
  if (state === "unsupported") return "blocked";
  return "audited";
}

function qualityTone(level: DataQualityLevel | undefined) {
  if (level === "complete") return "observed";
  if (level === "partial") return "cached";
  if (level === "limited") return "degraded";
  if (level === "blocked") return "blocked";
  return "audited";
}

function statusTone(health: DataSourceRuntimeStatus["health"], stale: boolean) {
  if (stale || health === "cached") {
    return "cached";
  }
  if (health === "missing_credentials") {
    return "credential_required";
  }
  if (health === "error" || health === "unavailable") {
    return "degraded";
  }
  if (health === "unsupported" || health === "planned") {
    return "blocked";
  }
  return "observed";
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function MacroPreview({ macro, i18n }: { macro: AsyncResource<MacroSeriesResponse>; i18n: ReturnType<typeof useI18n> }) {
  if (macro.loading) return <InlineState label={i18n.t("dataSources.loadingMacro")} />;
  if (macro.error) return <InlineState label={macro.error} actionLabel={i18n.t("dataSources.retryMacro")} onAction={macro.reload} />;
  if (!macro.data) return null;
  return (
    <div className="data-preview-block" aria-label={`data-source-preview kind=macro state=${macro.data.provenance.freshness_state} provider=${macro.data.provider}`}>
      <div className="capability-block-head">
        <strong>{macro.data.title}</strong>
        <span className={`mini-pill ${macro.data.provenance.stale ? "status-cached" : "status-ok"}`}>
          {macro.data.provenance.stale ? formatFreshnessState(macro.data.provenance.freshness_state) : macro.data.provider}
        </span>
      </div>
      <table className="macro-series-table">
        <tbody>
          {macro.data.observations.map((point) => (
            <tr key={point.date}>
              <th>{point.date}</th>
              <td>{point.value == null ? "--" : formatNumber(point.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SourceLine provenance={macro.data.provenance} i18n={i18n} />
    </div>
  );
}

function EquityPreview({
  equityQuote,
  tushareStatus,
  i18n,
}: {
  equityQuote: AsyncResource<EquityQuoteResponse>;
  tushareStatus: DataSourceRuntimeStatus | null;
  i18n: ReturnType<typeof useI18n>;
}) {
  if (tushareStatus && !tushareStatus.configured) {
    return (
      <div className="data-preview-block" aria-label="data-source-preview kind=equity state=missing_credentials provider=tushare">
        <div className="capability-block-head">
          <strong>A-share context</strong>
          <span className="mini-pill status-missing_credentials">{i18n.t("dataSources.credentialRequired")}</span>
        </div>
        <p>{tushareStatus.message}</p>
        <div className="sample-state-grid">
          <div>
            <strong>600519.SH / 000001.SZ / 300750.SZ</strong>
            <span>Read-only research seeds remain visible without changing the default watchlist.</span>
          </div>
          <div>
            <strong>Boundary</strong>
            <span>No A-share or HK trading path is exposed.</span>
          </div>
        </div>
      </div>
    );
  }
  if (equityQuote.loading) return <InlineState label="Loading A-share quote..." />;
  if (equityQuote.error) return <InlineState label={equityQuote.error} actionLabel="Retry A-share" onAction={equityQuote.reload} />;
  if (!equityQuote.data) return null;
  return (
    <div
      className="data-preview-block"
      aria-label={`data-source-preview kind=equity state=${equityQuote.data.provenance.freshness_state} provider=${equityQuote.data.provider} read_only=${String(equityQuote.data.read_only)} live_trading=${String(equityQuote.data.live_trading)}`}
    >
      <div className="capability-block-head">
        <strong>{equityQuote.data.name ?? equityQuote.data.symbol}</strong>
        <span className={`mini-pill ${equityQuote.data.provenance.stale ? "status-cached" : "status-ok"}`}>
          {equityQuote.data.provenance.stale ? formatFreshnessState(equityQuote.data.provenance.freshness_state) : equityQuote.data.provider}
        </span>
      </div>
      <div className="mini-table">
        <span>
          <strong>{equityQuote.data.symbol}</strong>
          {equityQuote.data.price == null ? "--" : `${formatNumber(equityQuote.data.price)} ${equityQuote.data.currency}`}
        </span>
        <span>
          <strong>Change</strong>
          {equityQuote.data.change_pct == null ? "--" : `${formatNumber(equityQuote.data.change_pct)}%`}
        </span>
        <span>
          <strong>Write</strong>
          {equityQuote.data.write_status}
        </span>
      </div>
      <p className="source-line">{equityQuote.data.unsupported_trading_reason}</p>
      <SourceLine provenance={equityQuote.data.provenance} i18n={i18n} />
    </div>
  );
}

function CryptoPreview({
  crypto,
  coingeckoStatus,
  i18n,
}: {
  crypto: AsyncResource<CryptoMarketsResponse>;
  coingeckoStatus: DataSourceRuntimeStatus | null;
  i18n: ReturnType<typeof useI18n>;
}) {
  if (coingeckoStatus && !coingeckoStatus.configured) {
    return (
      <div className="data-preview-block" aria-label="data-source-preview kind=crypto state=missing_credentials provider=coingecko">
        <div className="capability-block-head">
          <strong>{i18n.t("dataSources.cryptoContext")}</strong>
          <span className="mini-pill status-missing_credentials">{i18n.t("dataSources.credentialRequired")}</span>
        </div>
        <p>{coingeckoStatus.message}</p>
        <div className="sample-state-grid">
          <div>
            <strong>BTC / ETH / SOL</strong>
            <span>{i18n.t("dataSources.cryptoSampleCopy")}</span>
          </div>
          <div>
            <strong>Boundary</strong>
            <span>{i18n.t("dataSources.cryptoSampleBoundary")}</span>
          </div>
        </div>
      </div>
    );
  }
  if (crypto.loading) return <InlineState label={i18n.t("dataSources.loadingCrypto")} />;
  if (crypto.error) {
    return (
      <div className="data-preview-block" aria-label="data-source-preview kind=crypto state=error provider=coingecko">
        <InlineState label={crypto.error} actionLabel={i18n.t("dataSources.retryCrypto")} onAction={crypto.reload} />
      </div>
    );
  }
  if (!crypto.data) return null;
  return (
    <div className="data-preview-block" aria-label={`data-source-preview kind=crypto state=${crypto.data.provenance.freshness_state} provider=${crypto.data.provider}`}>
      <div className="capability-block-head">
        <strong>{i18n.t("dataSources.cryptoContext")}</strong>
        <span className={`mini-pill ${crypto.data.provenance.stale ? "status-cached" : "status-ok"}`}>
          {crypto.data.provenance.stale ? formatFreshnessState(crypto.data.provenance.freshness_state) : crypto.data.provider}
        </span>
      </div>
      <div className="mini-table">
        {crypto.data.assets.map((asset) => (
          <span key={asset.id}>
            <strong>{asset.symbol}</strong>
            {asset.price_usd == null ? "--" : `$${formatNumber(asset.price_usd)}`}
          </span>
        ))}
      </div>
      <SourceLine provenance={crypto.data.provenance} i18n={i18n} />
    </div>
  );
}

function NewsPreview({ news, i18n }: { news: AsyncResource<NewsEventsResponse>; i18n: ReturnType<typeof useI18n> }) {
  if (news.loading) return <InlineState label={i18n.t("dataSources.loadingNews")} />;
  if (news.error) return <InlineState label={news.error} actionLabel={i18n.t("dataSources.retryNews")} onAction={news.reload} />;
  if (!news.data) return null;
  return (
    <div className="event-list" aria-label={`data-source-preview kind=news state=${news.data.provenance.freshness_state} provider=${news.data.provider}`}>
      {news.data.events.map((event) => (
        <a className="event-row" href={event.url} key={`${event.title}-${event.published_at}`} target="_blank" rel="noreferrer">
          <ShieldCheck size={16} />
          <span>
            <strong>{event.title}</strong>
            <small>{event.source}{event.published_at ? ` / ${event.published_at}` : ""}</small>
          </span>
        </a>
      ))}
      <SourceLine provenance={news.data.provenance} i18n={i18n} />
    </div>
  );
}

function SourceLine({
  provenance,
  i18n,
}: {
  provenance: { provider: string; label: string; fetched_at: string | null; source_url: string; stale: boolean; freshness_state: FreshnessState; cache_age_seconds: number | null; unavailable_reason: string | null };
  i18n: ReturnType<typeof useI18n>;
}) {
  return (
    <p className="source-line" aria-label={`data-source-provenance provider=${provenance.provider} freshness=${provenance.freshness_state} stale=${provenance.stale}`}>
      {provenance.label} / {formatFreshnessState(provenance.freshness_state)} / {provenance.fetched_at ?? i18n.t("dataSources.notFetched")}
      {provenance.cache_age_seconds == null ? "" : ` / cache age ${formatDuration(provenance.cache_age_seconds)}`}
      {provenance.unavailable_reason ? ` / ${provenance.unavailable_reason}` : ""}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}
