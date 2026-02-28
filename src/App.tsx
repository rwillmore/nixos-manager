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
import { SudoPasswordModal } from "./components/SudoPasswordModal";

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
  const [showSudoModal, setShowSudoModal] = useState(false);
  const [isLoadingHosts, setIsLoadingHosts] = useState(false);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"file" | "log">("file");
  const [nixFiles, setNixFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    fileContent !== null &&
    editedContent !== null &&
    editedContent !== fileContent;

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

  // Load nix file list and auto-select flake.nix when selected config changes
  useEffect(() => {
    if (!selectedConfig) {
      setNixFiles([]);
      setSelectedFile(null);
      setFileContent(null);
      return;
    }
    setNixFiles([]);
    setSelectedFile(null);
    setFileContent(null);
    setEditedContent(null);
    setActiveTab("file");

    let cancelled = false;

    (async () => {
      try {
        const files = await api.listNixFiles(selectedConfig.path);
        if (cancelled) return;
        setNixFiles(files);
        const toSelect = files.find((f) => f === "flake.nix") ?? files[0] ?? null;
        if (!toSelect) return;
        setSelectedFile(toSelect);
        const content = await api.readNixFile(selectedConfig.path, toSelect);
        if (!cancelled) {
          setFileContent(content);
          setEditedContent(content);
        }
      } catch {
        if (!cancelled) {
          setFileContent(null);
          setEditedContent(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [selectedConfig?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSelectFile = async (rel: string) => {
    if (!selectedConfig) return;
    setSelectedFile(rel);
    setActiveTab("file");
    setFileContent(null);
    setEditedContent(null);
    try {
      const content = await api.readNixFile(selectedConfig.path, rel);
      setFileContent(content);
      setEditedContent(content);
    } catch (e) {
      setFileContent(null);
      setEditedContent(null);
      appendLog("error", `Failed to read file: ${e}`);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedConfig || !selectedFile || editedContent === null) return;
    setIsSaving(true);
    try {
      await api.writeNixFile(selectedConfig.path, selectedFile, editedContent);
      setFileContent(editedContent);
    } catch (e) {
      appendLog("error", `Failed to save file: ${e}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRescan = async () => {
    if (!selectedConfig) return;
    try {
      const files = await api.listNixFiles(selectedConfig.path);
      setNixFiles(files);
    } catch (e) {
      appendLog("error", `Rescan failed: ${e}`);
    }
  };

  const handlePreview = async () => {
    if (!selectedConfig || !selectedHost) return;
    setWorkflowState("previewing");
    setActiveTab("log");
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

  const handleApply = () => {
    if (!selectedConfig || !selectedHost) return;
    setShowSudoModal(true);
  };

  const handleApplyWithPassword = async (password: string) => {
    if (!selectedConfig || !selectedHost) return;
    setShowSudoModal(false);
    setWorkflowState("applying");
    setActiveTab("log");
    appendLog("info", `Applying ${selectedConfig.display_name}#${selectedHost}…`);

    try {
      const result = await api.applyConfig(selectedConfig.path, selectedHost, password);
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
    setActiveTab("log");
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
    setActiveTab("log");
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

  const fileTabLabel = selectedFile
    ? selectedFile.split("/").pop() ?? "File"
    : "File";

  return (
    <div className="app-shell">
      <Sidebar
        configs={configs}
        selectedId={selectedId}
        onSelect={handleSelectConfig}
        onRemove={handleRemoveConfig}
        onAddConfig={() => setShowAddModal(true)}
        onRescan={handleRescan}
        isBusy={isBusy}
        nixFiles={nixFiles}
        selectedFile={selectedFile}
        onSelectFile={handleSelectFile}
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
              <div className="main-tabs">
                <button
                  className={`main-tab ${activeTab === "file" ? "active" : ""}`}
                  onClick={() => setActiveTab("file")}
                >
                  {fileTabLabel}
                  {isDirty && <span className="dirty-dot" title="Unsaved changes" />}
                </button>
                <button
                  className={`main-tab ${activeTab === "log" ? "active" : ""}`}
                  onClick={() => setActiveTab("log")}
                >
                  Log
                  {logs.length > 0 && (
                    <span className="tab-badge">{logs.length}</span>
                  )}
                </button>
              </div>
            </div>

            {activeTab === "file" ? (
              <div className="file-viewer">
                {editedContent !== null ? (
                  <>
                    <div className="file-editor-bar">
                      <span className="file-editor-name">{selectedFile}</span>
                      {isDirty && (
                        <button
                          className="btn btn-primary file-save-btn"
                          onClick={handleSaveFile}
                          disabled={isSaving}
                        >
                          {isSaving ? "Saving…" : "Save"}
                        </button>
                      )}
                    </div>
                    <textarea
                      className="file-editor"
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      spellCheck={false}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </>
                ) : (
                  <div className="log-empty">
                    <span className="log-empty-text">
                      {selectedFile
                        ? `Loading ${selectedFile}…`
                        : "Select a file from the sidebar"}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <LogPane logs={logs} isBusy={isBusy} workflowState={workflowState} />
            )}
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

      {showSudoModal && selectedConfig && (
        <SudoPasswordModal
          configName={selectedConfig.display_name}
          host={selectedHost}
          onClose={() => setShowSudoModal(false)}
          onApply={handleApplyWithPassword}
        />
      )}
    </div>
  );
}
