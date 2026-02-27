// src/components/SudoPasswordModal.tsx
import { useState, useRef, useEffect } from "react";

interface Props {
  configName: string;
  host: string;
  onClose: () => void;
  onApply: (password: string) => void;
}

export function SudoPasswordModal({ configName, host, onClose, onApply }: Props) {
  const [password, setPassword] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!password) return;
    onApply(password);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Apply: {configName}#{host}</div>

        <div className="modal-body">
          <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            This will run{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
              sudo nixos-rebuild switch
            </code>
            . Enter your sudo password to continue.
          </p>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              ref={inputRef}
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="sudo password"
              autoComplete="current-password"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-success"
            onClick={handleSubmit}
            disabled={!password}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
