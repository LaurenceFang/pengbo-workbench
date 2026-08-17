import { Plus, RefreshCcw, Save, Trash2, UserCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAsyncResource } from "../hooks/use-async-resource";
import { usePengboNavigation } from "../hooks/use-pengbo-navigation";
import { InlineState, PanelState } from "../components/shared";
import { Badge } from "../components/ui-kit";
import { useI18n } from "../i18n";
import {
  api,
  type BinanceAccountSnapshot,
  type CredentialActionKind,
  type CredentialState,
  type ConnectionStatusItem,
  type ConnectionTestResponse,
  type ProviderCapability,
  type ProviderCapabilityProviderItem,
} from "../lib/api";
import { isTauriRuntime, type RuntimeConfig } from "../lib/runtime";
import { useRouteContext } from "../routes/route-context";
import type { LanguagePreference } from "../store/app-store";

export type ConnectionsRouteSection =
  | "connectionsCatalog"
  | "connectionDetail"
  | "connectionCredentials"
  | "connectionHealth";

export function ConnectionsView({ onRestart, onGlobalRefresh, runtime, routeSection }: { onRestart: () => Promise<void>; onGlobalRefresh: () => Promise<void>; runtime: RuntimeConfig | null; routeSection: ConnectionsRouteSection }) {
  const i18n = useI18n();
  const { params } = useRouteContext();
  const { openRoute } = usePengboNavigation();
  const copy = connectionCopy(i18n.language);
  const catalogEnabled = routeSection === "connectionsCatalog";
  const detailEnabled = routeSection === "connectionDetail";
  const credentialsEnabled = routeSection === "connectionCredentials";
  const healthEnabled = routeSection === "connectionHealth";
  const providerRequestsEnabled = runtime?.mode !== "tauri" || runtime?.sidecarStatus === "online";
  const status = useAsyncResource(async () => api.getConnectionsStatus(), [], { enabled: providerRequestsEnabled && (catalogEnabled || detailEnabled || credentialsEnabled || healthEnabled) });
  const catalog = useAsyncResource(async () => api.getConnectionsCatalog(), [], { enabled: providerRequestsEnabled && (catalogEnabled || detailEnabled) });
  const [edgarIdentity, setEdgarIdentity] = useState("");
  const edgarIdentityRef = useRef<HTMLInputElement | null>(null);
  const [binanceApiKey, setBinanceApiKey] = useState("");
  const [binanceSecret, setBinanceSecret] = useState("");
  const [binancePassword, setBinancePassword] = useState("");
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [clearingProvider, setClearingProvider] = useState<string | null>(null);
  const [profileLabel, setProfileLabel] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [latestTests, setLatestTests] = useState<Record<string, ConnectionTestResponse>>({});
  const providerMap = useMemo(() => new Map((status.data?.providers ?? []).map((item) => [item.provider, item] as const)), [status.data?.providers]);
  const catalogMap = useMemo(() => new Map((catalog.data?.providers ?? []).map((item) => [item.provider, item] as const)), [catalog.data?.providers]);
  const edgarStatus = providerMap.get("edgar");
  const binanceStatus = providerMap.get("binance");
  const activeProfile = status.data?.active_profile ?? null;
  const activeProfileId = activeProfile?.profile_id ?? "local_default";
  const [binanceAccountRequested, setBinanceAccountRequested] = useState(false);
  const binanceAccount = useAsyncResource<BinanceAccountSnapshot>(async () => api.getBinanceAccount(), [], { enabled: providerRequestsEnabled && credentialsEnabled && Boolean(binanceStatus?.configured) && binanceAccountRequested });
  const binanceDirty = binanceApiKey.trim().length > 0 || binanceSecret.trim().length > 0 || binancePassword.trim().length > 0;
  const routeProvider = detailEnabled ? params.provider ?? "" : "";
  const detailProviders = routeProvider && !["providers", "credentials", "health"].includes(routeProvider)
    ? (status.data?.providers ?? []).filter((item) => item.provider === routeProvider)
    : (status.data?.providers ?? []).slice(0, 1);

  function clearLatestTest(provider: string) { setLatestTests((current) => { const next = { ...current }; delete next[provider]; return next; }); }
  async function refreshProviderPanels() { status.reload(); catalog.reload(); await onGlobalRefresh(); }

  async function handleSave(provider: "edgar" | "binance") {
    setSavingProvider(provider);
    try {
      if (provider === "edgar") {
        const identity = (edgarIdentity || edgarIdentityRef.current?.value || "").trim();
        if (!identity) throw new Error(copy.edgarIdentityRequired);
        await api.saveConnectionSecret("edgar", { identity }, activeProfileId);
        setEdgarIdentity("");
        if (edgarIdentityRef.current) edgarIdentityRef.current.value = "";
      } else {
        await api.saveConnectionSecret("binance", { apiKey: binanceApiKey.trim(), secret: binanceSecret.trim(), password: binancePassword.trim() || undefined }, activeProfileId);
        setBinanceApiKey(""); setBinanceSecret(""); setBinancePassword("");
      }
      await onRestart(); await handleTest(provider); await refreshProviderPanels();
    } catch (error) {
      setLatestTests((current) => ({ ...current, [provider]: buildErrorTest(provider, error, copy.saveFailed, i18n.language) }));
    } finally { setSavingProvider(null); }
  }

  async function handleTest(provider: string) {
    if (provider !== "edgar" && provider !== "binance") return;
    setTestingProvider(provider);
    try {
      const result = await api.testConnection(provider);
      setLatestTests((current) => ({ ...current, [provider]: result }));
      status.reload(); catalog.reload();
      if (provider === "binance" && result.status === "ok") {
        setBinanceAccountRequested(true);
        binanceAccount.reload();
      }
    } catch (error) {
      setLatestTests((current) => ({ ...current, [provider]: buildErrorTest(provider, error, copy.testFailed, i18n.language) }));
    } finally { setTestingProvider(null); }
  }

  async function handleClear(provider: "edgar" | "binance") {
    setClearingProvider(provider);
    try {
      await api.clearConnectionSecret(provider, activeProfileId); await onRestart(); await api.clearConnectionProfile(provider); clearLatestTest(provider);
      if (provider === "edgar") setEdgarIdentity(""); else { setBinanceApiKey(""); setBinanceSecret(""); setBinancePassword(""); setBinanceAccountRequested(false); }
      await refreshProviderPanels();
    } catch (error) {
      setLatestTests((current) => ({ ...current, [provider]: buildErrorTest(provider, error, copy.clearFailed, i18n.language) }));
    } finally { setClearingProvider(null); }
  }

  async function handleCreateProfile() {
    const label = profileLabel.trim();
    if (!label) { setProfileMessage(copy.profileRequired); return; }
    setProfileBusy(true);
    try {
      const profile = await api.createConnectionProfile(label); await api.setActiveConnectionProfile(profile.profile_id); setProfileLabel(""); setProfileMessage(`${copy.activeProfile}: ${profile.label}`); await onRestart(); await refreshProviderPanels();
    } catch (error) { setProfileMessage(error instanceof Error ? error.message : copy.profileCreateFailed); }
    finally { setProfileBusy(false); }
  }

  async function handleSelectProfile(profileId: string) {
    if (!profileId || profileId === activeProfileId) return;
    setProfileBusy(true);
    try { const profile = await api.setActiveConnectionProfile(profileId); setProfileMessage(`${copy.activeProfile}: ${profile.label}`); setLatestTests({}); await onRestart(); await refreshProviderPanels(); }
    catch (error) { setProfileMessage(error instanceof Error ? error.message : copy.profileSwitchFailed); }
    finally { setProfileBusy(false); }
  }

  return (
    <div className="p2-page p2-connections-page stack-layout" data-route-section={routeSection}>
      <header className="p2-page-header"><div><p className="eyebrow">{copy.eyebrow}</p><h2>{copy.title}</h2><p className="p2-page-description">{copy.description}</p></div><div className="p2-page-header-meta"><Badge tone={runtime?.sidecarStatus === "online" ? "success" : runtime?.sidecarStatus === "offline" ? "danger" : "warning"}>{runtime?.sidecarStatus ? copy.runtimeStatus[runtime.sidecarStatus] ?? runtime.sidecarStatus : copy.starting}</Badge><span className="p2-header-count">{copy.profile}: {activeProfile?.label ?? copy.localDefault}</span></div></header>
      {!isTauriRuntime() ? <PanelState title={copy.desktopOnlyTitle} copy={copy.desktopOnlyCopy} /> : null}

      {routeSection === "connectionsCatalog" ? <section className="card p2-section-card p2-primary-section" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{copy.providers}</p><h3>{copy.providerCoverage}</h3></div><button className="ghost-button" type="button" onClick={() => void refreshProviderPanels()}><RefreshCcw size={16} />{copy.refresh}</button></div>
        {runtime?.sidecarStatus === "offline" ? <InlineState label={runtime.lastError ?? copy.sidecarOffline} /> : null}
        {!providerRequestsEnabled ? <InlineState label={copy.waitingForSidecar} /> : null}
        {providerRequestsEnabled && status.loading && !status.data ? <InlineState label={copy.loadingProviderStatus} /> : null}
        {providerRequestsEnabled && status.error ? <InlineState label={status.error} actionLabel={copy.retry} onAction={status.reload} /> : null}
        {providerRequestsEnabled && catalog.error ? <InlineState label={catalog.error} actionLabel={copy.retryCatalog} onAction={catalog.reload} /> : null}
        <div className="connection-grid">{(status.data?.providers ?? []).map((item) => <article aria-label={`connection-catalog-provider provider=${item.provider} health=${item.health}`} className="connection-card" key={item.provider}><div className="connection-head"><div><strong>{item.label}</strong><span>{item.provider}</span></div><span className={`mini-pill status-${item.health}`}>{translateHealth(item.health, i18n.language)}</span></div><p>{catalogMap.get(item.provider)?.description ?? item.last_message ?? copy.loadingProviderStatus}</p><div className="form-actions"><button className="ghost-button" type="button" onClick={() => openRoute(`/settings/connections/${encodeURIComponent(item.provider)}`)}>{i18n.language === "zh-CN" ? "打开连接详情" : "Open connection detail"}</button></div></article>)}</div>
      </section> : null}

      {routeSection === "connectionDetail" ? <section className="card p2-section-card p2-primary-section" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{copy.providers}</p><h3>{routeProvider || copy.providerCoverage}</h3></div><button className="ghost-button" type="button" onClick={() => void refreshProviderPanels()}><RefreshCcw size={16} />{copy.refresh}</button></div>
        {detailProviders.length === 0 ? <InlineState label={status.loading ? copy.loadingProviderStatus : status.error ?? `Unknown provider: ${routeProvider}`} actionLabel={status.error ? copy.retry : undefined} onAction={status.error ? status.reload : undefined} /> : null}
        <div className="connection-grid">{detailProviders.map((item) => <ProviderCard key={item.provider} item={item} catalogItem={catalogMap.get(item.provider)} testResult={latestTests[item.provider]} />)}</div>
      </section> : null}

      {routeSection === "connectionCredentials" ? <section className="card p2-section-card p2-risk-section" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{copy.localProfile}</p><h3>{copy.profileScope}</h3></div><span className="mini-pill" aria-label={`connection-active-profile id=${activeProfileId}`}><UserCircle size={14} />{activeProfile?.label ?? copy.localDefault}</span></div>
        <div className="form-grid two-up"><label className="field"><span>{copy.activeProfile}</span><select aria-label="connection-profile-select" disabled={profileBusy || !status.data?.profiles.length} onChange={(event) => void handleSelectProfile(event.target.value)} value={activeProfileId}>{(status.data?.profiles ?? []).map((profile) => <option key={profile.profile_id} value={profile.profile_id}>{profile.label}</option>)}</select><small className="field-note">{copy.profileSwitchNote}</small></label><label className="field"><span>{copy.newProfile}</span><input aria-label="connection-profile-label" onChange={(event) => setProfileLabel(event.target.value)} placeholder={copy.profilePlaceholder} value={profileLabel} /></label></div>
        <div className="form-actions"><button aria-label="connection-profile-create" className="ghost-button" disabled={profileBusy || !profileLabel.trim()} onClick={() => void handleCreateProfile()} type="button"><Plus size={16} />{profileBusy ? copy.updating : copy.createProfile}</button></div>
        {profileMessage ? <InlineState label={profileMessage} /> : null}
        <div className="connector-instructions"><div className="card-header"><div><p className="eyebrow">EDGAR</p><h3>{copy.edgarTitle}</h3></div><span className="mini-pill">{runtime?.mode === "tauri" ? copy.desktop : copy.webPreview}</span></div><CredentialSummaryBanner summary={edgarStatus?.credential_summary ?? latestTests.edgar?.credential_summary ?? null} fallback={copy.noEdgarIdentity} /><div className="form-grid two-up"><label className="field wide"><span>{copy.edgarIdentity}</span><input aria-label="connection-secret provider=edgar field=identity" placeholder="Your Name email@example.com" ref={edgarIdentityRef} onChange={(event) => setEdgarIdentity(event.target.value)} /><small className="field-note">{copy.edgarStoredNote}</small></label></div><ProviderActions provider="edgar" saving={savingProvider === "edgar"} testing={testingProvider === "edgar"} clearing={clearingProvider === "edgar"} canClear={canClearProvider(edgarStatus)} disabled={!isTauriRuntime()} onSave={() => void handleSave("edgar")} onTest={() => void handleTest("edgar")} onClear={() => void handleClear("edgar")} copy={copy} /></div>
        <div className="connector-instructions"><div className="card-header"><div><p className="eyebrow">Binance</p><h3>{copy.binanceTitle}</h3></div><button className="ghost-button" disabled={!binanceStatus?.configured || binanceAccount.loading} type="button" onClick={() => { if (binanceAccountRequested) binanceAccount.reload(); else setBinanceAccountRequested(true); }}><RefreshCcw size={16} />{copy.refreshBalances}</button></div><CredentialSummaryBanner summary={binanceStatus?.credential_summary ?? latestTests.binance?.credential_summary ?? null} fallback={copy.noBinanceCredentials} /><div className="form-grid two-up"><label className="field"><span>{copy.apiKey}</span><input aria-label="connection-secret provider=binance field=api-key" value={binanceApiKey} onChange={(event) => setBinanceApiKey(event.target.value)} /></label><label className="field"><span>{copy.secret}</span><input aria-label="connection-secret provider=binance field=secret" value={binanceSecret} onChange={(event) => setBinanceSecret(event.target.value)} /></label><label className="field wide"><span>{copy.password}</span><input aria-label="connection-secret provider=binance field=password" value={binancePassword} onChange={(event) => setBinancePassword(event.target.value)} /><small className="field-note">{copy.passwordNote}</small></label></div><ProviderActions provider="binance" saving={savingProvider === "binance"} testing={testingProvider === "binance"} clearing={clearingProvider === "binance"} canClear={canClearProvider(binanceStatus)} disabled={!isTauriRuntime()} saveDisabled={!binanceDirty} onSave={() => void handleSave("binance")} onTest={() => void handleTest("binance")} onClear={() => void handleClear("binance")} copy={copy} />{binanceStatus?.configured && binanceAccountRequested ? <div className="holding-list">{binanceAccount.loading ? <InlineState label={copy.loadingBalances} /> : null}{binanceAccount.error ? <InlineState label={binanceAccount.error} /> : null}{binanceAccount.data?.balances.map((balance) => <div key={balance.asset} className="holding-row"><div><strong>{balance.asset}</strong><span>{copy.total} {balance.total.toFixed(6)}</span></div><div className="holding-meta"><span>{copy.free} {balance.free.toFixed(6)}</span><span>{copy.used} {balance.used.toFixed(6)}</span></div></div>)}</div> : null}</div>
      </section> : null}

      {routeSection === "connectionHealth" ? <section className="card p2-section-card p2-primary-section" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{copy.providers}</p><h3>{i18n.language === "zh-CN" ? "连接探测与诊断" : "Connection probes and diagnostics"}</h3></div><button className="ghost-button" type="button" onClick={() => void refreshProviderPanels()}><RefreshCcw size={16} />{copy.refresh}</button></div>
        {status.error ? <InlineState label={status.error} actionLabel={copy.retry} onAction={status.reload} /> : null}
        <div className="connection-grid">{(status.data?.providers ?? []).map((item) => <article className="connection-card" key={item.provider} aria-label={`connection-health provider=${item.provider} health=${item.health}`}><div className="connection-head"><div><strong>{item.label}</strong><span>{item.provider}</span></div><span className={`mini-pill status-${item.health}`}>{translateHealth(item.health, i18n.language)}</span></div><CredentialStatePanel item={mergeProviderState(item, latestTests[item.provider])} /><div className="form-actions">{item.provider === "edgar" || item.provider === "binance" ? <button className="ghost-button" disabled={testingProvider === item.provider} onClick={() => void handleTest(item.provider)} type="button"><RefreshCcw size={16} />{testingProvider === item.provider ? copy.testing : copy.testConnection}</button> : null}</div></article>)}</div>
      </section> : null}
    </div>
  );
}

