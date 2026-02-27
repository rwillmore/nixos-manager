// src-tauri/src/commands.rs
use crate::config::{load_configs, save_configs, FlakeConfig};
use crate::scanner::scan_for_flake_roots;
use crate::validator::{build_flake_ref, validate_flake_path, validate_host_name};
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::process::Command;
use uuid::Uuid;
use walkdir::WalkDir;

// ─── Response types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CommandResult {
    pub success: bool,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
}

// ─── Config CRUD ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_configs() -> Result<Vec<FlakeConfig>, String> {
    load_configs()
        .map(|c| c.configs)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_config(path: String, display_name: String) -> Result<FlakeConfig, String> {
    validate_flake_path(&path).map_err(|e| e.to_string())?;

    let mut cfg = load_configs().map_err(|e| e.to_string())?;

    // Check for duplicate path
    if cfg.configs.iter().any(|c| c.path == path) {
        return Err(format!("Config already exists: {}", path));
    }

    let new = FlakeConfig {
        id: Uuid::new_v4().to_string(),
        path,
        display_name,
        last_used_host: None,
        preview_ok: false,
        preview_ok_host: None,
    };

    cfg.configs.push(new.clone());
    save_configs(&cfg).map_err(|e| e.to_string())?;
    Ok(new)
}

#[tauri::command]
pub fn remove_config(id: String) -> Result<(), String> {
    let mut cfg = load_configs().map_err(|e| e.to_string())?;
    cfg.configs.retain(|c| c.id != id);
    save_configs(&cfg).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_config(updated: FlakeConfig) -> Result<(), String> {
    validate_flake_path(&updated.path).map_err(|e| e.to_string())?;
    let mut cfg = load_configs().map_err(|e| e.to_string())?;
    if let Some(c) = cfg.configs.iter_mut().find(|c| c.id == updated.id) {
        *c = updated;
    } else {
        return Err(format!("Config not found: {}", updated.id));
    }
    save_configs(&cfg).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Scanning ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn scan_flake_roots() -> Result<Vec<String>, String> {
    scan_for_flake_roots().map_err(|e| e.to_string())
}

// ─── Host discovery ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_flake_hosts(path: String) -> Result<Vec<String>, String> {
    validate_flake_path(&path).map_err(|e| e.to_string())?;

    let output = Command::new("nix")
        .args([
            "eval",
            ".#nixosConfigurations",
            "--json",
            "--apply",
            "builtins.attrNames",
        ])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run nix eval: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("nix eval failed:\n{}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let hosts: Vec<String> =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse hosts: {}", e))?;

    Ok(hosts)
}

// ─── Preview (non-root nix build) ────────────────────────────────────────────

