// src/components/EmptyState.tsx

interface Props {
  onAdd: () => void;
}

function SnowflakeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ opacity: 0.2 }}>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="m20 6-8 6-8-6" />
      <path d="m4 18 8-6 8 6" />
      <path d="m2 12 10-2 10 2" />
      <path d="m2 12 10 2 10-2" />
    </svg>
  );
}

export function EmptyState({ onAdd }: Props) {
  return (
    <div className="empty-state">
      <SnowflakeIcon />
      <h2>No config selected</h2>
      <p>
        Add a NixOS flake configuration to get started. Your flake root must
        contain a <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ctp-blue)" }}>flake.nix</code>.
      </p>
      <button className="btn btn-primary" onClick={onAdd} style={{ marginTop: 8 }}>
        Add config…
      </button>
    </div>
  );
}
