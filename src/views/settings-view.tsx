import { RefreshCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { InlineState, SettingRow } from "../components/shared";
import { Badge } from "../components/ui-kit";
import { useAsyncResource } from "../hooks/use-async-resource";
import { useI18n } from "../i18n";
import {
  api,
  type AppPreferences,
  type BinanceExecutionConfig,
  type DiagnosticsExportResult,
  type LocalSecurityStatus,
  type SecurityAuditEvent,
  type SettingsRuntimeResponse,
  type ViewKey,
} from "../lib/api";
import type { RuntimeConfig } from "../lib/runtime";
import { useAppStore, type DensityPreference, type LanguagePreference, type ThemePreference } from "../store/app-store";

const navigation: Array<{ key: ViewKey }> = [
  { key: "dashboard" }, { key: "commandCenter" }, { key: "asset" }, { key: "watchlist" }, { key: "research" },
  { key: "factorLab" }, { key: "strategyLab" }, { key: "workflowStudio" }, { key: "dataSources" }, { key: "screeners" },
  { key: "manual" }, { key: "portfolio" }, { key: "connections" }, { key: "settings" },
];

export type SettingsRouteSection =
  | "settingsPreferences"
  | "settingsAppearance"
  | "settingsSecurity"
  | "settingsExecution"
  | "settingsRuntime";

export function SettingsView({
  appRuntime,
  activeView,
  onDefaultViewSaved,
  onGlobalRefresh,
  diagnosticsExport,
  diagnosticsBusy,
  onExportDiagnostics,
  routeSection,
}: {
  appRuntime: RuntimeConfig | null;
  activeView: ViewKey;
  onDefaultViewSaved: (view: ViewKey) => void;
  onGlobalRefresh: () => Promise<void>;
  diagnosticsExport: DiagnosticsExportResult | null;
  diagnosticsBusy: boolean;
  onExportDiagnostics: () => Promise<void>;
  routeSection: SettingsRouteSection;
}) {
  const i18n = useI18n();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const setDensity = useAppStore((state) => state.setDensity);
  const setTheme = useAppStore((state) => state.setTheme);
  const preferencesEnabled = routeSection === "settingsPreferences";
  const appearanceEnabled = routeSection === "settingsAppearance";
  const securityEnabled = routeSection === "settingsSecurity";
  const executionEnabled = routeSection === "settingsExecution";
  const runtimeEnabled = routeSection === "settingsRuntime";
  const runtimeInfo = useAsyncResource<SettingsRuntimeResponse>(async () => api.getSettingsRuntime(), [], { enabled: runtimeEnabled });
  const preferences = useAsyncResource<AppPreferences>(async () => api.getSettingsPreferences(), [], { enabled: preferencesEnabled || appearanceEnabled });
  const onboarding = useAsyncResource(async () => api.getOnboardingState(), [], { enabled: preferencesEnabled });
  const localSecurity = useAsyncResource<LocalSecurityStatus>(async () => api.getLocalSecurityStatus(), [], { enabled: securityEnabled });
  const securityAudit = useAsyncResource<SecurityAuditEvent[]>(async () => api.getSecurityAudit(12, "local_security"), [], { enabled: securityEnabled });
  const executionConfig = useAsyncResource<BinanceExecutionConfig>(async () => api.getBinanceExecutionConfig(), [], { enabled: executionEnabled });
  const [form, setForm] = useState<AppPreferences | null>(null);
  const [saving, setSaving] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);
  const [currentUnlockSecret, setCurrentUnlockSecret] = useState("");
  const [newUnlockSecret, setNewUnlockSecret] = useState("");
  const [confirmUnlockSecret, setConfirmUnlockSecret] = useState("");
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [onboardingMessage, setOnboardingMessage] = useState<string | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const copy = settingsCopy(language);
  const securityCopy = settingsSecurityCopy(language);
  const diagnosticsEnabled = preferences.data?.diagnostics_export_enabled ?? true;

  useEffect(() => {
    if (preferences.data) setForm(preferences.data);
  }, [preferences.data]);

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await api.updateSettingsPreferences(form);
      setForm(updated);
      setLanguage(updated.language);
      setDensity(updated.density);
      setTheme(updated.theme);
      preferences.reload();
      if (updated.default_view !== activeView) onDefaultViewSaved(updated.default_view);
      await onGlobalRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function refreshSecurityState() {
    localSecurity.reload();
    securityAudit.reload();
  }

  async function handleChangeUnlockSecret() {
    setSecurityMessage(null);
    if (newUnlockSecret.trim().length < 4) { setSecurityMessage(securityCopy.shortSecret); return; }
    if (newUnlockSecret.trim() !== confirmUnlockSecret.trim()) { setSecurityMessage(securityCopy.mismatch); return; }
    setSecurityBusy(true);
    try {
      await api.changeLocalSecuritySecret(currentUnlockSecret.trim(), newUnlockSecret.trim());
      setCurrentUnlockSecret(""); setNewUnlockSecret(""); setConfirmUnlockSecret("");
      setSecurityMessage(securityCopy.changed);
      await refreshSecurityState();
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : securityCopy.changeFailed);
    } finally { setSecurityBusy(false); }
  }

  async function handleResetUnlockSecret() {
    setSecurityMessage(null);
    setSecurityBusy(true);
    try {
      await api.resetLocalSecurity(resetConfirmation.trim());
      setResetConfirmation(""); setCurrentUnlockSecret(""); setNewUnlockSecret(""); setConfirmUnlockSecret("");
      setSecurityMessage(securityCopy.resetDone);
      await refreshSecurityState();
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : securityCopy.resetFailed);
    } finally { setSecurityBusy(false); }
  }

  async function handleResetOnboarding() {
    setOnboardingBusy(true); setOnboardingMessage(null);
    try {
      await api.resetOnboardingState();
      onboarding.reload();
      setOnboardingMessage(copy.onboardingResetDone);
      await onGlobalRefresh();
    } catch (error) {
      setOnboardingMessage(error instanceof Error ? error.message : copy.onboardingResetFailed);
    } finally { setOnboardingBusy(false); }
  }

  return (
    <div className="p2-page p2-settings-page stack-layout" data-route-section={routeSection}>
      <header className="p2-page-header">
        <div><p className="eyebrow">{copy.eyebrow}</p><h2>{settingsSectionTitle(routeSection, language)}</h2><p className="p2-page-description">{copy.description}</p></div>
        <div className="p2-page-header-meta"><Badge tone={securityEnabled && localSecurity.data?.locked ? "warning" : "success"}>{securityEnabled && localSecurity.data?.locked ? securityCopy.locked : copy.local}</Badge><span className="p2-header-count">{form ? `${form.density === "compact" ? copy.compact : copy.standard} ${copy.density}` : routeSection}</span></div>
      </header>

      {routeSection === "settingsRuntime" ? <section className="card p2-section-card p2-inspector-section" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{i18n.t("settings.runtimeEyebrow")}</p><h3>{i18n.t("settings.runtimeTitle")}</h3></div><button className="ghost-button" type="button" onClick={runtimeInfo.reload}><RefreshCcw size={16} />{i18n.t("settings.refreshRuntime")}</button></div>
        {runtimeInfo.loading && !runtimeInfo.data ? <InlineState label={copy.loading} /> : null}
        {runtimeInfo.error ? <InlineState label={runtimeInfo.error} actionLabel={securityCopy.retry} onAction={runtimeInfo.reload} /> : null}
        <div className="setting-list">
          <SettingRow label={i18n.t("settings.runtimeMode")} value={formatRuntimeMode(runtimeInfo.data?.runtime_mode ?? appRuntime?.mode ?? null, language)} helper={i18n.t("settings.runtimeModeHelper")} />
          <SettingRow label={copy.appVersion} value={runtimeInfo.data?.app_version ?? "--"} helper={copy.appVersionHelper} />
          <SettingRow label={copy.sidecarVersion} value={runtimeInfo.data?.sidecar_version ?? "--"} helper={copy.sidecarVersionHelper} />
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
        <div className="connector-instructions">
          <div className="card-header"><div><p className="eyebrow">{i18n.t("settings.diagnosticsEyebrow")}</p><h3>{i18n.t("settings.diagnosticsTitle")}</h3></div><button className="ghost-button" disabled={diagnosticsBusy || appRuntime?.mode !== "tauri" || !diagnosticsEnabled} onClick={() => void onExportDiagnostics()} type="button">{diagnosticsBusy ? i18n.t("runtime.exporting") : i18n.t("runtime.exportDiagnostics")}</button></div>
          {!diagnosticsEnabled ? <InlineState label={i18n.t("settings.diagnosticsDisabled")} /> : null}
          {appRuntime?.lastError ? <InlineState label={`${i18n.t("settings.latestRuntimeError")} ${appRuntime.lastError}`} /> : null}
          {diagnosticsExport ? <div className="stack-layout"><div className="setting-list"><SettingRow label={i18n.t("settings.latestExport")} value={diagnosticsExport.exportPath} helper={i18n.t("settings.latestExportHelper")} /><SettingRow label={i18n.t("settings.manifest")} value={diagnosticsExport.manifestPath} helper={i18n.t("settings.manifestHelper")} /></div><div className="diagnostics-list-grid"><div><p className="eyebrow">{i18n.t("settings.included")}</p><div className="task-list">{diagnosticsExport.includedFiles.map((entry) => <div className="task-item" key={entry.key}><span>{entry.label}</span></div>)}</div></div><div><p className="eyebrow">{i18n.t("settings.missing")}</p><div className="task-list">{diagnosticsExport.missingFiles.length === 0 ? <div className="task-item"><span>{i18n.t("settings.allIncluded")}</span></div> : diagnosticsExport.missingFiles.map((entry) => <div className="task-item" key={entry.key}><span>{entry.label}</span></div>)}</div></div></div></div> : <InlineState label={i18n.t("settings.noDiagnosticsYet")} />}
        </div>
      </section> : null}

      {routeSection === "settingsSecurity" ? <section className="card p2-section-card p2-risk-section" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{securityCopy.eyebrow}</p><h3>{securityCopy.title}</h3></div><button className="ghost-button" type="button" onClick={refreshSecurityState}><RefreshCcw size={16} />{securityCopy.refresh}</button></div>
        {localSecurity.loading && !localSecurity.data ? <InlineState label={securityCopy.loading} /> : null}
        {localSecurity.error ? <InlineState label={localSecurity.error} actionLabel={securityCopy.retry} onAction={localSecurity.reload} /> : null}
        {localSecurity.data ? <div className="setting-list">
          <SettingRow label={securityCopy.initialized} value={localSecurity.data.initialized ? securityCopy.yes : securityCopy.no} helper={securityCopy.initializedHelper} />
          <SettingRow label={securityCopy.lockState} value={localSecurity.data.locked ? securityCopy.locked : securityCopy.unlocked} helper={securityCopy.lockHelper} />
          <SettingRow label={securityCopy.failedAttempts} value={`${localSecurity.data.failed_attempts}/${localSecurity.data.max_failed_attempts}`} helper={securityCopy.failedHelper} />
          <SettingRow label={securityCopy.idleTimeout} value={`${Math.round(localSecurity.data.idle_timeout_seconds / 60)} ${copy.minutes}`} helper={securityCopy.idleHelper} />
        </div> : null}
        <div className="form-grid three-up local-security-form">
          <label className="field"><span>{securityCopy.currentSecret}</span><input autoComplete="current-password" type="password" value={currentUnlockSecret} onChange={(event) => setCurrentUnlockSecret(event.target.value)} /></label>
          <label className="field"><span>{securityCopy.newSecret}</span><input autoComplete="new-password" type="password" value={newUnlockSecret} onChange={(event) => setNewUnlockSecret(event.target.value)} /></label>
          <label className="field"><span>{securityCopy.confirmSecret}</span><input autoComplete="new-password" type="password" value={confirmUnlockSecret} onChange={(event) => setConfirmUnlockSecret(event.target.value)} /></label>
        </div>
        <div className="form-actions"><button className="primary-button" disabled={securityBusy || !localSecurity.data?.initialized} type="button" onClick={() => void handleChangeUnlockSecret()}>{securityCopy.changeAction}</button></div>
        <div className="local-reset-box"><p className="panel-note">{securityCopy.resetCopy}</p><div className="form-grid two-up"><label className="field"><span>{securityCopy.resetLabel}</span><input value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} /></label></div><div className="form-actions"><button className="danger-button" disabled={securityBusy || resetConfirmation.trim() !== "RESET LOCAL UNLOCK"} type="button" onClick={() => void handleResetUnlockSecret()}>{securityCopy.resetAction}</button></div></div>
        {securityMessage ? <p className="panel-note">{securityMessage}</p> : null}
        <div className="connector-instructions"><div className="card-header"><div><p className="eyebrow">{copy.auditEyebrow}</p><h3>{copy.auditTitle}</h3></div><button className="ghost-button" type="button" onClick={securityAudit.reload}><RefreshCcw size={16} />{copy.refresh}</button></div>{securityAudit.loading && !securityAudit.data ? <InlineState label={copy.auditLoading} /> : null}{securityAudit.error ? <InlineState label={securityAudit.error} actionLabel={copy.retry} onAction={securityAudit.reload} /> : null}<div className="task-list">{(securityAudit.data ?? []).map((event) => <div className="task-item security-audit-row" key={event.event_id}><div><strong>{event.event_type}</strong><p>{event.summary}</p></div><span className="setting-value mono">{event.created_at}</span></div>)}{securityAudit.data?.length === 0 ? <InlineState label={copy.auditEmpty} /> : null}</div></div>
      </section> : null}

      {routeSection === "settingsPreferences" ? <section className="card p2-section-card" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{i18n.t("settings.preferencesEyebrow")}</p><h3>{i18n.t("settings.preferencesTitle")}</h3></div></div>
        {form ? <>
          <div className="form-grid two-up">
            <label className="field"><span>{i18n.t("settings.defaultView")}</span><select value={form.default_view} onChange={(event) => setForm((current) => current ? { ...current, default_view: event.target.value as ViewKey } : current)}>{navigation.map((item) => <option key={item.key} value={item.key}>{i18n.viewLabel(item.key)}</option>)}</select></label>
            <label className="field"><span>{i18n.t("settings.quoteTtl")}</span><input min={1} step={1} type="number" value={form.quote_ttl_minutes} onChange={(event) => setForm((current) => current ? { ...current, quote_ttl_minutes: Number(event.target.value || 15) } : current)} /></label>
            <label className="field"><span>{i18n.t("settings.language")}</span><select value={form.language} onChange={(event) => { const next = event.target.value as LanguagePreference; setForm((current) => current ? { ...current, language: next } : current); setLanguage(next); }}><option value="zh-CN">{i18n.t("settings.languageZh")}</option><option value="en-US">{i18n.t("settings.languageEn")}</option></select></label>
          </div>
          <div className="checkbox-list"><label className="checkbox-row"><input checked={form.log_collection_enabled} onChange={(event) => setForm((current) => current ? { ...current, log_collection_enabled: event.target.checked } : current)} type="checkbox" /><span>{i18n.t("settings.logCollection")}</span></label><label className="checkbox-row"><input checked={form.diagnostics_export_enabled} onChange={(event) => setForm((current) => current ? { ...current, diagnostics_export_enabled: event.target.checked } : current)} type="checkbox" /><span>{i18n.t("settings.diagnosticsExport")}</span></label></div>
          <div className="form-actions"><button className="primary-button" disabled={saving} onClick={handleSave} type="button"><Save size={16} />{saving ? i18n.t("settings.saving") : i18n.t("settings.savePreferences")}</button></div>
        </> : <InlineState label={preferences.loading ? i18n.t("settings.loadingPreferences") : preferences.error ?? i18n.t("settings.unableToLoadPreferences")} />}
        <div className="connector-instructions" aria-label="settings-onboarding-reset"><div className="card-header"><div><p className="eyebrow">{copy.onboardingEyebrow}</p><h3>{copy.onboardingTitle}</h3></div><span className="mini-pill">{(onboarding.data?.checklist ?? []).filter((item) => item.completed_at).length}/{onboarding.data?.checklist.length ?? 5}</span></div><p className="panel-note">{copy.onboardingDescription}</p><div className="form-actions"><button aria-label="settings-reset-onboarding" className="ghost-button" disabled={onboardingBusy} type="button" onClick={() => void handleResetOnboarding()}><RefreshCcw size={16} />{onboardingBusy ? copy.resetting : copy.resetOnboarding}</button></div>{onboardingMessage ? <p className="panel-note">{onboardingMessage}</p> : null}</div>
      </section> : null}

      {routeSection === "settingsAppearance" ? <section className="card p2-section-card" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">{i18n.t("settings.theme")}</p><h3>{settingsSectionTitle(routeSection, language)}</h3></div></div>
        {form ? <><div className="form-grid two-up"><label className="field"><span>{i18n.t("settings.density")}</span><select value={form.density} onChange={(event) => { const next = event.target.value as DensityPreference; setForm((current) => current ? { ...current, density: next } : current); setDensity(next); }}><option value="standard">{i18n.t("settings.densityStandard")}</option><option value="compact">{i18n.t("settings.densityCompact")}</option></select></label><label className="field"><span>{i18n.t("settings.theme")}</span><select aria-label="settings-theme" value={form.theme} onChange={(event) => { const next = event.target.value as ThemePreference; setForm((current) => current ? { ...current, theme: next } : current); setTheme(next); }}><option value="light">{i18n.t("settings.themeLight")}</option><option value="dark">{i18n.t("settings.themeDark")}</option></select></label></div><div className="form-actions"><button className="primary-button" disabled={saving} onClick={handleSave} type="button"><Save size={16} />{saving ? i18n.t("settings.saving") : i18n.t("settings.savePreferences")}</button></div></> : <InlineState label={preferences.loading ? i18n.t("settings.loadingPreferences") : preferences.error ?? i18n.t("settings.unableToLoadPreferences")} />}
      </section> : null}

      {routeSection === "settingsExecution" ? <section className="card p2-section-card p2-risk-section" data-primary-task={routeSection}>
        <div className="card-header"><div><p className="eyebrow">Binance</p><h3>{settingsSectionTitle(routeSection, language)}</h3></div><button className="ghost-button" type="button" onClick={executionConfig.reload}><RefreshCcw size={16} />{copy.refresh}</button></div>
        {executionConfig.loading && !executionConfig.data ? <InlineState label={copy.loading} /> : null}
        {executionConfig.error ? <InlineState label={executionConfig.error} actionLabel={copy.retry} onAction={executionConfig.reload} /> : null}
        {executionConfig.data ? <><div className="setting-list"><SettingRow label={language === "zh-CN" ? "实时执行" : "Live execution"} value={executionConfig.data.live_enabled ? copy.enabled : copy.disabled} helper={language === "zh-CN" ? "默认关闭；只在显式配置后可用。" : "Default-off and available only after explicit configuration."} /><SettingRow label="Kill Switch" value={executionConfig.data.kill_switch_enabled ? copy.enabled : copy.disabled} helper={language === "zh-CN" ? "熔断开关开启时禁止真实提交。" : "Live submission is blocked while the kill switch is enabled."} /><SettingRow label={language === "zh-CN" ? "风险确认" : "Risk acknowledgement"} value={executionConfig.data.risk_acknowledged ? copy.configured : copy.missing} helper={language === "zh-CN" ? "真实提交仍需逐次明确确认。" : "Each live submit still requires explicit confirmation."} /><SettingRow label={language === "zh-CN" ? "凭证" : "Credentials"} value={executionConfig.data.credentials_configured ? copy.configured : copy.missing} helper={language === "zh-CN" ? "凭证不会在此页面回显。" : "Credentials are never echoed on this page."} /></div><div className="source-contract-grid"><SettingRow label={language === "zh-CN" ? "允许标的" : "Allowlist"} value={executionConfig.data.allowlist.join(", ") || "--"} helper="" /><SettingRow label={language === "zh-CN" ? "单笔限额" : "Max order notional"} value={String(executionConfig.data.max_order_notional)} helper="" /><SettingRow label={language === "zh-CN" ? "日周转限额" : "Daily turnover limit"} value={String(executionConfig.data.max_daily_turnover)} helper="" /></div></> : null}
      </section> : null}
    </div>
  );
}

