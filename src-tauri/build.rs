use std::{env, fs, path::PathBuf};

fn main() {
    ensure_sidecar_placeholder();
    tauri_build::build()
}

fn ensure_sidecar_placeholder() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("missing manifest dir"));
    let target = env::var("TARGET").expect("missing cargo target");
    let extension = if cfg!(windows) { "exe" } else { "" };
    let binaries_dir = manifest_dir.join("binaries");
    let binary_name = if extension.is_empty() {
        format!("pengbo-sidecar-{target}")
    } else {
        format!("pengbo-sidecar-{target}.{extension}")
    };
    let binary_path = binaries_dir.join(binary_name);

    if binary_path.exists() {
        return;
    }

    fs::create_dir_all(&binaries_dir).expect("failed to create binaries dir");
    fs::write(&binary_path, []).expect("failed to create placeholder sidecar");
}
