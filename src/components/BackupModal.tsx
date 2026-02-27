// src/components/BackupModal.tsx
import { useState } from "react";

interface Props {
  configName: string;
  onClose: () => void;
  onBackup: (message: string, push: boolean) => void;
}

export function BackupModal({ configName, onClose, onBackup }: Props) {
  const defaultMsg = `nixos-manager: update config - ${new Date().toISOString().slice(0, 10)}`;
  const [message, setMessage] = useState(defaultMsg);
  const [push, setPush] = useState(true);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onBackup(message.trim(), push);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Backup: {configName}</div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Commit Message</label>
            <input
              className="form-input"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <label className="form-checkbox-row">
            <input
              type="checkbox"
              checked={push}
              onChange={(e) => setPush(e.target.checked)}
            />
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Push to remote after commit
            </span>
          </label>

          <div className="form-hint">
            Runs: <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              git add -A && git commit -m "…"{push ? " && git push" : ""}
            </code>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!message.trim()}
          >
            Commit{push ? " & Push" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
