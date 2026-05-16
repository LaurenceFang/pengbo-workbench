import { invoke } from "@tauri-apps/api/core";

export type SidecarStatus = "starting" | "online" | "offline";
export type RuntimeMode = "web" | "tauri";
export type DesktopConnectionStatus = "connecting" | "online" | "offline";

export type RuntimeConfig = {
  baseUrl: string;
  mode: RuntimeMode;
  sidecarStatus: SidecarStatus;
  dataDir: string | null;
  logDir: string | null;
  diagnosticsDir: string | null;
  stdoutLogPath: string | null;
  stderrLogPath: string | null;
  lastErrorLogPath: string | null;
  bootstrapLogPath: string | null;
  buildSummaryPath: string | null;
  lastError: string | null;
};

const webConfig: RuntimeConfig = {
  baseUrl: "/api/v1",
  mode: "web",
  sidecarStatus: "online",
  dataDir: null,
  logDir: null,
  diagnosticsDir: null,
  stdoutLogPath: null,
  stderrLogPath: null,
  lastErrorLogPath: null,
  bootstrapLogPath: null,
  buildSummaryPath: null,
  lastError: null,
};

const DESKTOP_FALLBACK_BASE_URL = "http://127.0.0.1:8765/api/v1";
const RUNTIME_RETRY_DELAYS_MS = [0, 150, 300, 600, 1_000];

let runtimePromise: Promise<RuntimeConfig> | null = null;
let lastResolvedRuntimeConfig: RuntimeConfig | null = null;

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function buildFallbackTauriRuntime(lastError: string | null): RuntimeConfig {
  const previous = lastResolvedRuntimeConfig;

  return {
    baseUrl: previous?.baseUrl ?? DESKTOP_FALLBACK_BASE_URL,
    mode: "tauri",
    sidecarStatus: "offline",
    dataDir: previous?.dataDir ?? null,
    logDir: previous?.logDir ?? null,
    diagnosticsDir: previous?.diagnosticsDir ?? null,
    stdoutLogPath: previous?.stdoutLogPath ?? null,
    stderrLogPath: previous?.stderrLogPath ?? null,
    lastErrorLogPath: previous?.lastErrorLogPath ?? null,
    bootstrapLogPath: previous?.bootstrapLogPath ?? null,
    buildSummaryPath: previous?.buildSummaryPath ?? null,
    lastError,
  };
}

function formatRuntimeInvokeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "桌面端暂时无法读取本地运行时配置。";
}

async function resolveRuntimeConfigWithRetry(): Promise<RuntimeConfig> {
  let lastError: unknown = null;

  for (const delayMs of RUNTIME_RETRY_DELAYS_MS) {
    if (delayMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }

    try {
      return await invoke<RuntimeConfig>("get_runtime_config");
    } catch (error) {
      lastError = error;
    }
  }

  return buildFallbackTauriRuntime(formatRuntimeInvokeError(lastError));
}

export async function getRuntimeConfig(options: { forceRefresh?: boolean } = {}): Promise<RuntimeConfig> {
  if (!isTauriRuntime()) {
    return webConfig;
  }

  if (options.forceRefresh) {
    runtimePromise = null;
  }

  if (!runtimePromise) {
    runtimePromise = resolveRuntimeConfigWithRetry()
      .then((config) => {
        lastResolvedRuntimeConfig = config;
        if (config.sidecarStatus !== "online") {
          runtimePromise = null;
        }
        return config;
      })
      .catch((error: unknown) => {
        runtimePromise = null;
        return buildFallbackTauriRuntime(formatRuntimeInvokeError(error));
      });
  }

  return runtimePromise;
}

export async function refreshRuntimeConfig(): Promise<RuntimeConfig> {
  invalidateRuntimeConfig();
  return getRuntimeConfig();
}

export function invalidateRuntimeConfig(): void {
  runtimePromise = null;
}

export function deriveDesktopConnectionStatus(args: {
  runtime: RuntimeConfig | null;
  runtimeLoading: boolean;
  healthLoading: boolean;
  healthError: string | null;
  recoveryInFlight?: boolean;
}): DesktopConnectionStatus {
  const { runtime, runtimeLoading, healthLoading, healthError, recoveryInFlight = false } = args;

  if (runtimeLoading || recoveryInFlight) {
    return "connecting";
  }

  if (!runtime) {
    return "connecting";
  }

  if (runtime.mode === "web") {
    if (healthLoading) {
      return "connecting";
    }
    return healthError ? "offline" : "online";
  }

  if (runtime.sidecarStatus === "offline") {
    return "offline";
  }

  if (runtime.sidecarStatus !== "online" || healthLoading || healthError) {
    return "connecting";
  }

  return "online";
}
