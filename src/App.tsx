// src/App.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import type { FlakeConfig, LogEntry, WorkflowState } from "./types";
import { api } from "./api";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { LogPane } from "./components/LogPane";
import { EmptyState } from "./components/EmptyState";
import { AddConfigModal } from "./components/AddConfigModal";
import { BackupModal } from "./components/BackupModal";

let logIdCounter = 0;

function makeLog(
  level: LogEntry["level"],
  message: string
): LogEntry {
  return {
    id: String(++logIdCounter),
    timestamp: new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    level,
    message,
  };
}

export default function App() {
  const [configs, setConfigs] = useState<FlakeConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hosts, setHosts] = useState<string[]>([]);
  const [selectedHost, setSelectedHost] = useState<string>("");
  const [workflowState, setWorkflowState] = useState<WorkflowState>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [isLoadingHosts, setIsLoadingHosts] = useState(false);

  const selectedConfig = configs.find((c) => c.id === selectedId) ?? null;

  const appendLog = useCallback((level: LogEntry["level"], message: string) => {
    setLogs((prev) => [...prev, makeLog(level, message)]);
  }, []);

  // Load configs on mount
  useEffect(() => {
    api
      .getConfigs()
      .then((cfgs) => {
        setConfigs(cfgs);
        if (cfgs.length > 0) {
          setSelectedId(cfgs[0].id);
        }
      })
      .catch((e) => appendLog("error", `Failed to load configs: ${e}`));
  }, [appendLog]);

  // Load hosts when selected config changes
  useEffect(() => {
    if (!selectedConfig) {
      setHosts([]);
      setSelectedHost("");
      return;
    }

    setIsLoadingHosts(true);
    setHosts([]);

    api
      .getFlakeHosts(selectedConfig.path)
      .then((h) => {
        setHosts(h);
        const preferred =
          selectedConfig.last_used_host ??
          (h.length === 1 ? h[0] : "");
        setSelectedHost(preferred && h.includes(preferred) ? preferred : h[0] ?? "");
        appendLog("info", `Found ${h.length} host(s): ${h.join(", ")}`);
      })
      .catch((e) => {
        appendLog("error", `Failed to get hosts: ${e}`);
      })
      .finally(() => setIsLoadingHosts(false));
  }, [selectedConfig?.id, selectedConfig?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear preview_ok when host changes
  const prevHostRef = useRef(selectedHost);
  useEffect(() => {
    if (prevHostRef.current !== selectedHost && selectedConfig) {
      if (selectedConfig.preview_ok) {
        setConfigs((prev) =>
          prev.map((c) =>
            c.id === selectedConfig.id
              ? { ...c, preview_ok: false, preview_ok_host: null }
              : c
          )
        );
      }
    }
    prevHostRef.current = selectedHost;
  }, [selectedHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshConfigs = useCallback(async () => {
    const cfgs = await api.getConfigs();
    setConfigs(cfgs);
    return cfgs;
  }, []);

  const handleSelectConfig = (id: string) => {
    setSelectedId(id);
    setLogs([]);
  };

  const handleRemoveConfig = async (id: string) => {
    await api.removeConfig(id);
    const cfgs = await refreshConfigs();
    if (selectedId === id) {
      setSelectedId(cfgs.length > 0 ? cfgs[0].id : null);
    }
  };

  const handleAddConfig = async (path: string, name: string) => {
    try {
      const newCfg = await api.addConfig(path, name);
      await refreshConfigs();
      setSelectedId(newCfg.id);
      setShowAddModal(false);
      appendLog("success", `Added config: ${name}`);
    } catch (e) {
      throw e; // Let modal handle
    }
  };

  const handlePreview = async () => {
    if (!selectedConfig || !selectedHost) return;
    setWorkflowState("previewing");
    setLogs([]);
    appendLog("info", `Previewing ${selectedConfig.display_name}#${selectedHost}…`);

    try {
      const result = await api.previewConfig(selectedConfig.path, selectedHost);
      if (result.success) {
        appendLog("success", "Preview succeeded ✓");
        if (result.stdout) appendLog("info", result.stdout);
        await refreshConfigs();
      } else {
        appendLog("error", "Preview FAILED");
        if (result.stderr) appendLog("error", result.stderr);
        if (result.stdout) appendLog("info", result.stdout);
      }
    } catch (e) {
      appendLog("error", `Preview error: ${e}`);
    } finally {
      setWorkflowState("idle");
    }
  };

  const handleApply = async () => {
    if (!selectedConfig || !selectedHost) return;
    setWorkflowState("applying");
    appendLog("info", `Applying ${selectedConfig.display_name}#${selectedHost}…`);

    try {
      const result = await api.applyConfig(selectedConfig.path, selectedHost);
      if (result.success) {
        appendLog("success", "Apply succeeded ✓ — system switched");
        if (result.stdout) appendLog("info", result.stdout);
        await refreshConfigs();
      } else {
        appendLog("error", "Apply FAILED");
        if (result.stderr) appendLog("error", result.stderr);
        if (result.stdout) appendLog("info", result.stdout);
      }
    } catch (e) {
      appendLog("error", `Apply error: ${e}`);
    } finally {
      setWorkflowState("idle");
    }
  };

  const handleUpdateFlake = async () => {
    if (!selectedConfig) return;
    setWorkflowState("updating_flake");
    appendLog("info", `Updating flake inputs for ${selectedConfig.display_name}…`);

    try {
      const result = await api.updateFlake(selectedConfig.path);
      if (result.success) {
        appendLog("success", "Flake inputs updated ✓");
        if (result.stdout) appendLog("info", result.stdout);
      } else {
        appendLog("error", "Flake update FAILED");
        if (result.stderr) appendLog("error", result.stderr);
      }
      // After update, clear preview_ok
      setConfigs((prev) =>
        prev.map((c) =>
          c.id === selectedConfig.id
            ? { ...c, preview_ok: false, preview_ok_host: null }
            : c
        )
      );
    } catch (e) {
      appendLog("error", `Flake update error: ${e}`);
    } finally {
      setWorkflowState("idle");
    }
  };

  const handleBackup = async (message: string, push: boolean) => {
    if (!selectedConfig) return;
    setWorkflowState("backing_up");
    setShowBackupModal(false);
    appendLog("info", `Backing up ${selectedConfig.display_name}…`);

    try {
      const result = await api.backupConfig({
        path: selectedConfig.path,
        message,
        push,
      });
      if (result.success) {
        appendLog("success", push ? "Committed & pushed ✓" : "Committed ✓");
        if (result.stdout) appendLog("info", result.stdout);
      } else {
        appendLog("error", "Backup FAILED");
        if (result.stderr) appendLog("error", result.stderr);
      }
    } catch (e) {
      appendLog("error", `Backup error: ${e}`);
    } finally {
      setWorkflowState("idle");
    }
  };

  const isBusy = workflowState !== "idle";
  const canPreview = !!selectedConfig && !!selectedHost && !isBusy;
  const canApply =
    !!selectedConfig &&
    !!selectedHost &&
    !isBusy &&
    selectedConfig.preview_ok &&
    selectedConfig.preview_ok_host === selectedHost;

  return (
    <div className="app-shell">
      <Sidebar
        configs={configs}
        selectedId={selectedId}
        onSelect={handleSelectConfig}
        onRemove={handleRemoveConfig}
        onAddConfig={() => setShowAddModal(true)}
        isBusy={isBusy}
      />

      <TopBar
        config={selectedConfig}
        hosts={hosts}
        selectedHost={selectedHost}
        onHostChange={setSelectedHost}
        isLoadingHosts={isLoadingHosts}
        onPreview={handlePreview}
        onApply={handleApply}
        onUpdateFlake={handleUpdateFlake}
        onBackup={() => setShowBackupModal(true)}
        canPreview={canPreview}
        canApply={canApply}
        isBusy={isBusy}
        workflowState={workflowState}
        previewOk={selectedConfig?.preview_ok ?? false}
        previewOkHost={selectedConfig?.preview_ok_host ?? null}
      />

      <div className="main-content">
        {selectedConfig ? (
          <>
            <div className="config-detail-bar">
              <div className="config-detail-row">
                <span className="detail-label">Path</span>
                <span className="detail-value">{selectedConfig.path}</span>
              </div>
              <div className="config-detail-row">
                <span className="detail-label">Hosts</span>
                {isLoadingHosts ? (
                  <div className="spinner" style={{ color: "var(--accent)" }} />
                ) : hosts.length > 0 ? (
                  <div className="host-tags">
                    {hosts.map((h) => (
                      <span
                        key={h}
                        className={`host-tag ${h === selectedHost ? "active" : ""}`}
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="detail-muted">No hosts found</span>
                )}
              </div>
            </div>
            <LogPane logs={logs} isBusy={isBusy} workflowState={workflowState} />
          </>
        ) : (
          <EmptyState onAdd={() => setShowAddModal(true)} />
        )}
      </div>

      {showAddModal && (
        <AddConfigModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddConfig}
        />
      )}

      {showBackupModal && selectedConfig && (
        <BackupModal
          configName={selectedConfig.display_name}
          onClose={() => setShowBackupModal(false)}
          onBackup={handleBackup}
        />
      )}
    </div>
  );
}
