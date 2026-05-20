import { Download, ExternalLink, RefreshCcw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { DataStatusStrip, InlineState } from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import { useI18n } from "../i18n";
import {
  api,
  type ConnectionsCatalogResponse,
  type CryptoMarketsResponse,
  type DataSourceRuntimeStatus,
  type DataSourceStatusResponse,
  type MacroSeriesResponse,
  type NewsEventsResponse,
} from "../lib/api";
import type { BackendStatus } from "../components/shared";
import { isTauriRuntime } from "../lib/runtime";

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
};
type AsyncResource<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

export function DataSourcesView({ backendStatus }: { backendStatus: BackendStatus }) {
  const i18n = useI18n();
  const [selectedProvider, setSelectedProvider] = useState(DEFAULT_PROVIDER);
  const [macroProvider, setMacroProvider] = useState("worldbank");
  const [macroSeriesId, setMacroSeriesId] = useState("NY.GDP.MKTP.CD");
  const [macroCountry, setMacroCountry] = useState("CN");
  const [newsQuery, setNewsQuery] = useState("market OR earnings");
  const [exportBusy, setExportBusy] = useState(false);
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [providerApiKey, setProviderApiKey] = useState("");
  const [providerProKey, setProviderProKey] = useState("");
  const [credentialBusy, setCredentialBusy] = useState<string | null>(null);
  const [credentialMessage, setCredentialMessage] = useState<string | null>(null);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const macroConfig = MACRO_SOURCE_CONFIG[macroProvider] ?? MACRO_SOURCE_CONFIG.worldbank;
  const macroApiSeriesId = macroConfig.buildSeriesId(macroSeriesId, macroCountry);
  const sourceStatus = useAsyncResource<DataSourceStatusResponse>(async () => api.getDataSourceStatus(), [], {
    enabled: backendStatus === "online",
  });
  const catalog = useAsyncResource<ConnectionsCatalogResponse>(async () => api.getConnectionsCatalog(), [], {
    enabled: backendStatus === "online",
  });
  const macro = useAsyncResource<MacroSeriesResponse>(
    async () => api.getMacroSeries({ provider: macroProvider, seriesId: macroApiSeriesId, country: macroCountry, limit: 8 }),
    [macroProvider, macroApiSeriesId, macroCountry],
    { enabled: backendStatus === "online" },
  );
  const providerItems = sourceStatus.data?.providers ?? [];
  const coingeckoStatus = providerItems.find((item) => item.provider === "coingecko") ?? null;
  const coingeckoConfigured = coingeckoStatus?.configured ?? false;
  const crypto = useAsyncResource<CryptoMarketsResponse>(
    async () => api.getCryptoMarkets({ ids: "bitcoin,ethereum,solana", limit: 3 }),
    [coingeckoConfigured],
    { enabled: backendStatus === "online" && coingeckoConfigured },
  );
  const news = useAsyncResource<NewsEventsResponse>(
    async () => api.getNewsEvents({ query: newsQuery, limit: 8 }),
    [newsQuery],
    { enabled: backendStatus === "online" },
  );

  const selectedStatus = providerItems.find((item) => item.provider === selectedProvider) ?? providerItems[0] ?? null;
  const catalogMap = useMemo(
    () => new Map((catalog.data?.providers ?? []).map((item) => [item.provider, item] as const)),
    [catalog.data?.providers],
  );
  const selectedCatalog = selectedStatus ? catalogMap.get(selectedStatus.provider) : null;

  async function refreshAll() {
    sourceStatus.reload();
    catalog.reload();
    macro.reload();
    crypto.reload();
    news.reload();
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
    <div className="data-sources-page" aria-label={`data-sources-view providers=${providerItems.length} selected=${selectedProvider}`}>
      <section className="card data-source-overview">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("dataSources.eyebrow")}</p>
            <h3>{i18n.t("dataSources.title")}</h3>
          </div>
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={refreshAll}>
              <RefreshCcw size={16} />
              {i18n.t("dataSources.refresh")}
            </button>
            <button
              aria-label={`data-source-report-export busy=${exportBusy}`}
              className="ghost-button"
              type="button"
              disabled={exportBusy}
              onClick={() => void exportReport()}
            >
              <Download size={16} />
              {exportBusy ? i18n.t("dataSources.exporting") : i18n.t("dataSources.exportReport")}
            </button>
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
              onClick={() => setSelectedProvider(provider.provider)}
            >
              <span>
                <strong>{provider.label}</strong>
                <small>{provider.provider}</small>
              </span>
              <span className={`mini-pill status-${provider.health}`}>{provider.health}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="data-source-main">
        <section className="card data-source-detail">
          <div className="card-header">
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
                    <span>{selectedStatus.provider === "fred" ? "FRED API key" : "CoinGecko demo key"}</span>
                    <input
                      aria-label={`data-source-secret provider=${selectedStatus.provider} field=api-key`}
                      value={providerApiKey}
                      onChange={(event) => setProviderApiKey(event.target.value)}
                    />
                  </label>
                  {selectedStatus.provider === "coingecko" ? (
                    <label className="field">
                      <span>CoinGecko pro key (optional)</span>
                      <input
                        aria-label="data-source-secret provider=coingecko field=pro-key"
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
        </section>

        <section className="card data-source-preview">
          <div className="card-header">
            <div>
              <p className="eyebrow">{i18n.t("dataSources.previewEyebrow")}</p>
              <h3>{i18n.t("dataSources.previewTitle")}</h3>
            </div>
          </div>
          <div className="form-grid three-up">
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
          <MacroPreview macro={macro} i18n={i18n} />
          <CryptoPreview crypto={crypto} coingeckoStatus={coingeckoStatus} i18n={i18n} />
          <label className="field">
            <span>{i18n.t("dataSources.eventQuery")}</span>
            <input value={newsQuery} onChange={(event) => setNewsQuery(event.target.value)} />
          </label>
          <NewsPreview news={news} i18n={i18n} />
        </section>
      </div>
    </div>
  );
}

function isKeyedSource(provider: string): boolean {
  return provider === "fred" || provider === "coingecko";
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
      ariaLabel={`data-source-status-strip provider=${status.provider} health=${status.health} stale=${String(status.stale)} read_only=${String(catalog?.read_only ?? true)} live_trading=${String(catalog?.live_trading ?? false)}`}
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
          value: status.cache_updated_at ?? "--",
          detail: status.stale ? "cached or stale source context" : "observed provider state",
          tone: status.stale ? "cached" : "observed",
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

function MacroPreview({ macro, i18n }: { macro: AsyncResource<MacroSeriesResponse>; i18n: ReturnType<typeof useI18n> }) {
  if (macro.loading) return <InlineState label={i18n.t("dataSources.loadingMacro")} />;
  if (macro.error) return <InlineState label={macro.error} actionLabel={i18n.t("dataSources.retryMacro")} onAction={macro.reload} />;
  if (!macro.data) return null;
  return (
    <div className="data-preview-block" aria-label={`data-source-preview kind=macro state=${macro.data.provenance.stale ? "cached" : "ok"} provider=${macro.data.provider}`}>
      <div className="capability-block-head">
        <strong>{macro.data.title}</strong>
        <span className={`mini-pill ${macro.data.provenance.stale ? "status-cached" : "status-ok"}`}>
          {macro.data.provenance.stale ? "cached" : macro.data.provider}
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
  if (crypto.error) return <InlineState label={crypto.error} actionLabel={i18n.t("dataSources.retryCrypto")} onAction={crypto.reload} />;
  if (!crypto.data) return null;
  return (
    <div className="data-preview-block" aria-label={`data-source-preview kind=crypto state=${crypto.data.provenance.stale ? "cached" : "ok"} provider=${crypto.data.provider}`}>
      <div className="capability-block-head">
        <strong>{i18n.t("dataSources.cryptoContext")}</strong>
        <span className={`mini-pill ${crypto.data.provenance.stale ? "status-cached" : "status-ok"}`}>
          {crypto.data.provenance.stale ? "cached" : crypto.data.provider}
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
    <div className="event-list" aria-label={`data-source-preview kind=news state=${news.data.provenance.stale ? "cached" : "ok"} provider=${news.data.provider}`}>
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
  provenance: { provider: string; label: string; fetched_at: string | null; source_url: string; stale: boolean; unavailable_reason: string | null };
  i18n: ReturnType<typeof useI18n>;
}) {
  return (
    <p className="source-line" aria-label={`data-source-provenance provider=${provenance.provider} stale=${provenance.stale}`}>
      {provenance.label} / {provenance.fetched_at ?? i18n.t("dataSources.notFetched")}
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
