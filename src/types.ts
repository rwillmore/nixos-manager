// src/types.ts

export interface FlakeConfig {
  id: string;
  path: string;
  display_name: string;
  last_used_host: string | null;
  preview_ok: boolean;
  preview_ok_host: string | null;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number | null;
}

export interface BackupArgs {
  path: string;
  message: string;
  push: boolean;
}

export type WorkflowState =
  | "idle"
  | "scanning_hosts"
  | "previewing"
  | "applying"
  | "updating_flake"
  | "backing_up";

export type LogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "success" | "error" | "warn";
  message: string;
};
