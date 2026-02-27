// src/components/Sidebar.tsx
import { useState } from "react";
import type { FlakeConfig } from "../types";

interface Props {
  configs: FlakeConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddConfig: () => void;
  onRescan: () => void;
  isBusy: boolean;
  nixFiles: string[];
  selectedFile: string | null;
  onSelectFile: (rel: string) => void;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

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
      <path d="M10 11v6M14 11v6M9 6V4h6v2" />
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

function ChevronRightIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5"
      style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 150ms ease", flexShrink: 0 }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
      {open
        ? <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        : <><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></>
      }
    </svg>
  );
}

function FileNixIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

// ─── Tree builder ─────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  relPath: string;
  isFile: boolean;
  children: TreeNode[];
}

function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const relPath = parts.slice(0, i + 1).join("/");
      const isFile = i === parts.length - 1;

      let node = current.find((n) => n.name === name);
      if (!node) {
        node = { name, relPath, isFile, children: [] };
        current.push(node);
      }
      if (!isFile) current = node.children;
    }
  }

  return root;
}

// ─── FileTreeNode ─────────────────────────────────────────────────────────────

function FileTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  selectedFile,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (p: string) => void;
  selectedFile: string | null;
  onSelectFile: (p: string) => void;
}) {
  const indent = depth * 12;
  const isExpanded = expanded.has(node.relPath);
  const isSelected = selectedFile === node.relPath;

  if (node.isFile) {
    return (
      <div
        className={`tree-file ${isSelected ? "active" : ""}`}
        style={{ paddingLeft: indent + 8 }}
        onClick={() => onSelectFile(node.relPath)}
      >
        <FileNixIcon />
        <span className="tree-name">{node.name}</span>
      </div>
    );
  }

  return (
    <>
      <div
        className="tree-dir"
        style={{ paddingLeft: indent + 8 }}
        onClick={() => onToggle(node.relPath)}
      >
        <ChevronRightIcon expanded={isExpanded} />
        <FolderIcon open={isExpanded} />
        <span className="tree-name">{node.name}</span>
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <FileTreeNode
            key={child.relPath}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
          />
        ))}
    </>
  );
}

// ─── FileTree ─────────────────────────────────────────────────────────────────

function FileTree({
  files,
  selectedFile,
  onSelectFile,
}: {
  files: string[];
  selectedFile: string | null;
  onSelectFile: (rel: string) => void;
}) {
  // Start with all dirs expanded
  const allDirs = files
    .flatMap((f) => {
      const parts = f.split("/");
      return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
    });
  const [expanded, setExpanded] = useState<Set<string>>(new Set(allDirs));

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });

  const tree = buildTree(files);

  if (files.length === 0) {
    return (
      <div className="tree-empty">No .nix files found</div>
    );
  }

  return (
    <div className="file-tree">
      {tree.map((node) => (
        <FileTreeNode
          key={node.relPath}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  configs,
  selectedId,
  onSelect,
  onRemove,
  onAddConfig,
  onRescan,
  isBusy,
  nixFiles,
  selectedFile,
  onSelectFile,
}: Props) {
  const hasFiles = nixFiles.length > 0;

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isBusy) onRemove(id);
  };

  return (
    <aside className={`sidebar ${hasFiles ? "has-files" : ""}`}>
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

      {hasFiles && (
        <>
          <div className="sidebar-section-label" style={{ marginTop: 4 }}>Files</div>
          <div className="sidebar-files">
            <FileTree
              files={nixFiles}
              selectedFile={selectedFile}
              onSelectFile={onSelectFile}
            />
          </div>
        </>
      )}

      <div className="sidebar-footer">
        <button className="sidebar-action-btn" onClick={onAddConfig} disabled={isBusy}>
          <PlusIcon />
          Add config…
        </button>
        <button className="sidebar-action-btn" onClick={onRescan} disabled={isBusy}>
          <RefreshIcon />
          Rescan
        </button>
      </div>
    </aside>
  );
}
