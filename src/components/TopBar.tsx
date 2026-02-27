// src/components/TopBar.tsx
import { useState, useRef, useEffect } from "react";
import type { FlakeConfig, WorkflowState } from "../types";

interface Props {
  config: FlakeConfig | null;
  hosts: string[];
  selectedHost: string;
  onHostChange: (host: string) => void;
  isLoadingHosts: boolean;
  onPreview: () => void;
  onApply: () => void;
  onUpdateFlake: () => void;
  onBackup: () => void;
  canPreview: boolean;
  canApply: boolean;
  isBusy: boolean;
  workflowState: WorkflowState;
  previewOk: boolean;
  previewOkHost: string | null;
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RefreshCwIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function GitIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M13 6h3a2 2 0 0 1 2 2v7" />
      <path d="M6 9v12" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

export function TopBar({
  config,
  hosts,
  selectedHost,
  onHostChange,
  isLoadingHosts,
  onPreview,
  onApply,
  onUpdateFlake,
  onBackup,
  canPreview,
  canApply,
  isBusy,
  workflowState,
  previewOk,
  previewOkHost,
}: Props) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const statusLabel = () => {
    switch (workflowState) {
      case "previewing": return "Previewing…";
      case "applying": return "Applying…";
      case "updating_flake": return "Updating flake…";
      case "backing_up": return "Backing up…";
      default:
        if (previewOk && previewOkHost === selectedHost) return "Preview OK";
        return "Idle";
    }
  };

  const statusClass = () => {
    switch (workflowState) {
      case "previewing":
      case "applying":
      case "updating_flake":
      case "backing_up":
        return "running";
      case "idle":
        if (previewOk && previewOkHost === selectedHost) return "preview-ok";
        return "idle";
      default:
        return "idle";
    }
  };

  return (
    <div className="topbar">
      <div className="topbar-config-info">
        {config ? (
          <span className="topbar-config-name">{config.display_name}</span>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>No config selected</span>
        )}
      </div>

      {config && (
        <>
          {/* Host selector */}
          <div className="topbar-host-selector">
            <span className="host-label">Host</span>
            {isLoadingHosts ? (
              <div className="spinner" style={{ color: "var(--accent)" }} />
            ) : (
              <select
                className="host-select"
                value={selectedHost}
                onChange={(e) => onHostChange(e.target.value)}
                disabled={isBusy || hosts.length === 0}
              >
                {hosts.length === 0 && <option value="">No hosts found</option>}
                {hosts.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            )}
          </div>

          {/* Status badge */}
          <div className={`status-badge ${statusClass()}`}>
            {workflowState !== "idle" && <div className="pulse-dot" />}
            {previewOk && previewOkHost === selectedHost && workflowState === "idle" && (
              <CheckCircleIcon />
            )}
            {statusLabel()}
          </div>

          {/* Workflow buttons */}
          <div className="topbar-actions">
            <button
              className="btn btn-secondary"
              onClick={onPreview}
              disabled={!canPreview}
              title="Run nix build (non-root preview)"
            >
              {workflowState === "previewing" ? (
                <><div className="spinner" />Preview</>
              ) : (
                <><EyeIcon />Preview</>
              )}
            </button>

            <button
              className="btn btn-success"
              onClick={onApply}
              disabled={!canApply}
              title={
                canApply
                  ? "Run nixos-rebuild switch via pkexec"
                  : "Run Preview first for this host"
              }
            >
              {workflowState === "applying" ? (
                <><div className="spinner" />Apply</>
              ) : (
                <><ZapIcon />Apply</>
              )}
            </button>

            {/* Actions dropdown */}
            <div className="dropdown-wrapper" ref={dropdownRef}>
              <button
                className="btn btn-ghost"
                onClick={() => setActionsOpen((o) => !o)}
                disabled={isBusy || !config}
                style={{ gap: 4 }}
              >
                Actions <ChevronIcon />
              </button>

              {actionsOpen && (
                <div className="dropdown-menu">
                  <button
                    className="dropdown-item"
                    onClick={() => { onUpdateFlake(); setActionsOpen(false); }}
                    disabled={isBusy}
                  >
                    <RefreshCwIcon />
                    Update flake inputs
                  </button>
                  <div className="dropdown-divider" />
                  <button
                    className="dropdown-item"
                    onClick={() => { onBackup(); setActionsOpen(false); }}
                    disabled={isBusy}
                  >
                    <GitIcon />
                    Backup (git commit…)
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
