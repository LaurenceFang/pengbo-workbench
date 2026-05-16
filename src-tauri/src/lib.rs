use std::{
    env,
    fs::{self, File, OpenOptions},
    io::Write,
    net::TcpListener,
    path::{Path, PathBuf},
    process::{Child, Command as ProcessCommand, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use chrono::Local;
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, RunEvent, State};
use tauri_plugin_stronghold::stronghold::Stronghold;

const DEFAULT_PORT: u16 = 8765;
const HEALTH_RETRY_COUNT: usize = 40;
const HEALTH_RETRY_DELAY_MS: u64 = 250;
const STRONGHOLD_CLIENT: &[u8] = b"pengbo-workbench";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
enum SidecarStatus {
    Starting,
    Online,
    Offline,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimeConfig {
    base_url: String,
    mode: &'static str,
    sidecar_status: SidecarStatus,
    data_dir: String,
    log_dir: String,
    diagnostics_dir: String,
    stdout_log_path: String,
    stderr_log_path: String,
    last_error_log_path: String,
    bootstrap_log_path: String,
    build_summary_path: Option<String>,
    last_error: Option<String>,
}

#[derive(Debug, Serialize)]
struct RuntimeCommandResponse {
    ok: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsFileEntry {
    key: String,
    label: String,
    path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsExportResult {
    export_path: String,
    manifest_path: String,
    generated_at: String,
    included_files: Vec<DiagnosticsFileEntry>,
    missing_files: Vec<DiagnosticsFileEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsManifest {
    generated_at: String,
    runtime: RuntimeConfig,
    included_files: Vec<DiagnosticsFileEntry>,
    missing_files: Vec<DiagnosticsFileEntry>,
    excluded_items: Vec<&'static str>,
}

#[derive(Debug, Deserialize, Serialize)]
struct ConnectionTestRequest {
    provider: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct ConnectionTestResponse {
    provider: String,
    status: String,
    message: String,
    stale: bool,
    requires_credentials: bool,
    credential_summary: Option<String>,
    last_tested_at: Option<String>,
    last_success_at: Option<String>,
    cache_updated_at: Option<String>,
    cache_age_seconds: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionSecretPayload {
    api_key: Option<String>,
    secret: Option<String>,
    password: Option<String>,
    identity: Option<String>,
}

#[derive(Debug)]
struct SidecarRuntime {
    status: SidecarStatus,
    port: u16,
    child: Option<Child>,
    generation: u64,
    last_error: Option<String>,
}

impl Default for SidecarRuntime {
    fn default() -> Self {
        Self {
            status: SidecarStatus::Offline,
            port: DEFAULT_PORT,
            child: None,
            generation: 0,
            last_error: None,
        }
    }
}

#[derive(Clone, Default)]
struct AppState {
    sidecar: Arc<Mutex<SidecarRuntime>>,
}

#[derive(Clone, Debug)]
struct RuntimePaths {
    repo_root: Option<PathBuf>,
    data_dir: PathBuf,
    log_dir: PathBuf,
    diagnostics_dir: PathBuf,
    stronghold_path: PathBuf,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Warn)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_stronghold::Builder::new(hash_password).build())
        .invoke_handler(tauri::generate_handler![
            get_runtime_config,
            restart_sidecar,
            export_diagnostics_bundle,
            save_connection_secret,
            clear_connection_secret,
            test_connection
        ])
        .setup(|app| {
            let state = app.state::<AppState>().inner().clone();
            start_sidecar_background(app.handle().clone(), state);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            let state = app_handle.state::<AppState>().inner().clone();
            stop_sidecar(&state);
        }
    });
}

#[tauri::command]
fn get_runtime_config(app: AppHandle, state: State<'_, AppState>) -> Result<RuntimeConfig, String> {
    runtime_config(&app, state.inner())
}

#[tauri::command]
fn restart_sidecar(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<RuntimeCommandResponse, String> {
    start_sidecar(&app, state.inner())?;
    Ok(RuntimeCommandResponse { ok: true })
}

#[tauri::command]
fn export_diagnostics_bundle(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<DiagnosticsExportResult, String> {
    export_diagnostics_bundle_impl(&app, state.inner())
}

#[tauri::command]
fn save_connection_secret(
    app: AppHandle,
    provider: String,
    payload: ConnectionSecretPayload,
) -> Result<RuntimeCommandResponse, String> {
    let paths = runtime_paths(&app)?;
    let bootstrap_log_path = paths.log_dir.join("sidecar-bootstrap.log");
    let provider_key = provider.to_lowercase();
    match provider.to_lowercase().as_str() {
        "binance" => {
            save_secret_value(&app, "binance.api_key", payload.api_key)?;
            save_secret_value(&app, "binance.secret", payload.secret)?;
            save_secret_value(&app, "binance.password", payload.password)?;
        }
        "edgar" => {
            let payload_length = payload.identity.as_deref().unwrap_or_default().trim().len();
            save_secret_value(&app, "edgar.identity", payload.identity)?;
            let persisted_length = load_secret_value(&app, "edgar.identity")?
                .as_deref()
                .unwrap_or_default()
                .trim()
                .len();
            append_log_line(
                &bootstrap_log_path,
                &format!(
                    "credential save provider=edgar payload_length={payload_length} persisted_length={persisted_length}"
                ),
            );
        }
        "fred" => {
            save_secret_value(&app, "fred.api_key", payload.api_key)?;
        }
        "coingecko" => {
            save_secret_value(&app, "coingecko.demo_api_key", payload.api_key)?;
            save_secret_value(&app, "coingecko.pro_api_key", payload.secret)?;
        }
        _ => return Err(format!("unsupported provider: {provider}")),
    }
    if provider_key != "edgar" {
        append_log_line(
            &bootstrap_log_path,
            &format!("credential save provider={provider_key}"),
        );
    }

    Ok(RuntimeCommandResponse { ok: true })
}

#[tauri::command]
fn clear_connection_secret(
    app: AppHandle,
    provider: String,
) -> Result<RuntimeCommandResponse, String> {
    match provider.to_lowercase().as_str() {
        "binance" => {
            save_secret_value(&app, "binance.api_key", None)?;
            save_secret_value(&app, "binance.secret", None)?;
            save_secret_value(&app, "binance.password", None)?;
        }
        "edgar" => {
            save_secret_value(&app, "edgar.identity", None)?;
        }
        "fred" => {
            save_secret_value(&app, "fred.api_key", None)?;
        }
        "coingecko" => {
            save_secret_value(&app, "coingecko.demo_api_key", None)?;
            save_secret_value(&app, "coingecko.pro_api_key", None)?;
        }
        _ => return Err(format!("unsupported provider: {provider}")),
    }

    Ok(RuntimeCommandResponse { ok: true })
}

#[tauri::command]
fn test_connection(
    app: AppHandle,
    state: State<'_, AppState>,
    provider: String,
) -> Result<ConnectionTestResponse, String> {
    if !matches!(state.inner().snapshot().status, SidecarStatus::Online) {
        start_sidecar(&app, state.inner())?;
    }

    let base_url = runtime_config(&app, state.inner())?.base_url;
    let client = http_client()?;
    let response = client
        .post(format!("{base_url}/connections/test"))
        .json(&ConnectionTestRequest { provider })
        .send()
        .map_err(|error| format!("failed to test connection: {error}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().unwrap_or_default();
        return Err(format!("connection test failed with {status}: {body}"));
    }

    response
        .json::<ConnectionTestResponse>()
        .map_err(|error| format!("failed to decode connection test response: {error}"))
}

impl AppState {
    fn snapshot(&self) -> SidecarRuntimeSnapshot {
        let runtime = self.sidecar.lock().expect("poisoned sidecar state");
        SidecarRuntimeSnapshot {
            status: runtime.status,
            port: runtime.port,
            last_error: runtime.last_error.clone(),
        }
    }
}

#[derive(Clone, Debug)]
struct SidecarRuntimeSnapshot {
    status: SidecarStatus,
    port: u16,
    last_error: Option<String>,
}

fn runtime_config(app: &AppHandle, state: &AppState) -> Result<RuntimeConfig, String> {
    let snapshot = state.snapshot();
    let paths = runtime_paths(app)?;
    Ok(RuntimeConfig {
        base_url: format!("http://127.0.0.1:{}/api/v1", snapshot.port),
        mode: "tauri",
        sidecar_status: snapshot.status,
        data_dir: paths.data_dir.to_string_lossy().into_owned(),
        log_dir: paths.log_dir.to_string_lossy().into_owned(),
        diagnostics_dir: paths.diagnostics_dir.to_string_lossy().into_owned(),
        stdout_log_path: paths
            .log_dir
            .join("sidecar-stdout.log")
            .to_string_lossy()
            .into_owned(),
        stderr_log_path: paths
            .log_dir
            .join("sidecar-stderr.log")
            .to_string_lossy()
            .into_owned(),
        last_error_log_path: paths
            .log_dir
            .join("sidecar.last-error.log")
            .to_string_lossy()
            .into_owned(),
        bootstrap_log_path: paths
            .log_dir
            .join("sidecar-bootstrap.log")
            .to_string_lossy()
            .into_owned(),
        build_summary_path: build_summary_source_path(app, &paths)
            .map(|path| path.to_string_lossy().into_owned()),
        last_error: snapshot.last_error,
    })
}

fn export_diagnostics_bundle_impl(
    app: &AppHandle,
    state: &AppState,
) -> Result<DiagnosticsExportResult, String> {
    let runtime = runtime_config(app, state)?;
    let paths = runtime_paths(app)?;
    fs::create_dir_all(&paths.diagnostics_dir)
        .map_err(|error| format!("failed to create diagnostics root: {error}"))?;

    let generated_at = Local::now();
    let export_dir = paths.diagnostics_dir.join(format!(
        "pengbo-diagnostics-{}",
        generated_at.format("%Y%m%d-%H%M%S")
    ));
    fs::create_dir_all(&export_dir)
        .map_err(|error| format!("failed to create diagnostics bundle directory: {error}"))?;

    let runtime_path = export_dir.join("runtime.json");
    write_json_file(&runtime_path, &runtime)?;

    let mut included_files = vec![diagnostic_file_entry(
        "runtime",
        "Runtime snapshot",
        Some(runtime_path.clone()),
    )];
    let mut missing_files = Vec::new();

    collect_diagnostic_file(
        &export_dir,
        "stdout",
        "Sidecar stdout log",
        Some(paths.log_dir.join("sidecar-stdout.log")),
        "sidecar-stdout.log",
        &mut included_files,
        &mut missing_files,
    )?;
    collect_diagnostic_file(
        &export_dir,
        "stderr",
        "Sidecar stderr log",
        Some(paths.log_dir.join("sidecar-stderr.log")),
        "sidecar-stderr.log",
        &mut included_files,
        &mut missing_files,
    )?;
    collect_diagnostic_file(
        &export_dir,
        "lastError",
        "Last error log",
        Some(paths.log_dir.join("sidecar.last-error.log")),
        "sidecar.last-error.log",
        &mut included_files,
        &mut missing_files,
    )?;
    collect_diagnostic_file(
        &export_dir,
        "bootstrap",
        "Bootstrap log",
        Some(paths.log_dir.join("sidecar-bootstrap.log")),
        "sidecar-bootstrap.log",
        &mut included_files,
        &mut missing_files,
    )?;
    collect_diagnostic_file(
        &export_dir,
        "buildSummary",
        "Latest sidecar build summary",
        build_summary_source_path(app, &paths),
        "sidecar-build-latest.json",
        &mut included_files,
        &mut missing_files,
    )?;

    let manifest_path = export_dir.join("manifest.json");
    let manifest = DiagnosticsManifest {
        generated_at: generated_at.to_rfc3339(),
        runtime: runtime.clone(),
        included_files: included_files.clone(),
        missing_files: missing_files.clone(),
        excluded_items: vec![
            "Stronghold snapshots are never exported.",
            "Secrets and environment variables are never exported in plaintext.",
            "Credential values are intentionally omitted from runtime snapshots.",
        ],
    };
    write_json_file(&manifest_path, &manifest)?;
    included_files.push(diagnostic_file_entry(
        "manifest",
        "Bundle manifest",
        Some(manifest_path.clone()),
    ));

    Ok(DiagnosticsExportResult {
        export_path: export_dir.to_string_lossy().into_owned(),
        manifest_path: manifest_path.to_string_lossy().into_owned(),
        generated_at: generated_at.to_rfc3339(),
        included_files,
        missing_files,
    })
}

fn start_sidecar(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let started_at = Instant::now();
    let paths = runtime_paths(app)?;
    fs::create_dir_all(&paths.data_dir)
        .map_err(|error| format!("failed to create data dir: {error}"))?;
    fs::create_dir_all(&paths.log_dir)
        .map_err(|error| format!("failed to create log dir: {error}"))?;
    if let Some(parent) = paths.stronghold_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create stronghold dir: {error}"))?;
    }
    let bootstrap_log = paths.log_dir.join("sidecar-bootstrap.log");
    trim_bootstrap_log(&bootstrap_log);
    append_log_line(
        &bootstrap_log,
        &format!(
            "startup phase -> paths resolved elapsed_ms={}",
            started_at.elapsed().as_millis()
        ),
    );

    stop_sidecar(state);

    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!(
            "startup phase -> adopt existing probe elapsed_ms={}",
            started_at.elapsed().as_millis()
        ),
    );
    if adopt_existing_sidecar(state, &paths.log_dir)? {
        return Ok(());
    }

    let port = pick_sidecar_port()?;
    let base_url = sidecar_base_url(port);
    let generation = {
        let mut runtime = state.sidecar.lock().expect("poisoned sidecar state");
        runtime.generation += 1;
        runtime.status = SidecarStatus::Starting;
        runtime.port = port;
        runtime.last_error = None;
        runtime.generation
    };

    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!("runtime status -> starting (generation={generation}, base_url={base_url})"),
    );

    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!(
            "startup phase -> build command requested (generation={generation}, elapsed_ms={})",
            started_at.elapsed().as_millis()
        ),
    );
    let mut command = build_sidecar_command(app, &paths, port)?;
    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!(
            "startup phase -> build command ready (generation={generation}, elapsed_ms={})",
            started_at.elapsed().as_millis()
        ),
    );
    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!(
            "startup phase -> sidecar spawn requested (generation={generation}, elapsed_ms={})",
            started_at.elapsed().as_millis()
        ),
    );
    let child = command
        .spawn()
        .map_err(|error| format!("failed to spawn sidecar: {error}"))?;
    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!(
            "startup phase -> sidecar spawned (generation={generation}, elapsed_ms={})",
            started_at.elapsed().as_millis()
        ),
    );

    {
        let mut runtime = state.sidecar.lock().expect("poisoned sidecar state");
        runtime.child = Some(child);
    }

    if let Err(error) = wait_for_health(&base_url) {
        let failure_message = error.clone();
        mark_sidecar_offline(state, generation, Some(failure_message.clone()));
        stop_sidecar(state);
        append_log_line(
            &paths.log_dir.join("sidecar.last-error.log"),
            &failure_message,
        );
        append_log_line(
            &paths.log_dir.join("sidecar-bootstrap.log"),
            &format!("health probe failed for {base_url}: {failure_message}"),
        );
        return Err(error);
    }

    let mut runtime = state.sidecar.lock().expect("poisoned sidecar state");
    if runtime.generation == generation {
        runtime.status = SidecarStatus::Online;
        runtime.last_error = None;
    }
    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!("runtime status -> online (generation={generation}, base_url={base_url})"),
    );
    append_log_line(
        &paths.log_dir.join("sidecar-bootstrap.log"),
        &format!(
            "startup phase -> health ready (generation={generation}, elapsed_ms={})",
            started_at.elapsed().as_millis()
        ),
    );

    Ok(())
}

