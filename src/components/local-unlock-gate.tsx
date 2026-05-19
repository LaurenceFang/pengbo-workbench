import { Lock, Unlock } from "lucide-react";
import { useState } from "react";
import type { LocalSecurityStatus } from "../lib/api";
import type { LanguagePreference } from "../store/app-store";

const RESET_CONFIRMATION = "RESET LOCAL UNLOCK";

type LocalUnlockGateProps = {
  status: LocalSecurityStatus;
  language: LanguagePreference;
  viewLabel: string;
  busy: boolean;
  onInitialize: (unlockSecret: string) => Promise<void>;
  onUnlock: (unlockSecret: string) => Promise<void>;
  onReset: (confirmation: string) => Promise<void>;
};

export function LocalUnlockGate({
  status,
  language,
  viewLabel,
  busy,
  onInitialize,
  onUnlock,
  onReset,
}: LocalUnlockGateProps) {
  const [secret, setSecret] = useState("");
  const [confirmSecret, setConfirmSecret] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const copy = localSecurityCopy(language);
  const initializing = !status.initialized;

  async function submit() {
    setError(null);
    const trimmed = secret.trim();
    if (trimmed.length < 4) {
      setError(copy.shortSecret);
      return;
    }
    if (initializing && trimmed !== confirmSecret.trim()) {
      setError(copy.mismatch);
      return;
    }
    try {
      if (initializing) {
        await onInitialize(trimmed);
      } else {
        await onUnlock(trimmed);
      }
      setSecret("");
      setConfirmSecret("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.failed);
    }
  }

  async function submitReset() {
    setError(null);
    try {
      await onReset(resetConfirmation.trim());
      setSecret("");
      setConfirmSecret("");
      setResetConfirmation("");
      setResetOpen(false);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : copy.resetFailed);
    }
  }

  return (
    <section className="card local-unlock-card" aria-label="local-unlock-gate">
      <div className="local-unlock-mark">{initializing ? <Unlock size={22} /> : <Lock size={22} />}</div>
      <div className="local-unlock-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h3>{initializing ? copy.initializeTitle : copy.unlockTitle}</h3>
        <p className="body-copy">
          {initializing ? copy.initializeCopy : copy.unlockCopy.replace("{view}", viewLabel)}
        </p>
      </div>
      <div className="form-grid two-up local-unlock-form">
        <label className="field">
          <span>{copy.secretLabel}</span>
          <input
            aria-label="local-unlock-secret"
            autoComplete={initializing ? "new-password" : "current-password"}
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void submit();
              }
            }}
          />
        </label>
        {initializing ? (
          <label className="field">
            <span>{copy.confirmLabel}</span>
            <input
              aria-label="local-unlock-confirm"
              autoComplete="new-password"
              type="password"
              value={confirmSecret}
              onChange={(event) => setConfirmSecret(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void submit();
                }
              }}
            />
          </label>
        ) : null}
      </div>
      <div className="form-actions">
        <button
          aria-label={initializing ? "local-unlock-initialize" : "local-unlock-submit"}
          className="primary-button"
          disabled={busy}
          type="button"
          onClick={() => void submit()}
        >
          {busy ? copy.working : initializing ? copy.initializeAction : copy.unlockAction}
        </button>
        <span className="mini-pill">{copy.timeout.replace("{minutes}", String(Math.round(status.idle_timeout_seconds / 60)))}</span>
      </div>
      {status.lockout_until ? <p className="panel-note">{copy.lockout.replace("{time}", status.lockout_until)}</p> : null}
      {status.failed_attempts > 0 ? (
        <p className="panel-note">
          {copy.failedAttempts
            .replace("{count}", String(status.failed_attempts))
            .replace("{max}", String(status.max_failed_attempts))}
        </p>
      ) : null}
      {!initializing ? (
        <div className="local-reset-box">
          <button className="ghost-button" type="button" onClick={() => setResetOpen((current) => !current)}>
            {copy.forgotAction}
          </button>
          {resetOpen ? (
            <div className="stack-layout compact">
              <p className="panel-note">{copy.resetCopy}</p>
              <label className="field">
                <span>{copy.resetLabel}</span>
                <input
                  aria-label="local-unlock-reset-confirmation"
                  value={resetConfirmation}
                  onChange={(event) => setResetConfirmation(event.target.value)}
                />
              </label>
              <button
                className="danger-button"
                disabled={busy || resetConfirmation.trim() !== RESET_CONFIRMATION}
                type="button"
                onClick={() => void submitReset()}
              >
                {copy.resetAction}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="panel-note danger">{error}</p> : null}
    </section>
  );
}

function localSecurityCopy(language: LanguagePreference) {
  if (language === "zh-CN") {
    return {
      eyebrow: "本地解锁",
      initializeTitle: "设置新的本机 PIN 或口令",
      unlockTitle: "敏感工作区已锁定",
      initializeCopy: "请设置一个新的本机 PIN 或口令。它只会以 salted hash 保存在本机 sidecar，不会发送到远程服务，也不会写入日志或诊断包。",
      unlockCopy: "打开 {view} 前需要输入你之前设置的本机 PIN 或口令。",
      secretLabel: "PIN 或口令",
      confirmLabel: "再次输入",
      initializeAction: "设置并解锁",
      unlockAction: "解锁",
      working: "处理中...",
      shortSecret: "至少输入 4 个字符。",
      mismatch: "两次输入不一致。",
      failed: "本机解锁失败。",
      timeout: "空闲 {minutes} 分钟后自动锁定",
      lockout: "临时锁定至 {time}",
      failedAttempts: "失败次数 {count}/{max}",
      forgotAction: "忘记 PIN？重置本地解锁",
      resetCopy: "这只会重置本机解锁 PIN，不会删除凭证、组合、研究记录或本地数据库。重置后需要立刻设置新的 PIN。",
      resetLabel: `输入 ${RESET_CONFIRMATION} 确认`,
      resetAction: "重置并重新设置 PIN",
      resetFailed: "本地解锁重置失败。",
    };
  }
  return {
    eyebrow: "Local unlock",
    initializeTitle: "Set a new local PIN or passphrase",
    unlockTitle: "Sensitive workspace locked",
    initializeCopy:
      "Set a new local PIN or passphrase. It stays local as a salted hash in the sidecar and is not sent remotely or written to logs.",
    unlockCopy: "Enter the local PIN or passphrase you set earlier before opening {view}.",
    secretLabel: "PIN or passphrase",
    confirmLabel: "Confirm",
    initializeAction: "Set and unlock",
    unlockAction: "Unlock",
    working: "Working...",
    shortSecret: "Enter at least 4 characters.",
    mismatch: "The two entries do not match.",
    failed: "Local unlock failed.",
    timeout: "Auto-locks after {minutes} minutes idle",
    lockout: "Temporarily locked until {time}",
    failedAttempts: "Failed attempts {count}/{max}",
    forgotAction: "Forgot PIN? Reset local unlock",
    resetCopy:
      "This only resets the local unlock PIN. It does not delete credentials, portfolios, research, or local databases. You will set a new PIN next.",
    resetLabel: `Type ${RESET_CONFIRMATION} to confirm`,
    resetAction: "Reset and set a new PIN",
    resetFailed: "Local unlock reset failed.",
  };
}
