import { Plus, RefreshCcw, Save, Trash2, UserCircle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAsyncResource } from "../hooks/use-async-resource";
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
import { InlineState, PanelState } from "../components/shared";

export function ConnectionsView({
  onRestart,
  onGlobalRefresh,
  runtime,
}: {
  onRestart: () => Promise<void>;
  onGlobalRefresh: () => Promise<void>;
  runtime: RuntimeConfig | null;
}) {
  const providerRequestsEnabled = runtime?.mode !== "tauri" || runtime?.sidecarStatus === "online";
  const status = useAsyncResource(async () => api.getConnectionsStatus(), [], {
    enabled: providerRequestsEnabled,
  });
  const catalog = useAsyncResource(async () => api.getConnectionsCatalog(), [], {
    enabled: providerRequestsEnabled,
  });
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

  const providerMap = useMemo(
    () => new Map((status.data?.providers ?? []).map((item) => [item.provider, item] as const)),
    [status.data?.providers],
  );
  const catalogMap = useMemo(
    () => new Map((catalog.data?.providers ?? []).map((item) => [item.provider, item] as const)),
    [catalog.data?.providers],
  );

  const edgarStatus = providerMap.get("edgar");
  const binanceStatus = providerMap.get("binance");
  const activeProfile = status.data?.active_profile ?? null;
  const activeProfileId = activeProfile?.profile_id ?? "local_default";
  const binanceAccount = useAsyncResource<BinanceAccountSnapshot>(async () => api.getBinanceAccount(), [], {
    enabled: providerRequestsEnabled && Boolean(binanceStatus?.configured),
  });
  const binanceDirty =
    binanceApiKey.trim().length > 0 || binanceSecret.trim().length > 0 || binancePassword.trim().length > 0;

  function clearLatestTest(provider: string) {
    setLatestTests((current) => {
      const next = { ...current };
      delete next[provider];
      return next;
    });
  }

  async function refreshProviderPanels() {
    status.reload();
    catalog.reload();
    await onGlobalRefresh();
  }

  async function handleSave(provider: "edgar" | "binance") {
    setSavingProvider(provider);
    try {
      if (provider === "edgar") {
        const identity = (edgarIdentity || edgarIdentityRef.current?.value || "").trim();
        if (!identity) {
          throw new Error("Enter an EDGAR identity before saving.");
        }
        await api.saveConnectionSecret("edgar", { identity }, activeProfileId);
        setEdgarIdentity("");
        if (edgarIdentityRef.current) {
          edgarIdentityRef.current.value = "";
        }
      } else {
        await api.saveConnectionSecret("binance", {
          apiKey: binanceApiKey.trim(),
          secret: binanceSecret.trim(),
          password: binancePassword.trim() || undefined,
        }, activeProfileId);
        setBinanceApiKey("");
        setBinanceSecret("");
        setBinancePassword("");
      }
      await onRestart();
      await handleTest(provider);
      await refreshProviderPanels();
    } catch (error) {
      setLatestTests((current) => ({
        ...current,
        [provider]: buildErrorTest(provider, error, "Saving credentials failed."),
      }));
    } finally {
      setSavingProvider(null);
    }
  }

  async function handleTest(provider: "edgar" | "binance") {
    setTestingProvider(provider);
    try {
      const result = await api.testConnection(provider);
      setLatestTests((current) => ({ ...current, [provider]: result }));
      status.reload();
      catalog.reload();
      if (provider === "binance" && result.status === "ok") {
        binanceAccount.reload();
      }
    } catch (error) {
      setLatestTests((current) => ({
        ...current,
        [provider]: buildErrorTest(provider, error, "Connection test failed."),
      }));
    } finally {
      setTestingProvider(null);
    }
  }

  async function handleClear(provider: "edgar" | "binance") {
    setClearingProvider(provider);
    try {
      await api.clearConnectionSecret(provider, activeProfileId);
      await onRestart();
      await api.clearConnectionProfile(provider);
      clearLatestTest(provider);
      if (provider === "edgar") {
        setEdgarIdentity("");
      } else {
        setBinanceApiKey("");
        setBinanceSecret("");
        setBinancePassword("");
        binanceAccount.reload();
      }
      await refreshProviderPanels();
    } catch (error) {
      setLatestTests((current) => ({
        ...current,
        [provider]: buildErrorTest(provider, error, "Clearing stored credentials failed."),
      }));
    } finally {
      setClearingProvider(null);
    }
  }

  async function handleCreateProfile() {
    const label = profileLabel.trim();
    if (!label) {
      setProfileMessage("Enter a local profile label first.");
      return;
    }
    setProfileBusy(true);
    try {
      const profile = await api.createConnectionProfile(label);
      await api.setActiveConnectionProfile(profile.profile_id);
      setProfileLabel("");
      setProfileMessage(`Active profile: ${profile.label}`);
      await onRestart();
      await refreshProviderPanels();
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Creating profile failed.");
    } finally {
      setProfileBusy(false);
    }
  }

  async function handleSelectProfile(profileId: string) {
    if (!profileId || profileId === activeProfileId) {
      return;
    }
    setProfileBusy(true);
    try {
      const profile = await api.setActiveConnectionProfile(profileId);
      setProfileMessage(`Active profile: ${profile.label}`);
      setLatestTests({});
      await onRestart();
      await refreshProviderPanels();
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Switching profile failed.");
    } finally {
      setProfileBusy(false);
    }
  }

  return (
    <div className="stack-layout">
      {!isTauriRuntime() ? (
        <PanelState
          title="Credential storage is only available in the desktop build"
          copy="Secrets are stored through the desktop runtime so they do not round-trip through the web preview."
        />
      ) : null}

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Local profile</p>
            <h3>Provider credentials are scoped to the selected local profile</h3>
          </div>
          <span className="mini-pill" aria-label={`connection-active-profile id=${activeProfileId}`}>
            <UserCircle size={14} />
            {activeProfile?.label ?? "Local default"}
          </span>
        </div>
        <div className="form-grid two-up">
          <label className="field">
            <span>Active profile</span>
            <select
              aria-label="connection-profile-select"
              disabled={profileBusy || !status.data?.profiles.length}
              onChange={(event) => void handleSelectProfile(event.target.value)}
              value={activeProfileId}
            >
              {(status.data?.profiles ?? []).map((profile) => (
                <option key={profile.profile_id} value={profile.profile_id}>
                  {profile.label}
                </option>
              ))}
            </select>
            <small className="field-note">Switching profiles restarts the local sidecar so readiness follows the selected owner.</small>
          </label>
          <label className="field">
            <span>New local profile</span>
            <input
              aria-label="connection-profile-label"
              onChange={(event) => setProfileLabel(event.target.value)}
              placeholder="Research account"
              value={profileLabel}
            />
          </label>
        </div>
        <div className="form-actions">
          <button
            aria-label="connection-profile-create"
            className="ghost-button"
            disabled={profileBusy || !profileLabel.trim()}
            onClick={() => void handleCreateProfile()}
            type="button"
          >
            <Plus size={16} />
            {profileBusy ? "Updating..." : "Create profile"}
          </button>
        </div>
        {profileMessage ? <InlineState label={profileMessage} /> : null}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Providers</p>
            <h3>Health status and capability coverage now share the same provider cards</h3>
          </div>
          <button className="ghost-button" type="button" onClick={() => void refreshProviderPanels()}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
        {runtime?.sidecarStatus === "offline" ? (
          <InlineState label={runtime.lastError ?? "The local sidecar is offline. Restart it before testing providers."} />
        ) : null}
        {!providerRequestsEnabled ? (
          <InlineState label="Waiting for the local sidecar before loading provider status and capability coverage." />
        ) : null}
        {providerRequestsEnabled && status.loading && !status.data ? <InlineState label="Loading provider status..." /> : null}
        {providerRequestsEnabled && status.error ? (
          <InlineState label={status.error} actionLabel="Retry" onAction={status.reload} />
        ) : null}
        {providerRequestsEnabled && catalog.error ? (
          <InlineState label={catalog.error} actionLabel="Retry catalog" onAction={catalog.reload} />
        ) : null}
        <div className="connection-grid">
          {(status.data?.providers ?? []).map((item) => (
            <ProviderCard
              key={item.provider}
              item={item}
              catalogItem={catalogMap.get(item.provider)}
              testResult={latestTests[item.provider]}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">EDGAR</p>
            <h3>Save an EDGAR identity, restart, and verify live filings access</h3>
          </div>
          <span className="mini-pill">{runtime?.mode === "tauri" ? "Desktop" : "Web preview"}</span>
        </div>
        <CredentialSummaryBanner
          summary={edgarStatus?.credential_summary ?? latestTests.edgar?.credential_summary ?? null}
          fallback="No EDGAR identity is currently loaded in the running sidecar."
        />
        <div className="form-grid two-up">
          <label className="field wide">
            <span>EDGAR identity</span>
            <input
              aria-label="connection-secret provider=edgar field=identity"
              placeholder="Your Name email@example.com"
              ref={edgarIdentityRef}
              onChange={(event) => setEdgarIdentity(event.target.value)}
            />
            <small className="field-note">Stored identities are written to Stronghold and are not echoed back into the form.</small>
          </label>
        </div>
        <div className="form-actions">
          <button
            aria-label="connection-save provider=edgar"
            className="primary-button"
            disabled={!isTauriRuntime() || savingProvider === "edgar" || clearingProvider === "edgar"}
            onClick={() => void handleSave("edgar")}
            type="button"
          >
            <Save size={16} />
            {savingProvider === "edgar" ? "Saving..." : "Save and verify"}
          </button>
          <button
            aria-label="connection-test provider=edgar"
            className="ghost-button"
            disabled={testingProvider === "edgar" || clearingProvider === "edgar"}
            onClick={() => void handleTest("edgar")}
            type="button"
          >
            <RefreshCcw size={16} />
            {testingProvider === "edgar" ? "Testing..." : "Test connection"}
          </button>
          <button
            aria-label="connection-clear provider=edgar"
            className="ghost-button danger"
            disabled={!isTauriRuntime() || !canClearProvider(edgarStatus) || clearingProvider === "edgar" || savingProvider === "edgar"}
            onClick={() => void handleClear("edgar")}
            type="button"
          >
            <Trash2 size={16} />
            {clearingProvider === "edgar" ? "Clearing..." : "Clear stored credentials"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Binance</p>
            <h3>Save API credentials and verify the private-account path plus cached fallback</h3>
          </div>
          <button
            className="ghost-button"
            disabled={!binanceStatus?.configured || binanceAccount.loading}
            type="button"
            onClick={() => binanceAccount.reload()}
          >
            <RefreshCcw size={16} />
            Refresh balances
          </button>
        </div>
        <CredentialSummaryBanner
          summary={binanceStatus?.credential_summary ?? latestTests.binance?.credential_summary ?? null}
          fallback="No Binance credentials are currently loaded in the running sidecar."
        />
        <div className="form-grid two-up">
          <label className="field">
            <span>API key</span>
            <input
              aria-label="connection-secret provider=binance field=api-key"
              value={binanceApiKey}
              onChange={(event) => setBinanceApiKey(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Secret</span>
            <input
              aria-label="connection-secret provider=binance field=secret"
              value={binanceSecret}
              onChange={(event) => setBinanceSecret(event.target.value)}
            />
          </label>
          <label className="field wide">
            <span>Password (optional)</span>
            <input
              aria-label="connection-secret provider=binance field=password"
              value={binancePassword}
              onChange={(event) => setBinancePassword(event.target.value)}
            />
            <small className="field-note">Leave this blank unless your Binance key setup explicitly requires it.</small>
          </label>
        </div>
        <div className="form-actions">
          <button
            aria-label="connection-save provider=binance"
            className="primary-button"
            disabled={!isTauriRuntime() || !binanceDirty || savingProvider === "binance" || clearingProvider === "binance"}
            onClick={() => void handleSave("binance")}
            type="button"
          >
            <Save size={16} />
            {savingProvider === "binance" ? "Saving..." : "Save and verify"}
          </button>
          <button
            aria-label="connection-test provider=binance"
            className="ghost-button"
            disabled={testingProvider === "binance" || clearingProvider === "binance"}
            onClick={() => void handleTest("binance")}
            type="button"
          >
            <RefreshCcw size={16} />
            {testingProvider === "binance" ? "Testing..." : "Test connection"}
          </button>
          <button
            aria-label="connection-clear provider=binance"
            className="ghost-button danger"
            disabled={!isTauriRuntime() || !canClearProvider(binanceStatus) || clearingProvider === "binance" || savingProvider === "binance"}
            onClick={() => void handleClear("binance")}
            type="button"
          >
            <Trash2 size={16} />
            {clearingProvider === "binance" ? "Clearing..." : "Clear stored credentials"}
          </button>
        </div>
        {binanceStatus?.configured ? (
          <div className="holding-list">
            {binanceAccount.loading ? <InlineState label="Loading Binance balances..." /> : null}
            {binanceAccount.error ? <InlineState label={binanceAccount.error} /> : null}
            {binanceAccount.data?.balances.map((balance) => (
              <div key={balance.asset} className="holding-row">
                <div>
                  <strong>{balance.asset}</strong>
                  <span>Total {balance.total.toFixed(6)}</span>
                </div>
                <div className="holding-meta">
                  <span>Free {balance.free.toFixed(6)}</span>
                  <span>Used {balance.used.toFixed(6)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ProviderCard({
  item,
  catalogItem,
  testResult,
}: {
  item: ConnectionStatusItem;
  catalogItem?: ProviderCapabilityProviderItem;
  testResult?: ConnectionTestResponse;
}) {
  const effective = mergeProviderState(item, testResult);

  return (
    <article
      aria-label={`provider-status provider=${effective.provider} health=${effective.health} configured=${effective.configured}`}
      className="connection-card"
    >
      <div className="connection-head">
        <div>
          <strong>{effective.label}</strong>
          <span>{effective.provider}</span>
        </div>
        <span className={`mini-pill status-${effective.health}`}>{translateHealth(effective.health)}</span>
      </div>
      <p>{effective.last_message ?? "No provider message yet."}</p>
      <CredentialStatePanel item={effective} />
      <div className="connection-metrics">
        <StatusMetric label="Configured" value={effective.configured ? "Loaded into sidecar" : "Not loaded"} />
        <StatusMetric label="Owner" value={effective.profile_label} />
        <StatusMetric label="Last test" value={formatTimestamp(effective.last_tested_at)} />
        <StatusMetric label="Last success" value={formatTimestamp(effective.last_success_at)} />
        <StatusMetric label="Cache freshness" value={formatCacheFreshness(effective)} />
      </div>
      {catalogItem ? <SourceMetadataStrip item={catalogItem} /> : null}
      {catalogItem ? <CapabilityMatrix provider={effective.provider} capabilities={catalogItem.capabilities} /> : null}
    </article>
  );
}

function SourceMetadataStrip({ item }: { item: ProviderCapabilityProviderItem }) {
  return (
    <div className="capability-block">
      <div className="capability-block-head">
        <strong>Source contract</strong>
        <span className="mini-pill">{formatWriteStatus(item)}</span>
      </div>
      <div className="connection-metrics">
        <StatusMetric label="Domains" value={formatMetadataList(item.data_domains)} />
        <StatusMetric label="Coverage" value={formatMetadataList(item.asset_coverage)} />
        <StatusMetric label="Regions" value={formatMetadataList(item.regions)} />
        <StatusMetric label="Endpoints" value={formatMetadataList(item.endpoint_coverage)} />
        <StatusMetric label="Freshness" value={item.freshness?.expected_lag ?? item.freshness?.label ?? "Not specified"} />
        <StatusMetric label="Testing" value={item.testable ? item.test_mode ?? "Testable" : "Planned"} />
      </div>
      <p>{item.matrix_summary ?? item.cache_policy ?? item.description ?? "No source metadata registered."}</p>
      {item.execution_boundary ? <p className="capability-boundary">{item.execution_boundary}</p> : null}
    </div>
  );
}

function CapabilityMatrix({
  provider,
  capabilities,
}: {
  provider: string;
  capabilities: ProviderCapability[];
}) {
  return (
    <div className="capability-block">
      <div className="capability-block-head">
        <strong>Capability coverage</strong>
        <span className="mini-pill">{capabilities.length} items</span>
      </div>
      <div className="capability-grid">
        {capabilities.map((capability) => (
          <div
            aria-label={`provider-capability provider=${provider} capability=${capability.key} status=${capability.status_hint}`}
            key={capability.key}
            className="capability-item"
          >
            <div className="capability-item-head">
              <strong>{capability.label}</strong>
              <span className={`mini-pill status-${capability.status_hint}`}>{formatCapabilityStatus(capability.status_hint)}</span>
            </div>
            <p>{capability.notes[0] ?? capability.unsupported_reason ?? "No extra note."}</p>
            <dl className="capability-matrix-details">
              <div>
                <dt>Endpoints</dt>
                <dd>{formatMetadataList(capability.endpoint_coverage)}</dd>
              </div>
              <div>
                <dt>Assets</dt>
                <dd>{formatMetadataList(capability.asset_coverage)}</dd>
              </div>
              <div>
                <dt>Regions</dt>
                <dd>{formatMetadataList(capability.regions)}</dd>
              </div>
              <div>
                <dt>Credential</dt>
                <dd>{capability.requires_credentials ? capability.credential_note ?? "Required" : "Not required"}</dd>
              </div>
              <div>
                <dt>Freshness</dt>
                <dd>{capability.freshness?.expected_lag ?? capability.freshness?.label ?? "Not specified"}</dd>
              </div>
              <div>
                <dt>Write</dt>
                <dd>{capability.read_only ? "Read-only" : "Mutation capable"}</dd>
              </div>
            </dl>
            {capability.unsupported_reason ? <p className="capability-boundary">{capability.unsupported_reason}</p> : null}
            {capability.decision_note ? <p className="capability-decision">{capability.decision_note}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function CredentialSummaryBanner({
  summary,
  fallback,
}: {
  summary: string | null;
  fallback: string;
}) {
  return (
    <div className="credential-banner">
      <strong>Stored summary</strong>
      <span>{summary ?? fallback}</span>
    </div>
  );
}

function CredentialStatePanel({ item }: { item: ConnectionStatusItem }) {
  return (
    <div
      aria-label={`credential-state provider=${item.provider} state=${item.credential_state} action=${item.credential_action_kind}`}
      className={`credential-state-panel credential-state-${item.credential_state}`}
    >
      <div className="credential-state-head">
        <div>
          <span>Credential state</span>
          <strong>{item.credential_state_label}</strong>
        </div>
        <span className={`mini-pill ${credentialStateTone(item.credential_state)}`}>
          {formatCredentialAction(item.credential_action_kind)}
        </span>
      </div>
      <p>{item.credential_next_action}</p>
      {item.credential_state_reason ? <small>{item.credential_state_reason}</small> : null}
    </div>
  );
}

function StatusMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildErrorTest(provider: string, error: unknown, fallbackMessage: string): ConnectionTestResponse {
  return {
    provider,
    status: "error",
    message: error instanceof Error ? error.message : fallbackMessage,
    stale: false,
    requires_credentials: false,
    credential_state: "invalid",
    credential_state_label: "Needs attention",
    credential_next_action: "Check the local error and retry the provider action.",
    credential_action_kind: "check_permissions",
    credential_state_reason: error instanceof Error ? error.message : fallbackMessage,
    credential_summary: null,
    last_tested_at: null,
    last_success_at: null,
    cache_updated_at: null,
    cache_age_seconds: null,
    profile_id: "local_default",
    profile_label: "Local default",
  };
}

function mergeProviderState(item: ConnectionStatusItem, testResult?: ConnectionTestResponse): ConnectionStatusItem {
  if (!testResult) {
    return item;
  }

  return {
    ...item,
    health: testResult.status,
    last_message: testResult.message,
    stale: testResult.stale,
    requires_credentials: testResult.requires_credentials,
    credential_state: testResult.credential_state,
    credential_state_label: testResult.credential_state_label,
    credential_next_action: testResult.credential_next_action,
    credential_action_kind: testResult.credential_action_kind,
    credential_state_reason: testResult.credential_state_reason,
    credential_summary: testResult.credential_summary ?? item.credential_summary,
    last_tested_at: testResult.last_tested_at ?? item.last_tested_at,
    last_success_at: testResult.last_success_at ?? item.last_success_at,
    cache_updated_at: testResult.cache_updated_at ?? item.cache_updated_at,
    cache_age_seconds: testResult.cache_age_seconds ?? item.cache_age_seconds,
    profile_id: testResult.profile_id ?? item.profile_id,
    profile_label: testResult.profile_label ?? item.profile_label,
  };
}

function canClearProvider(item: ConnectionStatusItem | undefined): boolean {
  return Boolean(
    item?.configured ||
      item?.credential_summary ||
      item?.last_tested_at ||
      item?.last_success_at ||
      item?.cache_updated_at,
  );
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCacheFreshness(item: ConnectionStatusItem): string {
  if (!item.cache_updated_at || item.cache_age_seconds == null) {
    return "No cached result";
  }

  const age = `${formatRelativeDuration(item.cache_age_seconds)} ago`;
  return item.health === "cached" ? `Using cached data from ${age}` : `Last refreshed ${age}`;
}

function formatRelativeDuration(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  if (totalSeconds < 3_600) {
    return `${Math.floor(totalSeconds / 60)}m`;
  }
  if (totalSeconds < 86_400) {
    return `${Math.floor(totalSeconds / 3_600)}h`;
  }
  return `${Math.floor(totalSeconds / 86_400)}d`;
}

function formatMetadataList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Not specified";
}

function credentialStateTone(state: CredentialState): string {
  switch (state) {
    case "configured":
    case "read_only":
      return "status-available";
    case "trading_gated":
    case "missing":
    case "expired":
      return "status-credential_required";
    case "invalid":
    case "disabled":
    case "blocked":
      return "status-error";
    default:
      return "status-planned";
  }
}

function formatCredentialAction(action: CredentialActionKind): string {
  switch (action) {
    case "save_credentials":
      return "Save";
    case "test_connection":
      return "Test";
    case "check_permissions":
      return "Check";
    case "refresh_credentials":
      return "Refresh";
    case "enable_provider":
      return "Enable";
    case "unlock_local":
      return "Unlock";
    case "confirm_trading_gate":
      return "Gated";
    default:
      return "No action";
  }
}

function formatWriteStatus(item: ProviderCapabilityProviderItem): string {
  if (item.live_trading) {
    return "Live trading";
  }
  if (item.write_status === "read_only" || item.read_only) {
    return "Read-only";
  }
  return item.write_status;
}

function translateHealth(value: string): string {
  switch (value) {
    case "ok":
      return "Healthy";
    case "cached":
      return "Cached";
    case "missing_credentials":
      return "Need creds";
    case "error":
      return "Error";
    case "unsupported":
      return "Unsupported";
    default:
      return value;
  }
}

function formatCapabilityStatus(value: ProviderCapability["status_hint"]): string {
  switch (value) {
    case "available":
      return "Available";
    case "credential_required":
      return "Need creds";
    default:
      return "Unsupported";
  }
}