fn start_sidecar_background(app: AppHandle, state: AppState) {
    let bootstrap_log_path = runtime_paths(&app)
        .ok()
        .map(|paths| paths.log_dir.join("sidecar-bootstrap.log"));
    if let Some(path) = bootstrap_log_path.as_deref() {
        trim_bootstrap_log(path);
        append_log_line(
            path,
            "startup phase -> setup returned before sidecar health wait",
        );
    }
    thread::spawn(move || {
        if let Err(error) = start_sidecar(&app, &state) {
            log::error!("failed to start sidecar in background: {error}");
            if let Some(path) = bootstrap_log_path.as_deref() {
                append_log_line(
                    path,
                    &format!("startup phase -> background start failed ({error})"),
                );
            }
        }
    });
}

fn stop_sidecar(state: &AppState) {
    let child = {
        let mut runtime = state.sidecar.lock().expect("poisoned sidecar state");
        runtime.status = SidecarStatus::Offline;
        runtime.child.take()
    };

    if let Some(child) = child {
        kill_command_child(child);
    }
}

fn mark_sidecar_offline(state: &AppState, generation: u64, error: Option<String>) {
    let mut runtime = state.sidecar.lock().expect("poisoned sidecar state");
    if runtime.generation != generation {
        return;
    }

    runtime.status = SidecarStatus::Offline;
    runtime.child = None;
    runtime.last_error = error;
}

