// src-tauri/src/config.rs
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlakeConfig {
    pub id: String,
    pub path: String,
    pub display_name: String,
    pub last_used_host: Option<String>,
    pub preview_ok: bool,
    pub preview_ok_host: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct AppConfig {
    pub configs: Vec<FlakeConfig>,
}

pub fn config_path() -> Result<PathBuf> {
    let base = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine config directory"))?;
    let dir = base.join("nixos-manager");
    fs::create_dir_all(&dir)?;
    Ok(dir.join("configs.json"))
}

pub fn load_configs() -> Result<AppConfig> {
    let path = config_path()?;
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let data = fs::read_to_string(&path)?;
    let cfg: AppConfig = serde_json::from_str(&data)?;
    Ok(cfg)
}

pub fn save_configs(cfg: &AppConfig) -> Result<()> {
    let path = config_path()?;
    let data = serde_json::to_string_pretty(cfg)?;
    fs::write(&path, data)?;
    Ok(())
}