function ProviderActions({ provider, saving, testing, clearing, canClear, disabled, saveDisabled = false, onSave, onTest, onClear, copy }: { provider: "edgar" | "binance"; saving: boolean; testing: boolean; clearing: boolean; canClear: boolean; disabled: boolean; saveDisabled?: boolean; onSave: () => void; onTest: () => void; onClear: () => void; copy: ReturnType<typeof connectionCopy> }) {
  return <div className="form-actions"><button aria-label={`connection-save provider=${provider}`} className="primary-button" disabled={disabled || saveDisabled || saving || clearing} onClick={onSave} type="button"><Save size={16} />{saving ? copy.saving : copy.saveVerify}</button><button aria-label={`connection-test provider=${provider}`} className="ghost-button" disabled={testing || clearing} onClick={onTest} type="button"><RefreshCcw size={16} />{testing ? copy.testing : copy.testConnection}</button><button aria-label={`connection-clear provider=${provider}`} className="ghost-button danger" disabled={disabled || !canClear || clearing || saving} onClick={onClear} type="button"><Trash2 size={16} />{clearing ? copy.clearing : copy.clearCredentials}</button></div>;
}

function ProviderCard({ item, catalogItem, testResult }: { item: ConnectionStatusItem; catalogItem?: ProviderCapabilityProviderItem; testResult?: ConnectionTestResponse }) {
  const i18n = useI18n();
  const effective = mergeProviderState(item, testResult);
  return <article aria-label={`provider-status provider=${effective.provider} health=${effective.health} configured=${effective.configured}`} className="connection-card"><div className="connection-head"><div><strong>{effective.label}</strong><span>{effective.provider}</span></div><span className={`mini-pill status-${effective.health}`}>{translateHealth(effective.health, i18n.language)}</span></div><p>{effective.last_message ?? (i18n.language === "zh-CN" ? "暂无提供商消息。" : "No provider message yet.")}</p><CredentialStatePanel item={effective} /><div className="connection-metrics"><StatusMetric label={i18n.language === "zh-CN" ? "已配置" : "Configured"} value={effective.configured ? (i18n.language === "zh-CN" ? "已加载到 sidecar" : "Loaded into sidecar") : (i18n.language === "zh-CN" ? "未加载" : "Not loaded")} /><StatusMetric label={i18n.language === "zh-CN" ? "所有者" : "Owner"} value={effective.profile_label} /><StatusMetric label={i18n.language === "zh-CN" ? "最近测试" : "Last test"} value={formatTimestamp(effective.last_tested_at, i18n.language)} /><StatusMetric label={i18n.language === "zh-CN" ? "最近成功" : "Last success"} value={formatTimestamp(effective.last_success_at, i18n.language)} /><StatusMetric label={i18n.language === "zh-CN" ? "缓存新鲜度" : "Cache freshness"} value={formatCacheFreshness(effective, i18n.language)} /></div>{catalogItem ? <SourceMetadataStrip item={catalogItem} /> : null}{catalogItem ? <CapabilityMatrix provider={effective.provider} capabilities={catalogItem.capabilities} /> : null}</article>;
}