fn build_sidecar_command(
    app: &AppHandle,
    paths: &RuntimePaths,
    port: u16,
) -> Result<ProcessCommand, String> {
    let runtime_mode = if cfg!(debug_assertions) {
        "tauri-dev"
    } else {
        "tauri"
    };
    let sidecar_args = vec![
        "--host".to_string(),
        "127.0.0.1".to_string(),
        "--port".to_string(),
        port.to_string(),
        "--runtime-mode".to_string(),
        runtime_mode.to_string(),
        "--data-dir".to_string(),
        paths.data_dir.to_string_lossy().into_owned(),
        "--log-dir".to_string(),
        paths.log_dir.to_string_lossy().into_owned(),
    ];
    let envs = sidecar_envs(app)?;

    if cfg!(debug_assertions) {
        let repo_root = paths
            .repo_root
            .clone()
            .ok_or_else(|| "missing repo root for debug sidecar launch".to_string())?;
        let mut args = vec!["-m".to_string(), "backend.app.cli".to_string()];
        args.extend(sidecar_args);
        let mut command = ProcessCommand::new("py");
        command
            .args(args)
            .current_dir(repo_root)
            .env("PYTHONIOENCODING", "utf-8")
            .envs(envs)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        Ok(command)
    } else {
        let sidecar_exe = bundled_sidecar_exe_path(app)?;
        let sidecar_dir = sidecar_exe
            .parent()
            .ok_or_else(|| format!("sidecar path has no parent: {}", sidecar_exe.display()))?
            .to_path_buf();
        append_log_line(
            &paths.log_dir.join("sidecar-bootstrap.log"),
            &format!(
                "startup phase -> bundled sidecar path {} elapsed_ms=env_ready",
                sidecar_exe.display()
            ),
        );
        let mut command = ProcessCommand::new(sidecar_exe);
        command
            .args(sidecar_args)
            .current_dir(sidecar_dir)
            .env("PYTHONIOENCODING", "utf-8")
            .envs(envs)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        Ok(command)
    }
}

