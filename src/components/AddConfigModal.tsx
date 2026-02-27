// src/components/AddConfigModal.tsx
import { useState } from "react";
import { api } from "../api";

interface Props {
  onClose: () => void;
  onAdd: (path: string, name: string) => Promise<void>;
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function AddConfigModal({ onClose, onAdd }: Props) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<string[] | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setScanResults(null);
    try {
      const results = await api.scanFlakeRoots();
      setScanResults(results);
    } catch (e) {
      setError(`Scan failed: ${e}`);
    } finally {
      setIsScanning(false);
    }
  };

  const selectScanResult = (p: string) => {
    setPath(p);
    // Auto-derive name from last path component
    if (!name) {
      setName(p.split("/").filter(Boolean).pop() ?? "");
    }
    setScanResults(null);
  };

  const handleSubmit = async () => {
    setError("");
    if (!path.trim()) {
      setError("Path is required");
      return;
    }

    // Validate
    const valid = await api.validatePath(path.trim()).catch(() => false);
    if (!valid) {
      setError("Path does not exist or does not contain flake.nix");
      return;
    }

    const displayName = name.trim() || path.split("/").filter(Boolean).pop() || path;

    setIsLoading(true);
    try {
      await onAdd(path.trim(), displayName);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Add Flake Configuration</div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Flake Root Path</label>
            <input
              className={`form-input ${error ? "error" : ""}`}
              type="text"
              placeholder="/home/user/nixos"
              value={path}
              onChange={(e) => { setPath(e.target.value); setError(""); }}
            />
            {error && <div className="form-error">{error}</div>}
            <div className="form-hint">Directory containing flake.nix</div>
          </div>

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="My NixOS Config"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Scan section */}
          <div>
            <button
              className="btn btn-secondary"
              onClick={handleScan}
              disabled={isScanning}
              style={{ width: "100%" }}
            >
              {isScanning ? (
                <><div className="spinner" />Scanning…</>
              ) : (
                <><SearchIcon />Auto-detect flake roots</>
              )}
            </button>

            {scanResults !== null && (
              <div style={{ marginTop: 8 }}>
                {scanResults.length === 0 ? (
                  <div className="scan-loading">No flake roots found in common directories</div>
                ) : (
                  <div className="scan-results">
                    {scanResults.map((p) => (
                      <div key={p} className="scan-item" onClick={() => selectScanResult(p)}>
                        <FolderIcon />
                        <span className="scan-item-path" style={{ marginLeft: 6 }}>{p}</span>
                        <span style={{ fontSize: 10, color: "var(--ctp-blue)", marginLeft: 8, flexShrink: 0 }}>Select</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !path.trim()}
          >
            {isLoading ? <><div className="spinner" />Adding…</> : "Add Config"}
          </button>
        </div>
      </div>
    </div>
  );
}