function SourceMetadataStrip({ item }: { item: ProviderCapabilityProviderItem }) {
  const { language } = useI18n();
  const zh = language === "zh-CN";
  return <div className="capability-block"><div className="capability-block-head"><strong>{zh ? "来源契约" : "Source contract"}</strong><span className="mini-pill">{formatWriteStatus(item, language)}</span></div><div className="connection-metrics"><StatusMetric label={zh ? "领域" : "Domains"} value={formatMetadataList(item.data_domains, language)} /><StatusMetric label={zh ? "覆盖" : "Coverage"} value={formatMetadataList(item.asset_coverage, language)} /><StatusMetric label={zh ? "地区" : "Regions"} value={formatMetadataList(item.regions, language)} /><StatusMetric label={zh ? "端点" : "Endpoints"} value={formatMetadataList(item.endpoint_coverage, language)} /><StatusMetric label={zh ? "新鲜度" : "Freshness"} value={item.freshness?.expected_lag ?? item.freshness?.label ?? (zh ? "未指定" : "Not specified")} /><StatusMetric label={zh ? "测试" : "Testing"} value={item.testable ? item.test_mode ?? (zh ? "可测试" : "Testable") : (zh ? "计划中" : "Planned")} /></div><p>{item.matrix_summary ?? item.cache_policy ?? item.description ?? (zh ? "尚未登记来源元数据。" : "No source metadata registered.")}</p>{item.execution_boundary ? <p className="capability-boundary">{item.execution_boundary}</p> : null}</div>;
}