fn bundled_sidecar_exe_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("pengbo-sidecar")
                .join("pengbo-sidecar.exe"),
        );
        candidates.push(
            resource_dir
                .join("binaries")
                .join("pengbo-sidecar")
                .join("pengbo-sidecar.exe"),
        );
    }
    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(
                exe_dir
                    .join("binaries")
                    .join("pengbo-sidecar")
                    .join("pengbo-sidecar.exe"),
            );
            candidates.push(exe_dir.join("pengbo-sidecar").join("pengbo-sidecar.exe"));
            candidates.push(
                exe_dir
                    .join("resources")
                    .join("pengbo-sidecar")
                    .join("pengbo-sidecar.exe"),
            );
            candidates.push(
                exe_dir
                    .join("resources")
                    .join("binaries")
                    .join("pengbo-sidecar")
                    .join("pengbo-sidecar.exe"),
            );
            candidates.push(exe_dir.join("pengbo-sidecar.exe"));
        }
    }

    candidates
        .into_iter()
        .find(|candidate| candidate.exists())
        .ok_or_else(|| "failed to resolve bundled sidecar executable".to_string())
}

fn sidecar_envs(app: &AppHandle) -> Result<Vec<(String, String)>, String> {
    let mut envs = vec![];
    let paths = runtime_paths(app)?;
    let (_stronghold, client) = open_stronghold(app)?;

    let edgar_identity = load_secret_value_from_client(&client, "edgar.identity")?
        .or_else(|| env::var("EDGAR_IDENTITY").ok())
        .filter(|value| !value.trim().is_empty());
    if let Some(identity) = edgar_identity {
        envs.push(("EDGAR_IDENTITY".to_string(), identity));
    }

    let binance_api_key = load_secret_value_from_client(&client, "binance.api_key")?
        .or_else(|| env::var("PENGBO_BINANCE_API_KEY").ok())
        .filter(|value| !value.trim().is_empty());
    if let Some(api_key) = binance_api_key {
        envs.push(("PENGBO_BINANCE_API_KEY".to_string(), api_key));
    }

    let binance_secret = load_secret_value_from_client(&client, "binance.secret")?
        .or_else(|| env::var("PENGBO_BINANCE_SECRET").ok())
        .filter(|value| !value.trim().is_empty());
    if let Some(secret) = binance_secret {
        envs.push(("PENGBO_BINANCE_SECRET".to_string(), secret));
    }

    let binance_password = load_secret_value_from_client(&client, "binance.password")?
        .or_else(|| env::var("PENGBO_BINANCE_PASSWORD").ok())
        .filter(|value| !value.trim().is_empty());
    if let Some(password) = binance_password {
        envs.push(("PENGBO_BINANCE_PASSWORD".to_string(), password));
    }

    let fred_api_key = load_secret_value_from_client(&client, "fred.api_key")?
        .or_else(|| env::var("PENGBO_FRED_API_KEY").ok())
        .or_else(|| env::var("FRED_API_KEY").ok())
        .filter(|value| !value.trim().is_empty());
    if let Some(api_key) = fred_api_key {
        envs.push(("PENGBO_FRED_API_KEY".to_string(), api_key));
    }

    let coingecko_demo_api_key = load_secret_value_from_client(&client, "coingecko.demo_api_key")?
        .or_else(|| env::var("PENGBO_COINGECKO_DEMO_API_KEY").ok())
        .filter(|value| !value.trim().is_empty());
    if let Some(api_key) = coingecko_demo_api_key {
        envs.push(("PENGBO_COINGECKO_DEMO_API_KEY".to_string(), api_key));
    }

    let coingecko_pro_api_key = load_secret_value_from_client(&client, "coingecko.pro_api_key")?
        .or_else(|| env::var("PENGBO_COINGECKO_PRO_API_KEY").ok())
        .filter(|value| !value.trim().is_empty());
    if let Some(api_key) = coingecko_pro_api_key {
        envs.push(("PENGBO_COINGECKO_PRO_API_KEY".to_string(), api_key));
    }
    if let Some(build_summary_path) = build_summary_source_path(app, &paths) {
        envs.push((
            "PENGBO_BUILD_SUMMARY_PATH".to_string(),
            build_summary_path.to_string_lossy().into_owned(),
        ));
    }

    Ok(envs)
}

