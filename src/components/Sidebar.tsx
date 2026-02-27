// src/components/Sidebar.tsx
import type { FlakeConfig } from "../types";

interface Props {
  configs: FlakeConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddConfig: () => void;
  isBusy: boolean;
}

// NixOS snowflake-ish icon
function NixIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L8 8H4l4 4-4 4h4l4 6 4-6h4l-4-4 4-4h-4L12 2z" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 4v6h6M23 20v-6h-6" />
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
    </svg>
  );
}

export function Sidebar({ configs, selectedId, onSelect, onRemove, onAddConfig, isBusy }: Props) {
  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isBusy) onRemove(id);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="app-logo">
          <NixIcon />
          <span className="app-title">NixOS Manager</span>
        </div>
        <div className="app-subtitle">flake config manager</div>
      </div>

      <div className="sidebar-section-label">Configurations</div>

      <div className="sidebar-configs">
        {configs.map((cfg) => (
          <div
            key={cfg.id}
            className={`config-item ${selectedId === cfg.id ? "active" : ""}`}
            onClick={() => onSelect(cfg.id)}
          >
            <div className="config-dot" />
            <div className="config-item-body">
              <div className="config-name">{cfg.display_name}</div>
              <div className="config-path">{cfg.path}</div>
            </div>
            <div className="config-item-actions">
              <button
                className="icon-btn danger"
                onClick={(e) => handleRemove(e, cfg.id)}
                data-tooltip="Remove"
                disabled={isBusy}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}

        {configs.length === 0 && (
          <div style={{ padding: "16px 8px", fontSize: 12, color: "var(--text-muted)", textAlign: "center", fontFamily: "var(--font-mono)" }}>
            No configs yet
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-action-btn" onClick={onAddConfig} disabled={isBusy}>
          <PlusIcon />
          Add config…
        </button>
        <button className="sidebar-action-btn" onClick={onAddConfig} disabled={isBusy}>
          <RefreshIcon />
          Rescan
        </button>
      </div>
    </aside>
  );
}
