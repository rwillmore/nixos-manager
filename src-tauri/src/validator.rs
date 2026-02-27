// src-tauri/src/validator.rs
use anyhow::{bail, Result};
use regex::Regex;
use std::path::Path;

/// Validate that a flake path is safe:
/// - Must be an absolute path
/// - Must exist on disk
/// - Must contain a flake.nix file
/// - Must not contain path traversal sequences
pub fn validate_flake_path(path: &str) -> Result<()> {
    let p = Path::new(path);

    if !p.is_absolute() {
        bail!("Flake path must be absolute: {}", path);
    }

    // Prevent traversal
    if path.contains("..") {
        bail!("Path must not contain '..': {}", path);
    }

    if !p.exists() {
        bail!("Path does not exist: {}", path);
    }

    let flake_nix = p.join("flake.nix");
    if !flake_nix.exists() {
        bail!("No flake.nix found at: {}", path);
    }

    Ok(())
}

/// Validate that a NixOS host name is safe.
/// Must match: alphanumeric, hyphens, underscores only.
pub fn validate_host_name(host: &str) -> Result<()> {
    if host.is_empty() {
        bail!("Host name cannot be empty");
    }

    let re = Regex::new(r"^[a-zA-Z0-9_\-]+$").unwrap();
    if !re.is_match(host) {
        bail!(
            "Invalid host name '{}'. Only alphanumeric, hyphens, and underscores allowed.",
            host
        );
    }

    Ok(())
}

/// Build a safe flake reference string: "<path>#<host>"
/// Only call after validating both path and host.
pub fn build_flake_ref(path: &str, host: &str) -> Result<String> {
    validate_flake_path(path)?;
    validate_host_name(host)?;
    Ok(format!("{}#{}", path, host))
}
