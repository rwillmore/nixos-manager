// src-tauri/src/scanner.rs
use anyhow::Result;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const IGNORE_DIRS: &[&str] = &[".git", "node_modules", "result", "target", ".direnv"];
const MAX_DEPTH: usize = 4;

/// Search common directories for flake roots (directories containing flake.nix).
pub fn scan_for_flake_roots() -> Result<Vec<String>> {
    let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("No home directory"))?;

    let search_roots: Vec<PathBuf> = vec![
        home.join("nix"),
        home.join(".config"),
        home.join("src"),
        home.join("nixos"),
        home.join("dotfiles"),
        home.join("NixGaming"),
    ]
    .into_iter()
    .filter(|p| p.exists())
    .collect();

    let mut found: Vec<String> = Vec::new();
    let mut seen: HashSet<PathBuf> = HashSet::new();

    for root in search_roots {
        scan_dir(&root, &mut found, &mut seen);
    }

    found.sort();
    Ok(found)
}

fn scan_dir(root: &Path, found: &mut Vec<String>, seen: &mut HashSet<PathBuf>) {
    let walker = WalkDir::new(root)
        .max_depth(MAX_DEPTH)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            // Skip ignored directory names
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy();
                !IGNORE_DIRS.contains(&name.as_ref())
            } else {
                true
            }
        });

    for entry in walker.flatten() {
        if entry.file_type().is_file() {
            if entry.file_name() == "flake.nix" {
                if let Some(parent) = entry.path().parent() {
                    if let Ok(canonical) = parent.canonicalize() {
                        if seen.insert(canonical.clone()) {
                            found.push(canonical.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
}