function CapabilityMatrix({ provider, capabilities }: { provider: string; capabilities: ProviderCapability[] }) {
  const { language } = useI18n();
  const zh = language === "zh-CN";
  return <div className="capability-block"><div className="capability-block-head"><strong>{zh ? "能力覆盖" : "Capability coverage"}</strong><span className="mini-pill">{capabilities.length} {zh ? "项" : "items"}</span></div><div className="capability-grid">{capabilities.map((capability) => <div aria-label={`provider-capability provider=${provider} capability=${capability.key} status=${capability.status_hint}`} key={capability.key} className="capability-item"><div className="capability-item-head"><strong>{capability.label}</strong><span className={`mini-pill status-${capability.status_hint}`}>{formatCapabilityStatus(capability.status_hint, language)}</span></div><p>{capability.notes[0] ?? capability.unsupported_reason ?? (zh ? "暂无额外说明。" : "No extra note.")}</p><dl className="capability-matrix-details"><div><dt>{zh ? "端点" : "Endpoints"}</dt><dd>{formatMetadataList(capability.endpoint_coverage, language)}</dd></div><div><dt>{zh ? "资产" : "Assets"}</dt><dd>{formatMetadataList(capability.asset_coverage, language)}</dd></div><div><dt>{zh ? "地区" : "Regions"}</dt><dd>{formatMetadataList(capability.regions, language)}</dd></div><div><dt>{zh ? "凭证" : "Credential"}</dt><dd>{capability.requires_credentials ? capability.credential_note ?? (zh ? "需要" : "Required") : (zh ? "不需要" : "Not required")}</dd></div><div><dt>{zh ? "新鲜度" : "Freshness"}</dt><dd>{capability.freshness?.expected_lag ?? capability.freshness?.label ?? (zh ? "未指定" : "Not specified")}</dd></div><div><dt>{zh ? "写入" : "Write"}</dt><dd>{capability.read_only ? (zh ? "只读" : "Read-only") : (zh ? "支持变更" : "Mutation capable")}</dd></div></dl>{capability.unsupported_reason ? <p className="capability-boundary">{capability.unsupported_reason}</p> : null}{capability.decision_note ? <p className="capability-decision">{capability.decision_note}</p> : null}</div>)}</div></div>;
}

