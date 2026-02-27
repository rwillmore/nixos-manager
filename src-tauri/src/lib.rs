// src-tauri/src/lib.rs

mod commands;
mod config;
mod scanner;
mod validator;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            // Config management
            get_configs,
            add_config,
            remove_config,
            update_config,
            // Flake scanning
            scan_flake_roots,
            // Nix host discovery
            get_flake_hosts,
            // Build / Apply workflow
            preview_config,
            apply_config,
            // Flake update
            update_flake,
            // Git backup
            backup_config,
            // Validation
            validate_path,
            // File browsing
            list_nix_files,
            read_nix_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