function settingsSectionTitle(section: SettingsRouteSection, language: LanguagePreference): string {
  const zh = language === "zh-CN";
  return {
    settingsPreferences: zh ? "常规偏好" : "General preferences",
    settingsAppearance: zh ? "外观与可读性" : "Appearance and readability",
    settingsSecurity: zh ? "安全与本地解锁" : "Security and local unlock",
    settingsExecution: zh ? "执行边界与 Kill Switch" : "Execution boundary and Kill Switch",
    settingsRuntime: zh ? "诊断与运行时" : "Diagnostics and runtime",
  }[section];
}

function formatRuntimeMode(value: string | null, language: LanguagePreference): string {
  if (!value) return "--";
  if (value === "tauri") return language === "zh-CN" ? "桌面端" : "Desktop";
  if (value === "web") return language === "zh-CN" ? "网页预览" : "Web preview";
  return value;
}

function settingsCopy(language: LanguagePreference) {
  const zh = language === "zh-CN";
  return {
    eyebrow: zh ? "设置 / 工作台" : "Settings / Workbench",
    description: zh ? "调整本地运行时、安全边界、界面密度、主题和诊断行为。" : "Tune local runtime behavior, security boundaries, display density, theme, and diagnostics.",
    local: zh ? "本地" : "Local", loading: zh ? "加载中..." : "Loading...", density: zh ? "密度" : "density", standard: zh ? "标准" : "standard", compact: zh ? "紧凑" : "compact", minutes: zh ? "分钟" : "min",
    refresh: zh ? "刷新" : "Refresh", retry: zh ? "重试" : "Retry", appVersion: zh ? "应用版本" : "App version", appVersionHelper: zh ? "当前源代码和桌面包版本。" : "Current source and desktop package version.", sidecarVersion: zh ? "Sidecar 版本" : "Sidecar version", sidecarVersionHelper: zh ? "当前本地 sidecar 版本。" : "Current local sidecar version.",
    aiEyebrow: zh ? "AI 助手" : "AI assistant", aiTitle: zh ? "由 Dashboard 控制的云端边界" : "Dashboard-controlled cloud boundary", aiLoading: zh ? "正在加载 AI 云端边界..." : "Loading AI cloud boundary...", cloudAi: zh ? "云端 AI" : "Cloud AI", enabled: zh ? "已启用" : "Enabled", disabled: zh ? "已禁用" : "Disabled", aiModeHelper: zh ? "在研究生成前，通过 Dashboard 的 AI Control 选择本地或云端模式。" : "Use Dashboard AI Control to choose local or cloud mode before Research generation.", provider: zh ? "提供商" : "Provider", noCloudModel: zh ? "未选择云端模型。" : "No cloud model selected.", credential: zh ? "凭证" : "Credential", configured: zh ? "已配置" : "Configured", missing: zh ? "缺失" : "Missing", credentialHelper: zh ? "API key 只从本地环境配置读取，此状态接口不会返回密钥。" : "API keys are read from local environment configuration and are never returned by this status endpoint.", confirmation: zh ? "确认" : "Confirmation", required: zh ? "需要确认" : "Required", notRequired: zh ? "无需确认" : "Not required",
    onboardingEyebrow: zh ? "新手导览" : "Onboarding", onboardingTitle: zh ? "重置 reviewer 的首次运行 checklist" : "Reset the reviewer first-run checklist", onboardingDescription: zh ? "这个操作只清空本地 onboarding 状态，不会删除凭证、组合、研究记录、工作流记录或本地数据库。" : "This only clears local onboarding state. It does not delete credentials, portfolios, research, workflows, or local databases.", onboardingResetDone: zh ? "新手导览已重置。回到仪表盘后会再次显示。" : "First-run onboarding reset. It will appear again on the dashboard.", onboardingResetFailed: zh ? "重置新手导览失败。" : "Failed to reset first-run onboarding.", resetting: zh ? "重置中..." : "Resetting...", resetOnboarding: zh ? "重置新手导览" : "Reset onboarding",
    auditEyebrow: zh ? "安全审计" : "Security audit", auditTitle: zh ? "本地解锁和敏感界面事件" : "Local unlock and sensitive-surface events", auditLoading: zh ? "正在加载安全审计事件..." : "Loading security audit events...", auditEmpty: zh ? "暂时没有本地安全审计事件。" : "No local security audit events yet.",
  };
}

