// src-tauri/src/lib.rs

mod commands;
mod config;
mod scanner;
mod validator;

use commands::*;

const APP_ICON_256: &[u8] = include_bytes!("../icons/128x128@2x.png");

const DESKTOP_ENTRY: &str = "\
[Desktop Entry]
Name=Nixie
Comment=NixOS flake config manager
Exec=nixie
Icon=nixie
Type=Application
Categories=System;Settings;
Terminal=false
StartupWMClass=nixie
";

fn install_desktop_files() {
    let Some(home) = dirs::home_dir() else { return };

    let icon_dir = home.join(".local/share/icons/hicolor/256x256/apps");
    if std::fs::create_dir_all(&icon_dir).is_ok() {
        let _ = std::fs::write(icon_dir.join("nixie.png"), APP_ICON_256);
    }

    let apps_dir = home.join(".local/share/applications");
    if std::fs::create_dir_all(&apps_dir).is_ok() {
        let _ = std::fs::write(apps_dir.join("nixie.desktop"), DESKTOP_ENTRY);
        let _ = std::process::Command::new("update-desktop-database")
            .arg(&apps_dir)
            .output();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            install_desktop_files();
            Ok(())
        })
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
            write_nix_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