function CredentialSummaryBanner({ summary, fallback }: { summary: string | null; fallback: string }) { const { language } = useI18n(); return <div className="credential-banner"><strong>{language === "zh-CN" ? "已存储摘要" : "Stored summary"}</strong><span>{summary ?? fallback}</span></div>; }
function CredentialStatePanel({ item }: { item: ConnectionStatusItem }) { const { language } = useI18n(); return <div aria-label={`credential-state provider=${item.provider} state=${item.credential_state} action=${item.credential_action_kind}`} className={`credential-state-panel credential-state-${item.credential_state}`}><div className="credential-state-head"><div><span>{language === "zh-CN" ? "凭证状态" : "Credential state"}</span><strong>{formatCredentialStateLabel(item.credential_state, item.credential_state_label, language)}</strong></div><span className={`mini-pill ${credentialStateTone(item.credential_state)}`}>{formatCredentialAction(item.credential_action_kind, language)}</span></div><p>{item.credential_next_action}</p>{item.credential_state_reason ? <small>{item.credential_state_reason}</small> : null}</div>; }
function StatusMetric({ label, value }: { label: string; value: string }) { return <div className="status-metric"><span>{label}</span><strong>{value}</strong></div>; }

function buildErrorTest(provider: string, error: unknown, fallbackMessage: string, language: LanguagePreference): ConnectionTestResponse { const zh = language === "zh-CN"; return { provider, status: "error", message: error instanceof Error ? error.message : fallbackMessage, stale: false, requires_credentials: false, credential_state: "invalid", credential_state_label: zh ? "需要处理" : "Needs attention", credential_next_action: zh ? "检查本地错误，然后重试提供商操作。" : "Check the local error and retry the provider action.", credential_action_kind: "check_permissions", credential_state_reason: error instanceof Error ? error.message : fallbackMessage, credential_summary: null, last_tested_at: null, last_success_at: null, cache_updated_at: null, cache_age_seconds: null, profile_id: "local_default", profile_label: zh ? "本地默认" : "Local default" }; }
function mergeProviderState(item: ConnectionStatusItem, testResult?: ConnectionTestResponse): ConnectionStatusItem { if (!testResult) return item; return { ...item, health: testResult.status, last_message: testResult.message, stale: testResult.stale, requires_credentials: testResult.requires_credentials, credential_state: testResult.credential_state, credential_state_label: testResult.credential_state_label, credential_next_action: testResult.credential_next_action, credential_action_kind: testResult.credential_action_kind, credential_state_reason: testResult.credential_state_reason, credential_summary: testResult.credential_summary ?? item.credential_summary, last_tested_at: testResult.last_tested_at ?? item.last_tested_at, last_success_at: testResult.last_success_at ?? item.last_success_at, cache_updated_at: testResult.cache_updated_at ?? item.cache_updated_at, cache_age_seconds: testResult.cache_age_seconds ?? item.cache_age_seconds, profile_id: testResult.profile_id ?? item.profile_id, profile_label: testResult.profile_label ?? item.profile_label }; }
function canClearProvider(item: ConnectionStatusItem | undefined): boolean { return Boolean(item?.configured || item?.credential_summary || item?.last_tested_at || item?.last_success_at || item?.cache_updated_at); }
function formatTimestamp(value: string | null, language: LanguagePreference): string { if (!value) return language === "zh-CN" ? "从未" : "Never"; const date = new Date(value); if (Number.isNaN(date.getTime())) return value; return date.toLocaleString(language, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function formatCacheFreshness(item: ConnectionStatusItem, language: LanguagePreference): string { const zh = language === "zh-CN"; if (!item.cache_updated_at || item.cache_age_seconds == null) return zh ? "暂无缓存结果" : "No cached result"; const age = `${formatRelativeDuration(item.cache_age_seconds)} ${zh ? "前" : "ago"}`; return item.health === "cached" ? (zh ? `使用 ${age} 的缓存数据` : `Using cached data from ${age}`) : (zh ? `最近于 ${age} 刷新` : `Last refreshed ${age}`); }
function formatRelativeDuration(totalSeconds: number): string { if (totalSeconds < 60) return `${totalSeconds}s`; if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)}m`; if (totalSeconds < 86400) return `${Math.floor(totalSeconds / 3600)}h`; return `${Math.floor(totalSeconds / 86400)}d`; }
function formatMetadataList(values: string[], language: LanguagePreference): string { return values.length > 0 ? values.join(", ") : language === "zh-CN" ? "未指定" : "Not specified"; }
function credentialStateTone(state: CredentialState): string { switch (state) { case "configured": case "read_only": return "status-available"; case "trading_gated": case "missing": case "expired": return "status-credential_required"; case "invalid": case "disabled": case "blocked": return "status-error"; default: return "status-planned"; } }
function formatCredentialStateLabel(state: CredentialState, fallback: string, language: LanguagePreference): string { if (language !== "zh-CN") return fallback; return { configured: "已配置", read_only: "只读", trading_gated: "交易受限", missing: "缺少凭证", expired: "凭证已过期", invalid: "无效", disabled: "已禁用", blocked: "已阻止" }[state] ?? fallback; }
function formatCredentialAction(action: CredentialActionKind, language: LanguagePreference): string { const zh = language === "zh-CN"; switch (action) { case "save_credentials": return zh ? "保存" : "Save"; case "test_connection": return zh ? "测试" : "Test"; case "check_permissions": return zh ? "检查" : "Check"; case "refresh_credentials": return zh ? "刷新" : "Refresh"; case "enable_provider": return zh ? "启用" : "Enable"; case "unlock_local": return zh ? "解锁" : "Unlock"; case "confirm_trading_gate": return zh ? "受限" : "Gated"; default: return zh ? "无操作" : "No action"; } }
function formatWriteStatus(item: ProviderCapabilityProviderItem, language: LanguagePreference): string { const zh = language === "zh-CN"; if (item.live_trading) return zh ? "真实交易" : "Live trading"; if (item.write_status === "read_only" || item.read_only) return zh ? "只读" : "Read-only"; return item.write_status; }
function translateHealth(value: string, language: LanguagePreference): string { if (language !== "zh-CN") return ({ ok: "Healthy", cached: "Cached", missing_credentials: "Need creds", error: "Error", unsupported: "Unsupported" } as Record<string, string>)[value] ?? value; return ({ ok: "健康", cached: "缓存", missing_credentials: "需要凭证", error: "错误", unsupported: "不支持" } as Record<string, string>)[value] ?? value; }
function formatCapabilityStatus(value: ProviderCapability["status_hint"], language: LanguagePreference): string { if (language === "zh-CN") return value === "available" ? "可用" : value === "credential_required" ? "需要凭证" : "不支持"; return value === "available" ? "Available" : value === "credential_required" ? "Need creds" : "Unsupported"; }

function connectionCopy(language: LanguagePreference) {
  const zh = language === "zh-CN";
  return {
    eyebrow: zh ? "设置 / 连接" : "Settings / Connections", title: zh ? "提供商连接" : "Provider connections", description: zh ? "管理本地配置、只读提供商覆盖范围和明确受限的凭证。" : "Manage local profiles, read-only provider coverage, and explicitly gated credentials.", localDefault: zh ? "本地默认" : "Local default", profile: zh ? "配置" : "Profile", starting: zh ? "启动中" : "Starting", runtimeStatus: { online: zh ? "在线" : "Online", offline: zh ? "离线" : "Offline", starting: zh ? "启动中" : "Starting" }, desktopOnlyTitle: zh ? "凭证存储只在桌面构建中可用" : "Credential storage is only available in the desktop build", desktopOnlyCopy: zh ? "凭证通过桌面运行时保存，不会经由网页预览往返。" : "Secrets are stored through the desktop runtime so they do not round-trip through the web preview.", localProfile: zh ? "本地配置" : "Local profile", profileScope: zh ? "提供商凭证归属于当前选中的本地配置" : "Provider credentials are scoped to the selected local profile", activeProfile: zh ? "当前配置" : "Active profile", newProfile: zh ? "新建本地配置" : "New local profile", profilePlaceholder: zh ? "研究账户" : "Research account", profileSwitchNote: zh ? "切换配置会重启本地 sidecar，使就绪状态跟随选中的所有者。" : "Switching profiles restarts the local sidecar so readiness follows the selected owner.", updating: zh ? "更新中..." : "Updating...", createProfile: zh ? "创建配置" : "Create profile", profileRequired: zh ? "请先输入本地配置名称。" : "Enter a local profile label first.", profileCreateFailed: zh ? "创建配置失败。" : "Creating profile failed.", profileSwitchFailed: zh ? "切换配置失败。" : "Switching profile failed.", providers: zh ? "提供商" : "Providers", providerCoverage: zh ? "健康状态和能力覆盖现在共用同一组提供商卡片" : "Health status and capability coverage now share the same provider cards", refresh: zh ? "刷新" : "Refresh", retry: zh ? "重试" : "Retry", retryCatalog: zh ? "重试目录" : "Retry catalog", sidecarOffline: zh ? "本地 sidecar 已离线，请重启后再测试提供商。" : "The local sidecar is offline. Restart it before testing providers.", waitingForSidecar: zh ? "等待本地 sidecar 后再加载提供商状态和能力覆盖。" : "Waiting for the local sidecar before loading provider status and capability coverage.", loadingProviderStatus: zh ? "正在加载提供商状态..." : "Loading provider status...", edgarTitle: zh ? "保存 EDGAR 身份、重启并验证实时文件访问" : "Save an EDGAR identity, restart, and verify live filings access", desktop: zh ? "桌面端" : "Desktop", webPreview: zh ? "网页预览" : "Web preview", noEdgarIdentity: zh ? "运行中的 sidecar 当前没有加载 EDGAR 身份。" : "No EDGAR identity is currently loaded in the running sidecar.", edgarIdentity: zh ? "EDGAR 身份" : "EDGAR identity", edgarIdentityRequired: zh ? "保存前请输入 EDGAR 身份。" : "Enter an EDGAR identity before saving.", edgarStoredNote: zh ? "存储的身份会写入 Stronghold，不会回显到表单。" : "Stored identities are written to Stronghold and are not echoed back into the form.", binanceTitle: zh ? "保存 API 凭证，验证私有账户路径和缓存回退" : "Save API credentials and verify the private-account path plus cached fallback", refreshBalances: zh ? "刷新余额" : "Refresh balances", noBinanceCredentials: zh ? "运行中的 sidecar 当前没有加载 Binance 凭证。" : "No Binance credentials are currently loaded in the running sidecar.", apiKey: zh ? "API key" : "API key", secret: zh ? "密钥" : "Secret", password: zh ? "密码（可选）" : "Password (optional)", passwordNote: zh ? "除非 Binance key 配置明确要求，否则留空。" : "Leave this blank unless your Binance key setup explicitly requires it.", saving: zh ? "保存中..." : "Saving...", saveVerify: zh ? "保存并验证" : "Save and verify", testing: zh ? "测试中..." : "Testing...", testConnection: zh ? "测试连接" : "Test connection", clearing: zh ? "清除中..." : "Clearing...", clearCredentials: zh ? "清除已存储凭证" : "Clear stored credentials", loadingBalances: zh ? "正在加载 Binance 余额..." : "Loading Binance balances...", total: zh ? "总计" : "Total", free: zh ? "可用" : "Free", used: zh ? "已用" : "Used", saveFailed: zh ? "保存凭证失败。" : "Saving credentials failed.", testFailed: zh ? "连接测试失败。" : "Connection test failed.", clearFailed: zh ? "清除已存储凭证失败。" : "Clearing stored credentials failed.",
  };
}
