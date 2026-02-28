// src/components/LogPane.tsx
import { useEffect, useRef } from "react";
import type { LogEntry } from "../types";

interface Props {
  logs: LogEntry[];
  isBusy: boolean;
}

function TerminalIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="log-empty-icon">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

export function LogPane({ logs, isBusy }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <>
      {isBusy && (
        <div className="progress-bar-track">
          <div className="progress-bar-fill" />
        </div>
      )}

      <div className="log-pane selectable">
        {logs.length === 0 ? (
          <div className="log-empty">
            <TerminalIcon />
            <span className="log-empty-text">
              {isBusy ? "Running…" : "Run Preview to see output"}
            </span>
          </div>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="log-entry">
              <span className="log-time">{entry.timestamp}</span>
              <span className={`log-level ${entry.level}`}>{entry.level}</span>
              <span className="log-message">{entry.message}</span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </>
  );
}