fn save_secret_value(app: &AppHandle, key: &str, value: Option<String>) -> Result<(), String> {
    let (stronghold, client) = open_stronghold(app)?;
    let store = client.store();
    match value {
        Some(value) if !value.trim().is_empty() => {
            store
                .insert(key.as_bytes().to_vec(), value.into_bytes(), None)
                .map_err(|error| format!("failed to save secret {key}: {error}"))?;
        }
        _ => {
            let _ = store.delete(key.as_bytes());
        }
    }
    stronghold
        .save()
        .map_err(|error| format!("failed to persist stronghold snapshot: {error}"))
}

fn load_secret_value(app: &AppHandle, key: &str) -> Result<Option<String>, String> {
    let (_stronghold, client) = open_stronghold(app)?;
    load_secret_value_from_client(&client, key)
}

fn load_secret_value_from_client(
    client: &iota_stronghold::Client,
    key: &str,
) -> Result<Option<String>, String> {
    let store = client.store();
    let value = store
        .get(key.as_bytes())
        .map_err(|error| format!("failed to read secret {key}: {error}"))?;

    value
        .map(|bytes| {
            String::from_utf8(bytes)
                .map_err(|error| format!("secret {key} is not valid UTF-8: {error}"))
        })
        .transpose()
}

fn open_stronghold(app: &AppHandle) -> Result<(Stronghold, iota_stronghold::Client), String> {
    let paths = runtime_paths(app)?;
    let stronghold = Stronghold::new(&paths.stronghold_path, stronghold_key_material(app))
        .map_err(|error| format!("failed to open stronghold snapshot: {error}"))?;
    let client = stronghold
        .load_client(STRONGHOLD_CLIENT)
        .or_else(|_| stronghold.create_client(STRONGHOLD_CLIENT))
        .map_err(|error| format!("failed to open stronghold client: {error}"))?;

    Ok((stronghold, client))
}