#[tauri::command]
pub fn preview_config(path: String, host: String) -> Result<CommandResult, String> {
    let flake_ref = build_flake_ref(&path, &host).map_err(|e| e.to_string())?;

    let attr = format!(
        "{}.config.system.build.toplevel",
        format!(".#nixosConfigurations.{}", host)
    );

    let output = Command::new("nix")
        .args(["build", &attr, "-L", "--no-link"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run nix build: {}", e))?;

    let result = CommandResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    };

    // If preview succeeded, persist preview_ok for this config+host
    if result.success {
        let mut cfg = load_configs().map_err(|e| e.to_string())?;
        if let Some(c) = cfg.configs.iter_mut().find(|c| c.path == path) {
            c.preview_ok = true;
            c.preview_ok_host = Some(host.clone());
            c.last_used_host = Some(host);
            save_configs(&cfg).map_err(|e| e.to_string())?;
        }
    }

    // Suppress unused warning - flake_ref used for validation side effect
    let _ = flake_ref;

    Ok(result)
}

// ─── Graphical askpass helper discovery ──────────────────────────────────────

fn find_askpass() -> Option<String> {
    // Try well-known askpass binaries in order of preference
    let candidates = [
        "/run/current-system/sw/bin/ksshaskpass",
        "/run/current-system/sw/bin/x11-ssh-askpass",
        "/run/current-system/sw/bin/ssh-askpass",
        "/run/current-system/sw/bin/lxqt-openssh-askpass",
    ];
    for path in &candidates {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }

    // Try PATH-based lookup for the same names
    for name in &["ksshaskpass", "x11-ssh-askpass", "ssh-askpass", "lxqt-openssh-askpass"] {
        if let Ok(out) = Command::new("which").arg(name).output() {
            if out.status.success() {
                let p = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !p.is_empty() {
                    return Some(p);
                }
            }
        }
    }

    // Fallback: if zenity is available, write a tiny wrapper script
    if let Ok(out) = Command::new("which").arg("zenity").output() {
        if out.status.success() {
            let zenity = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !zenity.is_empty() {
                let script = format!(
                    "#!/bin/sh\n{} --password --title='Nixie — sudo authentication'\n",
                    zenity
                );
                let script_path = "/tmp/nixie-askpass.sh";
                if std::fs::write(script_path, script).is_ok() {
                    let _ = Command::new("chmod").args(["+x", script_path]).status();
                    return Some(script_path.to_string());
                }
            }
        }
    }

    None
}

// ─── Apply (sudo -A nixos-rebuild switch) ────────────────────────────────────

#[tauri::command]
pub fn apply_config(path: String, host: String) -> Result<CommandResult, String> {
    // Validate both
    validate_flake_path(&path).map_err(|e| e.to_string())?;
    validate_host_name(&host).map_err(|e| e.to_string())?;

    // Require preview_ok for this exact config+host
    let cfg = load_configs().map_err(|e| e.to_string())?;
    let config_entry = cfg
        .configs
        .iter()
        .find(|c| c.path == path)
        .ok_or_else(|| "Config not found".to_string())?;

    if !config_entry.preview_ok
        || config_entry.preview_ok_host.as_deref() != Some(host.as_str())
    {
        return Err(
            "Preview must succeed for this config+host before applying. Run Preview first."
                .to_string(),
        );
    }

    let askpass = find_askpass().ok_or_else(|| {
        "No graphical askpass helper found. Install ksshaskpass, x11-ssh-askpass, or zenity."
            .to_string()
    })?;

    let flake_ref = format!("{}#{}", path, host);

    let mut cmd = Command::new("sudo");
    cmd.args(["-A", "nixos-rebuild", "switch", "--flake", &flake_ref]);
    cmd.env("SUDO_ASKPASS", &askpass);
    // Pass display environment so the askpass GUI can open
    if let Ok(v) = std::env::var("DISPLAY") { cmd.env("DISPLAY", v); }
    if let Ok(v) = std::env::var("WAYLAND_DISPLAY") { cmd.env("WAYLAND_DISPLAY", v); }
    if let Ok(v) = std::env::var("XDG_RUNTIME_DIR") { cmd.env("XDG_RUNTIME_DIR", v); }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run sudo nixos-rebuild: {}", e))?;

    let success = output.status.success();
    let result = CommandResult {
        success,
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    };

    // Clear preview_ok after apply (force re-preview on next change)
    if success {
        let mut cfg2 = load_configs().map_err(|e| e.to_string())?;
        if let Some(c) = cfg2.configs.iter_mut().find(|c| c.path == path) {
            c.preview_ok = false;
            c.preview_ok_host = None;
        }
        save_configs(&cfg2).map_err(|e| e.to_string())?;
    }

    Ok(result)
}

// ─── Flake update ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn update_flake(path: String) -> Result<CommandResult, String> {
    validate_flake_path(&path).map_err(|e| e.to_string())?;

    let output = Command::new("nix")
        .args(["flake", "update"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Failed to run nix flake update: {}", e))?;

    Ok(CommandResult {
        success: output.status.success(),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code(),
    })
}

// ─── Git backup ──────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct BackupArgs {
    pub path: String,
    pub message: String,
    pub push: bool,
}

#[tauri::command]
pub fn backup_config(args: BackupArgs) -> Result<CommandResult, String> {
    validate_flake_path(&args.path).map_err(|e| e.to_string())?;

    // Sanitize commit message: no shell injection possible since we use args, not shell
    // but we still want a reasonable message
    if args.message.is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    // git add -A
    let add_output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(&args.path)
        .output()
        .map_err(|e| format!("git add failed: {}", e))?;

    if !add_output.status.success() {
        return Ok(CommandResult {
            success: false,
            stdout: String::from_utf8_lossy(&add_output.stdout).to_string(),
            stderr: String::from_utf8_lossy(&add_output.stderr).to_string(),
            exit_code: add_output.status.code(),
        });
    }

    // git commit -m "<msg>" - treat "nothing to commit" as non-fatal
    let commit_output = Command::new("git")
        .args(["commit", "-m", &args.message])
        .current_dir(&args.path)
        .output()
        .map_err(|e| format!("git commit failed: {}", e))?;

    let commit_stderr = String::from_utf8_lossy(&commit_output.stderr).to_string();
    let commit_stdout = String::from_utf8_lossy(&commit_output.stdout).to_string();

    // "nothing to commit" is exit code 1 but not an error
    let nothing_to_commit = commit_stdout.contains("nothing to commit")
        || commit_stderr.contains("nothing to commit");

    if !commit_output.status.success() && !nothing_to_commit {
        return Ok(CommandResult {
            success: false,
            stdout: commit_stdout,
            stderr: commit_stderr,
            exit_code: commit_output.status.code(),
        });
    }

    // Optionally push
    if args.push {
        let push_output = Command::new("git")
            .args(["push"])
            .current_dir(&args.path)
            .output()
            .map_err(|e| format!("git push failed: {}", e))?;

        return Ok(CommandResult {
            success: push_output.status.success(),
            stdout: format!(
                "{}\n{}",
                commit_stdout,
                String::from_utf8_lossy(&push_output.stdout)
            ),
            stderr: format!(
                "{}\n{}",
                commit_stderr,
                String::from_utf8_lossy(&push_output.stderr)
            ),
            exit_code: push_output.status.code(),
        });
    }

    Ok(CommandResult {
        success: true,
        stdout: commit_stdout,
        stderr: commit_stderr,
        exit_code: Some(0),
    })
}

// ─── Path validation (for frontend use) ──────────────────────────────────────

#[tauri::command]
pub fn validate_path(path: String) -> Result<bool, String> {
    Ok(validate_flake_path(&path).is_ok())
}

// ─── List all .nix files in flake directory ───────────────────────────────────

const IGNORE_DIRS: &[&str] = &[".git", "node_modules", "result", "target", ".direnv"];

#[tauri::command]
pub fn list_nix_files(path: String) -> Result<Vec<String>, String> {
    validate_flake_path(&path).map_err(|e| e.to_string())?;
    let root = std::path::Path::new(&path);

    let mut files: Vec<String> = WalkDir::new(root)
        .max_depth(10)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy();
                !IGNORE_DIRS.iter().any(|&ig| name == ig)
            } else {
                true
            }
        })
        .flatten()
        .filter(|e| {
            e.file_type().is_file()
                && e.path().extension().and_then(|x| x.to_str()) == Some("nix")
        })
        .filter_map(|e| {
            e.path()
                .strip_prefix(root)
                .ok()
                .map(|r| r.to_string_lossy().to_string())
        })
        .collect();

    files.sort();
    Ok(files)
}

// ─── Read any .nix file within the flake directory ────────────────────────────

#[tauri::command]
pub fn read_nix_file(root: String, rel_path: String) -> Result<String, String> {
    validate_flake_path(&root).map_err(|e| e.to_string())?;

    let base = std::path::Path::new(&root);
    let full = base.join(&rel_path);

    // Prevent path traversal: canonicalize and verify it stays inside root
    let canon_root = base
        .canonicalize()
        .map_err(|e| format!("Cannot resolve root: {}", e))?;
    let canon_full = full
        .canonicalize()
        .map_err(|e| format!("Cannot resolve path: {}", e))?;

    if !canon_full.starts_with(&canon_root) {
        return Err("Path is outside flake directory".to_string());
    }
    if canon_full.extension().and_then(|e| e.to_str()) != Some("nix") {
        return Err("Only .nix files can be read".to_string());
    }

    std::fs::read_to_string(&canon_full)
        .map_err(|e| format!("Failed to read file: {}", e))
}