function settingsSecurityCopy(language: LanguagePreference) {
  if (language === "zh-CN") {
    return {
      eyebrow: "本地安全", title: "本地解锁管理", refresh: "刷新", loading: "正在加载本地解锁状态...", retry: "重试", yes: "已初始化", no: "未初始化", locked: "已锁定", unlocked: "已解锁", initialized: "初始化状态", initializedHelper: "未初始化时，进入敏感工作区会要求设置新的本机 PIN 或口令。", lockState: "锁定状态", lockHelper: "敏感工作区会在空闲后自动锁定，也可以手动锁定。", failedAttempts: "失败次数", failedHelper: "连续失败过多会临时锁定本地解锁。", idleTimeout: "空闲锁定", idleHelper: "解锁后无操作达到该时间会自动重新锁定。", currentSecret: "当前 PIN 或口令", newSecret: "新 PIN 或口令", confirmSecret: "确认新 PIN 或口令", changeAction: "修改 PIN/口令", shortSecret: "新 PIN 或口令至少需要 4 个字符。", mismatch: "两次输入的新 PIN 或口令不一致。", changed: "本地解锁 PIN/口令已修改。", changeFailed: "修改本地解锁 PIN/口令失败。", resetCopy: "忘记 PIN 或口令时可以重置本地解锁。重置只清除本机解锁状态，不删除 provider 凭证、组合、研究记录、工作流记录或本地数据库。重置后，下次进入敏感区域需要设置新的 PIN 或口令。", resetLabel: "输入 RESET LOCAL UNLOCK 确认", resetAction: "重置本地解锁", resetDone: "本地解锁已重置。下次进入敏感区域时请设置新的 PIN 或口令。", resetFailed: "重置本地解锁失败。",
    };
  }
  return {
    eyebrow: "Local security", title: "Local unlock management", refresh: "Refresh", loading: "Loading local unlock status...", retry: "Retry", yes: "Initialized", no: "Not initialized", locked: "Locked", unlocked: "Unlocked", initialized: "Initialization", initializedHelper: "When not initialized, sensitive workspaces will ask you to set a new local PIN or passphrase.", lockState: "Lock state", lockHelper: "Sensitive workspaces relock after idle time.", failedAttempts: "Failed attempts", failedHelper: "Too many failed attempts temporarily lock local unlock.", idleTimeout: "Idle timeout", idleHelper: "Unlocked sensitive surfaces relock after this idle period.", currentSecret: "Current PIN or passphrase", newSecret: "New PIN or passphrase", confirmSecret: "Confirm new PIN or passphrase", changeAction: "Change PIN/passphrase", shortSecret: "The new PIN or passphrase needs at least 4 characters.", mismatch: "The two new entries do not match.", changed: "Local unlock PIN/passphrase changed.", changeFailed: "Failed to change local unlock PIN/passphrase.", resetCopy: "If you forgot the PIN or passphrase, reset local unlock. This only clears local unlock state; it does not delete provider credentials, portfolios, research, workflows, or local databases. You will set a new PIN or passphrase next time you enter a sensitive area.", resetLabel: "Type RESET LOCAL UNLOCK to confirm", resetAction: "Reset local unlock", resetDone: "Local unlock reset. Set a new PIN or passphrase next time you enter a sensitive area.", resetFailed: "Failed to reset local unlock.",
  };
}