fn stronghold_key_material(app: &AppHandle) -> Vec<u8> {
    let identifier = app.config().identifier.clone();
    let username = env::var("USERNAME").unwrap_or_else(|_| "unknown-user".to_string());
    let computer = env::var("COMPUTERNAME").unwrap_or_else(|_| "unknown-host".to_string());
    hash_password(&format!("pengbo::{identifier}::{username}::{computer}"))
}

fn hash_password(password: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    hasher.finalize().to_vec()
}

fn pick_sidecar_port() -> Result<u16, String> {
    if TcpListener::bind(("127.0.0.1", DEFAULT_PORT)).is_ok() {
        return Ok(DEFAULT_PORT);
    }

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| format!("failed to find an open port for sidecar: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("failed to read chosen sidecar port: {error}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn sidecar_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/api/v1")
}

fn adopt_existing_sidecar(state: &AppState, log_dir: &Path) -> Result<bool, String> {
    let base_url = sidecar_base_url(DEFAULT_PORT);
    if wait_for_health_attempts_with_timeout(
        &base_url,
        3,
        Duration::from_millis(250),
        Duration::from_millis(75),
    )
    .is_err()
    {
        return Ok(false);
    }

    let generation = {
        let mut runtime = state.sidecar.lock().expect("poisoned sidecar state");
        runtime.generation += 1;
        runtime.status = SidecarStatus::Online;
        runtime.port = DEFAULT_PORT;
        runtime.child = None;
        runtime.last_error = None;
        runtime.generation
    };

    append_log_line(
        &log_dir.join("sidecar-bootstrap.log"),
        &format!("runtime status -> online (generation={generation}, base_url={base_url}, adopted_existing=true)"),
    );
    Ok(true)
}

fn wait_for_health(base_url: &str) -> Result<(), String> {
    wait_for_health_attempts(base_url, HEALTH_RETRY_COUNT)
}

fn wait_for_health_attempts(base_url: &str, attempts: usize) -> Result<(), String> {
    wait_for_health_attempts_with_timeout(
        base_url,
        attempts,
        Duration::from_secs(3),
        Duration::from_millis(HEALTH_RETRY_DELAY_MS),
    )
}

fn wait_for_health_attempts_with_timeout(
    base_url: &str,
    attempts: usize,
    request_timeout: Duration,
    retry_delay: Duration,
) -> Result<(), String> {
    let client = http_client_with_timeout(request_timeout)?;
    let health_url = format!("{base_url}/health");

    for _ in 0..attempts {
        match client.get(&health_url).send() {
            Ok(response) if response.status().is_success() => return Ok(()),
            _ => thread::sleep(retry_delay),
        }
    }

    Err(format!(
        "sidecar health check timed out after {} attempts",
        attempts
    ))
}

fn kill_command_child(mut child: Child) {
    #[cfg(windows)]
    {
        let pid = child.id();
        if kill_process_tree(pid).is_ok() {
            return;
        }
        let _ = child.kill();
    }

    #[cfg(not(windows))]
    {
        let _ = child.kill();
    }
}

#[cfg(windows)]
fn kill_process_tree(pid: u32) -> Result<(), String> {
    let output = ProcessCommand::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output()
        .map_err(|error| format!("failed to run taskkill for pid {pid}: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let detail = if !stderr.is_empty() { stderr } else { stdout };
    Err(format!("taskkill failed for pid {pid}: {detail}"))
}

fn http_client() -> Result<Client, String> {
    http_client_with_timeout(Duration::from_secs(3))
}

fn http_client_with_timeout(timeout: Duration) -> Result<Client, String> {
    Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("failed to build HTTP client: {error}"))
}

fn runtime_paths(app: &AppHandle) -> Result<RuntimePaths, String> {
    if cfg!(debug_assertions) {
        let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .expect("src-tauri should have a repo root")
            .to_path_buf();
        let runtime_root = repo_root.join(".pengbo-runtime");
        return Ok(RuntimePaths {
            repo_root: Some(repo_root),
            data_dir: runtime_root.join("data"),
            log_dir: runtime_root.join("logs"),
            diagnostics_dir: runtime_root.join("data").join("diagnostics"),
            stronghold_path: runtime_root.join("stronghold").join("pengbo.hold"),
        });
    }

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?;
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|error| format!("failed to resolve app log dir: {error}"))?;
    let stronghold_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("failed to resolve app local data dir: {error}"))?;
    let diagnostics_dir = data_dir.join("diagnostics");

    Ok(RuntimePaths {
        repo_root: None,
        diagnostics_dir,
        data_dir,
        log_dir,
        stronghold_path: stronghold_dir.join("stronghold").join("pengbo.hold"),
    })
}

