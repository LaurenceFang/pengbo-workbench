import {
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  KeyRound,
  Lock,
  PlayCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type {
  DemoModeStatus,
  LocalSecurityStatus,
  OnboardingState,
  OnboardingStepKey,
  SetupStatus,
} from "../lib/api";
import type { ViewKey, LanguagePreference } from "../store/app-store";
import type { BackendStatus } from "./shared";

type StepDefinition = {
  key: OnboardingStepKey;
  icon: typeof PlayCircle;
  view: ViewKey;
  zh: {
    title: string;
    copy: string;
    action: string;
  };
  en: {
    title: string;
    copy: string;
    action: string;
  };
};

const steps: StepDefinition[] = [
  {
    key: "demo_mode",
    icon: PlayCircle,
    view: "dashboard",
    zh: {
      title: "无 key demo 可以先跑通主流程",
      copy: "行情、自选、资产页、研究模板、因子实验和样例组合可用于首轮评估；缺少凭证的能力会明确标记。",
      action: "查看仪表盘",
    },
    en: {
      title: "No-key demo can exercise the core flow",
      copy: "Quotes, watchlists, asset pages, research templates, factor runs, and sample portfolio views are available for first evaluation.",
      action: "View dashboard",
    },
  },
  {
    key: "provider_setup",
    icon: DatabaseZap,
    view: "connections",
    zh: {
      title: "数据源凭证保持可见、可跳过",
      copy: "EDGAR、FRED、CoinGecko 和 Binance 私有账户能力会显示缺失原因；reviewer 可先跳过继续探索。",
      action: "打开连接",
    },
    en: {
      title: "Provider credentials stay visible and skippable",
      copy: "EDGAR, FRED, CoinGecko, and Binance private account capabilities show their missing state while reviewers keep exploring.",
      action: "Open connections",
    },
  },
  {
    key: "local_unlock",
    icon: Lock,
    view: "settings",
    zh: {
      title: "敏感区由本地 PIN 或口令保护",
      copy: "连接凭证、执行设置和安全审计需要本机解锁；口令不上传，也不会写入日志或诊断包。",
      action: "检查本地安全",
    },
    en: {
      title: "Sensitive areas use a local PIN or passphrase",
      copy: "Credentials, execution settings, and security audit views require local unlock; the secret is not uploaded or written to logs.",
      action: "Inspect local security",
    },
  },
  {
    key: "privacy_boundary",
    icon: ShieldCheck,
    view: "dataSources",
    zh: {
      title: "隐私和诊断边界是本地优先",
      copy: "数据目录、日志目录、诊断包路径在 Settings 可查；导出用于支持排障，不创建托管账户或远程同步。",
      action: "查看数据边界",
    },
    en: {
      title: "Privacy and diagnostics are local-first",
      copy: "Data, log, and diagnostics paths are inspectable in Settings; support exports do not create hosted accounts or remote sync.",
      action: "Review data boundaries",
    },
  },
  {
    key: "execution_boundary",
    icon: WalletCards,
    view: "strategyLab",
    zh: {
      title: "实盘执行默认关闭且必须显式确认",
      copy: "回测和 paper session 可本地演练；Binance live submit 仍需要凭证、风控确认和用户可见提交动作。",
      action: "查看策略实验室",
    },
    en: {
      title: "Live execution is off by default and confirmation-gated",
      copy: "Backtests and paper sessions can run locally; Binance live submit still requires credentials, risk acknowledgement, and visible confirmation.",
      action: "Open Strategy Lab",
    },
  },
];

export function FirstRunOnboarding({
  state,
  demoMode,
  setupStatus,
  localSecurity,
  backendStatus,
  language,
  busy,
  onToggleStep,
  onDismiss,
  onOpenView,
}: {
  state: OnboardingState;
  demoMode: DemoModeStatus | null;
  setupStatus: SetupStatus;
  localSecurity: LocalSecurityStatus | null;
  backendStatus: BackendStatus;
  language: LanguagePreference;
  busy: boolean;
  onToggleStep: (key: OnboardingStepKey, completed: boolean) => Promise<void>;
  onDismiss: () => Promise<void>;
  onOpenView: (view: ViewKey) => void;
}) {
  const isZh = language === "zh-CN";
  const completedKeys = new Set(state.checklist.filter((item) => item.completed_at).map((item) => item.key));
  const completedCount = completedKeys.size;
  const missingCredentials = demoMode?.missing_credentials ?? [];
  const allDone = completedCount === steps.length;

  return (
    <section aria-label="first-run-onboarding" className="card first-run-panel">
      <div className="first-run-hero">
        <div>
          <p className="eyebrow">{isZh ? "首次运行" : "First run"}</p>
          <h3>{isZh ? "用 5 分钟确认 Pengbo 的安全探索路径" : "Confirm Pengbo's safe evaluation path in five minutes"}</h3>
          <p className="body-copy">
            {isZh
              ? "这份本地 checklist 帮 reviewer 分清哪些能力可立即评估，哪些需要凭证或本地解锁，以及哪些实盘动作仍被刻意挡住。"
              : "This local checklist helps reviewers separate what is ready to evaluate, what needs credentials or local unlock, and what remains intentionally blocked."}
          </p>
        </div>
        <div className="first-run-progress" aria-label={`onboarding-progress ${completedCount}/${steps.length}`}>
          <strong>{completedCount}/{steps.length}</strong>
          <span>{isZh ? "已确认" : "confirmed"}</span>
        </div>
      </div>

      <div className="onboarding-status-grid">
        <div>
          <strong>{isZh ? "运行时" : "Runtime"}</strong>
          <span>{backendStatus === "online" ? (isZh ? "本地 sidecar 在线" : "Local sidecar online") : backendStatus}</span>
        </div>
        <div>
          <strong>{isZh ? "凭证缺口" : "Credential gaps"}</strong>
          <span>{missingCredentials.length > 0 ? missingCredentials.join(", ") : isZh ? "核心凭证已配置" : "Core credentials configured"}</span>
        </div>
        <div>
          <strong>{isZh ? "本地解锁" : "Local unlock"}</strong>
          <span>
            {localSecurity?.initialized
              ? localSecurity.locked
                ? isZh ? "已初始化，当前锁定" : "Initialized, currently locked"
                : isZh ? "已解锁" : "Unlocked"
              : isZh ? "尚未初始化" : "Not initialized"}
          </span>
        </div>
      </div>

      <div className="onboarding-checklist">
        {steps.map((step) => {
          const Icon = step.icon;
          const copy = isZh ? step.zh : step.en;
          const completed = completedKeys.has(step.key);
          return (
            <article className={`onboarding-step ${completed ? "complete" : ""}`} key={step.key}>
              <button
                aria-label={`onboarding-step-toggle key=${step.key} state=${completed ? "complete" : "pending"}`}
                className="icon-button onboarding-check"
                disabled={busy}
                onClick={() => void onToggleStep(step.key, !completed)}
                type="button"
              >
                <CheckCircle2 size={18} />
              </button>
              <div className="onboarding-step-icon">
                <Icon size={18} />
              </div>
              <div>
                <h4>{copy.title}</h4>
                <p>{copy.copy}</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => onOpenView(step.view)}>
                {copy.action}
                <ArrowRight size={15} />
              </button>
            </article>
          );
        })}
      </div>

      {setupStatus.missingProviders.length > 0 ? (
        <p className="panel-note">
          {isZh
            ? `仍缺少这些 provider 配置：${setupStatus.missingProviders.join(", ")}。你可以先跳过，缺凭证能力会继续以 gated 状态展示。`
            : `Still missing provider setup for: ${setupStatus.missingProviders.join(", ")}. You can skip for now; credential-gated capabilities remain labeled.`}
        </p>
      ) : null}

      <div className="hero-actions">
        <button className="primary-button" disabled={busy || !allDone} onClick={() => void onDismiss()} type="button">
          {isZh ? "完成并收起导览" : "Complete and dismiss"}
        </button>
        <button className="ghost-button" disabled={busy} onClick={() => void onDismiss()} type="button">
          {isZh ? "暂时跳过" : "Skip for now"}
        </button>
      </div>
    </section>
  );
}
