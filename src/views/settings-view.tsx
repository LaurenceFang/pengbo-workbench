import { RefreshCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { InlineState, SettingRow } from "../components/shared";
import { useAsyncResource } from "../hooks/use-async-resource";
import { useI18n } from "../i18n";
import {
  api,
  type AppPreferences,
  type DiagnosticsExportResult,
  type SecurityAuditEvent,
  type SettingsRuntimeResponse,
  type ViewKey,
} from "../lib/api";
import type { RuntimeConfig } from "../lib/runtime";
import { useAppStore, type DensityPreference, type LanguagePreference } from "../store/app-store";

const navigation: Array<{ key: ViewKey }> = [
  { key: "dashboard" },
  { key: "asset" },
  { key: "watchlist" },
  { key: "research" },
  { key: "factorLab" },
  { key: "strategyLab" },
  { key: "workflowStudio" },
  { key: "dataSources" },
  { key: "screeners" },
  { key: "manual" },
  { key: "portfolio" },
  { key: "connections" },
  { key: "settings" },
];

export function SettingsView({
  appRuntime,
  activeView,
  onDefaultViewSaved,
  onGlobalRefresh,
  diagnosticsExport,
  diagnosticsBusy,
  onExportDiagnostics,
}: {
  appRuntime: RuntimeConfig | null;
  activeView: ViewKey;
  onDefaultViewSaved: (view: ViewKey) => void;
  onGlobalRefresh: () => Promise<void>;
  diagnosticsExport: DiagnosticsExportResult | null;
  diagnosticsBusy: boolean;
  onExportDiagnostics: () => Promise<void>;
}) {
  const i18n = useI18n();
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setDensity = useAppStore((state) => state.setDensity);
  const runtimeInfo = useAsyncResource<SettingsRuntimeResponse>(async () => api.getSettingsRuntime(), []);
  const preferences = useAsyncResource<AppPreferences>(async () => api.getSettingsPreferences(), []);
  const securityAudit = useAsyncResource<SecurityAuditEvent[]>(async () => api.getSecurityAudit(12, "local_security"), []);
  const [form, setForm] = useState<AppPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const diagnosticsEnabled = preferences.data?.diagnostics_export_enabled ?? true;

  useEffect(() => {
    if (preferences.data) {
      setForm(preferences.data);
    }
  }, [preferences.data]);

  async function handleSave() {
    if (!form) {
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateSettingsPreferences(form);
      setForm(updated);
      setLanguage(updated.language);
      setDensity(updated.density);
      preferences.reload();
      if (updated.default_view !== activeView) {
        onDefaultViewSaved(updated.default_view);
      }
      await onGlobalRefresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack-layout">
      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("settings.runtimeEyebrow")}</p>
            <h3>{i18n.t("settings.runtimeTitle")}</h3>
          </div>
          <button className="ghost-button" type="button" onClick={runtimeInfo.reload}>
            <RefreshCcw size={16} />
            {i18n.t("settings.refreshRuntime")}
          </button>
        </div>
        <div className="setting-list">
          <SettingRow
            label={i18n.t("settings.runtimeMode")}
            value={formatRuntimeMode(runtimeInfo.data?.runtime_mode ?? appRuntime?.mode ?? null)}
            helper={i18n.t("settings.runtimeModeHelper")}
          />
          <SettingRow label="App version" value={runtimeInfo.data?.app_version ?? "--"} helper="Current source and desktop package version." />
          <SettingRow label="Sidecar version" value={runtimeInfo.data?.sidecar_version ?? "--"} helper="Current local sidecar version." />
          <SettingRow label={i18n.t("settings.baseUrl")} value={runtimeInfo.data?.base_url ?? appRuntime?.baseUrl ?? "--"} helper={i18n.t("settings.baseUrlHelper")} />
          <SettingRow label={i18n.t("settings.dataDirectory")} value={runtimeInfo.data?.data_dir ?? appRuntime?.dataDir ?? "--"} helper={i18n.t("settings.dataDirectoryHelper")} />
          <SettingRow label={i18n.t("settings.logDirectory")} value={runtimeInfo.data?.log_dir ?? appRuntime?.logDir ?? "--"} helper={i18n.t("settings.logDirectoryHelper")} />
          <SettingRow label={i18n.t("settings.diagnosticsDirectory")} value={runtimeInfo.data?.diagnostics_dir ?? appRuntime?.diagnosticsDir ?? "--"} helper={i18n.t("settings.diagnosticsDirectoryHelper")} />
          <SettingRow label={i18n.t("settings.sqlitePath")} value={runtimeInfo.data?.sqlite_path ?? "--"} helper={i18n.t("settings.sqlitePathHelper")} />
          <SettingRow label={i18n.t("settings.duckdbPath")} value={runtimeInfo.data?.duckdb_path ?? "--"} helper={i18n.t("settings.duckdbPathHelper")} />
          <SettingRow label={i18n.t("settings.stdoutLog")} value={runtimeInfo.data?.sidecar_stdout_path ?? appRuntime?.stdoutLogPath ?? "--"} helper={i18n.t("settings.stdoutLogHelper")} />
          <SettingRow label={i18n.t("settings.stderrLog")} value={runtimeInfo.data?.sidecar_stderr_path ?? appRuntime?.stderrLogPath ?? "--"} helper={i18n.t("settings.stderrLogHelper")} />
          <SettingRow label={i18n.t("settings.lastErrorLog")} value={runtimeInfo.data?.sidecar_last_error_path ?? appRuntime?.lastErrorLogPath ?? "--"} helper={i18n.t("settings.lastErrorLogHelper")} />
          <SettingRow label={i18n.t("settings.bootstrapLog")} value={runtimeInfo.data?.sidecar_bootstrap_path ?? appRuntime?.bootstrapLogPath ?? "--"} helper={i18n.t("settings.bootstrapLogHelper")} />
          <SettingRow label={i18n.t("settings.buildSummary")} value={runtimeInfo.data?.build_summary_path ?? appRuntime?.buildSummaryPath ?? "--"} helper={i18n.t("settings.buildSummaryHelper")} />
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("settings.preferencesEyebrow")}</p>
            <h3>{i18n.t("settings.preferencesTitle")}</h3>
          </div>
        </div>
        {form ? (
          <>
            <div className="form-grid two-up">
              <label className="field">
                <span>{i18n.t("settings.defaultView")}</span>
                <select
                  value={form.default_view}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, default_view: event.target.value as ViewKey } : current,
                    )
                  }
                >
                  {navigation.map((item) => (
                    <option key={item.key} value={item.key}>
                      {i18n.viewLabel(item.key)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{i18n.t("settings.quoteTtl")}</span>
                <input
                  min={1}
                  step={1}
                  type="number"
                  value={form.quote_ttl_minutes}
                  onChange={(event) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            quote_ttl_minutes: Number(event.target.value || 15),
                          }
                        : current,
                    )
                  }
                />
              </label>
              <label className="field">
                <span>{i18n.t("settings.language")}</span>
                <select
                  value={form.language}
                  onChange={(event) => {
                    const language = event.target.value as LanguagePreference;
                    setForm((current) => (current ? { ...current, language } : current));
                    setLanguage(language);
                  }}
                >
                  <option value="zh-CN">{i18n.t("settings.languageZh")}</option>
                  <option value="en-US">{i18n.t("settings.languageEn")}</option>
                </select>
              </label>
              <label className="field">
                <span>{i18n.t("settings.density")}</span>
                <select
                  value={form.density}
                  onChange={(event) => {
                    const density = event.target.value as DensityPreference;
                    setForm((current) => (current ? { ...current, density } : current));
                    setDensity(density);
                  }}
                >
                  <option value="standard">{i18n.t("settings.densityStandard")}</option>
                  <option value="compact">{i18n.t("settings.densityCompact")}</option>
                </select>
              </label>
            </div>
            <div className="checkbox-list">
              <label className="checkbox-row">
                <input
                  checked={form.log_collection_enabled}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, log_collection_enabled: event.target.checked } : current,
                    )
                  }
                  type="checkbox"
                />
                <span>{i18n.t("settings.logCollection")}</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={form.diagnostics_export_enabled}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, diagnostics_export_enabled: event.target.checked } : current,
                    )
                  }
                  type="checkbox"
                />
                <span>{i18n.t("settings.diagnosticsExport")}</span>
              </label>
            </div>
            <div className="form-actions">
              <button className="primary-button" disabled={saving} onClick={handleSave} type="button">
                <Save size={16} />
                {saving ? i18n.t("settings.saving") : i18n.t("settings.savePreferences")}
              </button>
            </div>
          </>
        ) : (
          <InlineState label={preferences.loading ? i18n.t("settings.loadingPreferences") : preferences.error ?? i18n.t("settings.unableToLoadPreferences")} />
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">{i18n.t("settings.diagnosticsEyebrow")}</p>
            <h3>{i18n.t("settings.diagnosticsTitle")}</h3>
          </div>
          <button
            className="ghost-button"
            disabled={diagnosticsBusy || appRuntime?.mode !== "tauri" || !diagnosticsEnabled}
            onClick={() => void onExportDiagnostics()}
            type="button"
          >
            {diagnosticsBusy ? i18n.t("runtime.exporting") : i18n.t("runtime.exportDiagnostics")}
          </button>
        </div>
        {!diagnosticsEnabled ? (
          <InlineState label={i18n.t("settings.diagnosticsDisabled")} />
        ) : null}
        {appRuntime?.lastError ? <InlineState label={`${i18n.t("settings.latestRuntimeError")} ${appRuntime.lastError}`} /> : null}
        {diagnosticsExport ? (
          <div className="stack-layout">
            <div className="setting-list">
              <SettingRow label={i18n.t("settings.latestExport")} value={diagnosticsExport.exportPath} helper={i18n.t("settings.latestExportHelper")} />
              <SettingRow label={i18n.t("settings.manifest")} value={diagnosticsExport.manifestPath} helper={i18n.t("settings.manifestHelper")} />
            </div>
            <div className="diagnostics-list-grid">
              <div>
                <p className="eyebrow">{i18n.t("settings.included")}</p>
                <div className="task-list">
                  {diagnosticsExport.includedFiles.map((entry) => (
                    <div className="task-item" key={entry.key}>
                      <span>{entry.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="eyebrow">{i18n.t("settings.missing")}</p>
                <div className="task-list">
                  {diagnosticsExport.missingFiles.length === 0 ? (
                    <div className="task-item">
                      <span>{i18n.t("settings.allIncluded")}</span>
                    </div>
                  ) : (
                    diagnosticsExport.missingFiles.map((entry) => (
                      <div className="task-item" key={entry.key}>
                        <span>{entry.label}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <InlineState label={i18n.t("settings.noDiagnosticsYet")} />
        )}
      </section>

      <section className="card">
        <div className="card-header">
          <div>
            <p className="eyebrow">Security audit</p>
            <h3>Local unlock and sensitive-surface events</h3>
          </div>
          <button className="ghost-button" type="button" onClick={securityAudit.reload}>
            <RefreshCcw size={16} />
            Refresh
          </button>
        </div>
        {securityAudit.loading && !securityAudit.data ? <InlineState label="Loading security audit events..." /> : null}
        {securityAudit.error ? (
          <InlineState label={securityAudit.error} actionLabel="Retry" onAction={securityAudit.reload} />
        ) : null}
        <div className="task-list">
          {(securityAudit.data ?? []).map((event) => (
            <div className="task-item security-audit-row" key={event.event_id}>
              <div>
                <strong>{event.event_type}</strong>
                <p>{event.summary}</p>
              </div>
              <span className="setting-value mono">{event.created_at}</span>
            </div>
          ))}
          {securityAudit.data?.length === 0 ? <InlineState label="No local security audit events yet." /> : null}
        </div>
      </section>
    </div>
  );
}

function formatRuntimeMode(value: string | null): string {
  if (!value) {
    return "--";
  }

  if (value === "tauri") {
    return "Desktop";
  }

  if (value === "web") {
    return "Web";
  }

  return value;
}