fn build_summary_source_path(app: &AppHandle, paths: &RuntimePaths) -> Option<PathBuf> {
    if let Some(repo_root) = &paths.repo_root {
        return Some(repo_root.join("logs").join("sidecar-build-latest.json"));
    }

    app.path()
        .resource_dir()
        .ok()
        .map(|resource_dir| resource_dir.join("sidecar-build-latest.json"))
}

fn diagnostic_file_entry(key: &str, label: &str, path: Option<PathBuf>) -> DiagnosticsFileEntry {
    DiagnosticsFileEntry {
        key: key.to_string(),
        label: label.to_string(),
        path: path.map(|value| value.to_string_lossy().into_owned()),
    }
}

fn collect_diagnostic_file(
    export_dir: &Path,
    key: &str,
    label: &str,
    source_path: Option<PathBuf>,
    export_name: &str,
    included_files: &mut Vec<DiagnosticsFileEntry>,
    missing_files: &mut Vec<DiagnosticsFileEntry>,
) -> Result<(), String> {
    let Some(source_path) = source_path else {
        missing_files.push(diagnostic_file_entry(key, label, None));
        return Ok(());
    };

    if !source_path.exists() {
        missing_files.push(diagnostic_file_entry(key, label, Some(source_path)));
        return Ok(());
    }

    let target_path = export_dir.join(export_name);
    fs::copy(&source_path, &target_path)
        .map_err(|error| format!("failed to copy {label}: {error}"))?;
    included_files.push(diagnostic_file_entry(key, label, Some(target_path)));
    Ok(())
}

fn write_json_file<T: Serialize>(path: &Path, payload: &T) -> Result<(), String> {
    let file = File::create(path)
        .map_err(|error| format!("failed to create {}: {error}", path.display()))?;
    serde_json::to_writer_pretty(file, payload)
        .map_err(|error| format!("failed to write {}: {error}", path.display()))
}

fn append_log_line(path: &Path, message: &str) {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(mut file) = OpenOptions::new().append(true).create(true).open(path) {
        let _ = writeln!(file, "{message}");
    }
}

fn trim_bootstrap_log(path: &Path) {
    const MAX_BOOTSTRAP_LOG_BYTES: u64 = 8 * 1024;
    if let Ok(metadata) = fs::metadata(path) {
        if metadata.len() > MAX_BOOTSTRAP_LOG_BYTES {
            let _ = fs::write(path, "startup phase -> bootstrap log trimmed\n");
        }
    }
}
