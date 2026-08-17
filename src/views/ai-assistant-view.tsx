import { useEffect, useState } from "react";
import { Bot, Cloud, HardDrive, RefreshCcw, Save } from "lucide-react";
import { Button } from "../components/button";
import { PageHeader, StateBlock } from "../components/ui-kit";
import {
  api,
  type AICloudProviderKey,
  type AICloudStatusResponse,
  type AIControlPreferences,
  type AIRuntimeStatusResponse,
  type UpdateAIControlPreferencesRequest,
} from "../lib/api";

export type AiAssistantViewProps = {
  preferences: AIControlPreferences | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  onSave: (payload: UpdateAIControlPreferencesRequest) => Promise<void>;
};

export function AiAssistantView({ preferences, loading, saving, error, onSave }: AiAssistantViewProps) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [localEndpoint, setLocalEndpoint] = useState("http://127.0.0.1:11434");
  const [localModel, setLocalModel] = useState("");
  const [cloudProvider, setCloudProvider] = useState<AICloudProviderKey>("deepseek");
  const [cloudEndpoint, setCloudEndpoint] = useState("");
  const [cloudModel, setCloudModel] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState<AIRuntimeStatusResponse | null>(null);
  const [cloudStatus, setCloudStatus] = useState<AICloudStatusResponse | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!preferences) return;
    setEnabled(preferences.enabled);
    setMode(preferences.provider_mode);
    setLocalEndpoint(preferences.local_base_url);
    setLocalModel(preferences.local_model ?? "");
    setCloudProvider(preferences.cloud_provider);
    setCloudEndpoint(preferences.cloud_base_url ?? "");
    setCloudModel(preferences.cloud_model ?? "");
  }, [preferences]);

  useEffect(() => {
    let active = true;
    setStatusBusy(true);
    Promise.allSettled([api.getAIRuntimeStatus(), api.getAICloudStatus()])
      .then(([localResult, cloudResult]) => {
        if (!active) return;
        if (localResult.status === "fulfilled") setRuntimeStatus(localResult.value);
        if (cloudResult.status === "fulfilled") setCloudStatus(cloudResult.value);
      })
      .finally(() => {
        if (active) setStatusBusy(false);
      });
    return () => { active = false; };
  }, []);

  async function save() {
    setActionError(null);
    try {
      await onSave({
        enabled,
        provider_mode: mode,
        local_base_url: localEndpoint.trim() || null,
        local_model: localModel.trim() || null,
        cloud_provider: cloudProvider,
        cloud_base_url: cloudEndpoint.trim() || null,
        cloud_model: cloudModel.trim() || null,
      });
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "AI 配置保存失败");
    }
  }

  async function probeLocal() {
    setStatusBusy(true);
    setActionError(null);
    try {
      setRuntimeStatus(await api.probeAIRuntime());
    } catch (probeError) {
      setActionError(probeError instanceof Error ? probeError.message : "本地 AI 探测失败");
    } finally {
      setStatusBusy(false);
    }
  }

  if (loading && !preferences) {
    return <StateBlock state="loading" title="正在加载 AI 配置" description="正在读取本地保存的 AI 端点和安全边界。" />;
  }

  return (
    <div className="ai-assistant-page" aria-label="AI 配置与状态" data-primary-task="aiAssistant">
      <PageHeader
        scope="AI / LOCAL-FIRST"
        title="AI Assistant"
        description="独立管理本地与云端 AI 端点；M1 不提供无上下文通用聊天。"
        freshness={<span>{runtimeStatus?.checked_at ? `检查于 ${runtimeStatus.checked_at}` : "等待状态检查"}</span>}
      />

      <section className="card ai-assistant-workspace" aria-label="AI provider configuration">
        <div className="panel-heading-row">
          <div>
            <p className="eyebrow">PRIMARY TASK</p>
            <h2>配置 AI 接口并确认当前状态</h2>
          </div>
          <label className="ai-enable-toggle">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            <span>启用 AI</span>
          </label>
        </div>

        <div className="ai-provider-tabs" role="tablist" aria-label="AI provider mode">
          <button aria-selected={mode === "local"} className={mode === "local" ? "active" : ""} onClick={() => setMode("local")} role="tab" type="button"><HardDrive size={16} />本地</button>
          <button aria-selected={mode === "cloud"} className={mode === "cloud" ? "active" : ""} onClick={() => setMode("cloud")} role="tab" type="button"><Cloud size={16} />云端</button>
        </div>

        {mode === "local" ? (
          <div className="ai-endpoint-panel" data-ai-mode="local">
            <div className="ai-control-fields">
              <label><span>本地接口</span><input aria-label="ai-local-endpoint" value={localEndpoint} onChange={(event) => setLocalEndpoint(event.target.value)} placeholder="http://127.0.0.1:11434" /></label>
              <label><span>模型</span><input value={localModel} onChange={(event) => setLocalModel(event.target.value)} placeholder="例如 qwen2.5:7b" /></label>
            </div>
            <div className="ai-status-summary" data-ai-health={runtimeStatus?.health ?? "unknown"}>
              <Bot size={18} />
              <div><strong>{runtimeStatus?.health ?? "尚未检查"}</strong><span>{runtimeStatus?.message ?? "保存端点后可探测本地 Ollama。"}</span></div>
              <Button disabled={statusBusy} onClick={() => void probeLocal()} variant="ghost"><RefreshCcw size={15} />{statusBusy ? "检查中" : "探测本地端"}</Button>
            </div>
          </div>
        ) : (
          <div className="ai-endpoint-panel" data-ai-mode="cloud">
            <div className="ai-control-fields three-column">
              <label><span>Provider</span><select value={cloudProvider} onChange={(event) => setCloudProvider(event.target.value as AICloudProviderKey)}>{preferences?.available_cloud_providers.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.label}</option>)}</select></label>
              <label><span>云端接口</span><input aria-label="ai-cloud-endpoint" value={cloudEndpoint} onChange={(event) => setCloudEndpoint(event.target.value)} placeholder="https://api.example.com/v1" /></label>
              <label><span>模型</span><input value={cloudModel} onChange={(event) => setCloudModel(event.target.value)} placeholder="模型名称" /></label>
            </div>
            <div className="ai-status-summary" data-ai-cloud-configured={cloudStatus?.configured ?? false}>
              <Cloud size={18} />
              <div><strong>{cloudStatus?.configured ? "云端配置就绪" : "云端配置未完成"}</strong><span>{cloudStatus?.message ?? `密钥只从 ${preferences?.cloud_api_key_env ?? "环境变量"} 读取。`}</span></div>
            </div>
          </div>
        )}

        {error || actionError ? <StateBlock state="error" title="AI 配置未保存" description={actionError ?? error ?? "未知错误"} /> : null}
        <div className="hero-actions">
          <Button disabled={saving || !preferences} onClick={() => void save()} variant="primary"><Save size={15} />{saving ? "保存中" : "保存配置"}</Button>
        </div>
      </section>
    </div>
  );
}
