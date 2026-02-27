// src/api.ts
import { invoke } from "@tauri-apps/api/core";
import type { FlakeConfig, CommandResult, BackupArgs } from "./types";

export const api = {
  getConfigs: () => invoke<FlakeConfig[]>("get_configs"),

  addConfig: (path: string, display_name: string) =>
    invoke<FlakeConfig>("add_config", { path, displayName: display_name }),

  removeConfig: (id: string) => invoke<void>("remove_config", { id }),

  updateConfig: (updated: FlakeConfig) => invoke<void>("update_config", { updated }),

  scanFlakeRoots: () => invoke<string[]>("scan_flake_roots"),

  getFlakeHosts: (path: string) => invoke<string[]>("get_flake_hosts", { path }),

  previewConfig: (path: string, host: string) =>
    invoke<CommandResult>("preview_config", { path, host }),

  applyConfig: (path: string, host: string, password: string) =>
    invoke<CommandResult>("apply_config", { path, host, password }),

  updateFlake: (path: string) => invoke<CommandResult>("update_flake", { path }),

  backupConfig: (args: BackupArgs) => invoke<CommandResult>("backup_config", { args }),

  validatePath: (path: string) => invoke<boolean>("validate_path", { path }),

  listNixFiles: (path: string) => invoke<string[]>("list_nix_files", { path }),

  readNixFile: (root: string, relPath: string) =>
    invoke<string>("read_nix_file", { root, relPath }),
};
