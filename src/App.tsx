import { useEffect, useMemo, useState } from "react";
import {
  applyImportPackage,
  applySync,
  deleteScopeFile,
  exportSharePackage,
  getAgentEndpoints,
  getMapping,
  initWorkspace,
  listBackups,
  listScopeFiles,
  previewImportPackage,
  previewSync,
  readScopeFile,
  restoreBackup,
  saveMapping,
  saveScopeFile,
} from "./api";
import type {
  AgentEndpoint,
  BackupInfo,
  ImportPreview,
  MappingConfig,
  ScopeName,
  SyncItem,
  SyncPreview,
  WorkspaceInfo,
} from "./types";
import "./App.css";

type ViewKey = "dashboard" | "editor" | "sync";

const SCOPE_ITEMS: ScopeName[] = ["source", "codex", "gemini", "claude"];
const AGENTS: ScopeName[] = ["codex", "gemini", "claude"];

function formatUnixMs(ms: number) {
  return new Date(ms).toLocaleString();
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [endpoints, setEndpoints] = useState<AgentEndpoint[]>([]);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [scope, setScope] = useState<ScopeName>("source");
  const [, setBasePath] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");

  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const [mappingText, setMappingText] = useState("{}\n");

  const [syncPreviewData, setSyncPreviewData] = useState<SyncPreview | null>(null);
  const [selectedSyncIds, setSelectedSyncIds] = useState<string[]>([]);
  const [focusedSyncId, setFocusedSyncId] = useState("");

  const [sanitizeExport, setSanitizeExport] = useState(true);
  const [lastExportPath, setLastExportPath] = useState("");
  const [importZipPath, setImportZipPath] = useState("");
  const [importPreviewData, setImportPreviewData] = useState<ImportPreview | null>(null);
  const [overwriteImport, setOverwriteImport] = useState(true);

  const [backupItems, setBackupItems] = useState<BackupInfo[]>([]);

  const visibleFiles = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return files;
    return files.filter((file) => file.toLowerCase().includes(keyword));
  }, [files, searchText]);

  const changedSyncItems = useMemo(() => {
    if (!syncPreviewData) return [];
    return syncPreviewData.items.filter((item) => item.status !== "unchanged");
  }, [syncPreviewData]);

  const focusedSyncItem = useMemo<SyncItem | null>(() => {
    if (!syncPreviewData || !focusedSyncId) return null;
    return syncPreviewData.items.find((item) => item.id === focusedSyncId) ?? null;
  }, [syncPreviewData, focusedSyncId]);

  const endpointSummary = useMemo(() => {
    return AGENTS.map((agent) => {
      const records = endpoints.filter((item) => item.agent === agent);
      const existingCount = records.filter((item) => item.exists).length;
      return { agent, total: records.length, existing: existingCount, records };
    });
  }, [endpoints]);

  const totalEndpoints = useMemo(() => endpoints.length, [endpoints]);
  const existingEndpoints = useMemo(() => endpoints.filter((e) => e.exists).length, [endpoints]);
  const missingEndpoints = useMemo(() => endpoints.filter((e) => !e.exists).length, [endpoints]);

  async function refreshScopeFiles(targetScope: ScopeName) {
    try {
      const data = await listScopeFiles(targetScope);
      setFiles(data.files);
      setBasePath(data.base_path);
      if (selectedFile && !data.files.includes(selectedFile)) {
        setSelectedFile("");
        setFileContent("");
        setDirty(false);
      }
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function boot() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [ws, mapping, backups, endpointData] = await Promise.all([
        initWorkspace(),
        getMapping(),
        listBackups(),
        getAgentEndpoints(),
      ]);
      setWorkspace(ws);
      setMappingText(`${JSON.stringify(mapping, null, 2)}\n`);
      setBackupItems(backups);
      setEndpoints(endpointData);
      setStatusMessage("工作区就绪");
      await refreshScopeFiles(scope);
    } catch (error) {
      setErrorMessage(String(error));
    } finally {
      setLoading(false);
    }
  }

  async function openFile(targetFile: string) {
    if (dirty) {
      const allow = window.confirm("当前文件有未保存更改，是否放弃？");
      if (!allow) return;
    }
    setErrorMessage("");
    try {
      const data = await readScopeFile(scope, targetFile);
      setSelectedFile(targetFile);
      setFileContent(data.content);
      setDirty(false);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onSaveFile() {
    if (!selectedFile) return;
    try {
      await saveScopeFile(scope, selectedFile, fileContent);
      setDirty(false);
      setStatusMessage(`已保存 ${scope}/${selectedFile}`);
      await refreshScopeFiles(scope);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onCreateFile() {
    const suggested =
      scope === "source"
        ? "instructions/global.md"
        : scope === "codex"
          ? "AGENTS.md"
          : scope === "gemini"
            ? "GEMINI.md"
            : "CLAUDE.md";
    const relativePath = window.prompt("输入新文件路径", suggested)?.trim();
    if (!relativePath) return;
    try {
      await saveScopeFile(scope, relativePath, "");
      setStatusMessage(`已创建 ${scope}/${relativePath}`);
      await refreshScopeFiles(scope);
      await openFile(relativePath);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onDeleteFile() {
    if (!selectedFile) return;
    if (!window.confirm(`确认删除 ${scope}/${selectedFile}？`)) return;
    try {
      await deleteScopeFile(scope, selectedFile);
      setStatusMessage(`已删除 ${scope}/${selectedFile}`);
      setSelectedFile("");
      setFileContent("");
      setDirty(false);
      await refreshScopeFiles(scope);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onSaveMapping() {
    try {
      const parsed = JSON.parse(mappingText) as MappingConfig;
      await saveMapping(parsed);
      setStatusMessage("映射规则已保存");
      const endpointData = await getAgentEndpoints();
      setEndpoints(endpointData);
    } catch (error) {
      setErrorMessage(`映射保存失败: ${String(error)}`);
    }
  }

  async function onPreviewSync() {
    try {
      const data = await previewSync();
      setSyncPreviewData(data);
      const initialSelected = data.items
        .filter((item) => item.status !== "unchanged")
        .map((item) => item.id);
      setSelectedSyncIds(initialSelected);
      setFocusedSyncId(initialSelected[0] ?? "");
      setStatusMessage(`预览完成，${data.items.length} 个端点`);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  function toggleSyncItem(itemId: string) {
    setSelectedSyncIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  }

  async function onApplySync() {
    try {
      const result = await applySync(selectedSyncIds);
      setStatusMessage(
        `同步完成，${result.applied_count} 个文件${result.backup_id ? `（备份 ${result.backup_id}）` : ""}`,
      );
      await onPreviewSync();
      const [backups, endpointData] = await Promise.all([listBackups(), getAgentEndpoints()]);
      setBackupItems(backups);
      setEndpoints(endpointData);
      await refreshScopeFiles(scope);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onExportShare() {
    try {
      const result = await exportSharePackage(sanitizeExport);
      setLastExportPath(result.path);
      setStatusMessage(`导出完成: ${result.path}`);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onPreviewImport() {
    if (!importZipPath.trim()) {
      setErrorMessage("请输入 zip 路径");
      return;
    }
    try {
      const result = await previewImportPackage(importZipPath.trim());
      setImportPreviewData(result);
      setStatusMessage(`预览完成，${result.files.length} 个文件`);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onApplyImport() {
    if (!importZipPath.trim()) {
      setErrorMessage("请输入 zip 路径");
      return;
    }
    if (!window.confirm("确认执行导入？")) return;
    try {
      const result = await applyImportPackage(importZipPath.trim(), overwriteImport);
      setStatusMessage(
        `导入完成，${result.applied_count} 个应用，${result.skipped_count} 个跳过`,
      );
      await refreshScopeFiles(scope);
      const backups = await listBackups();
      setBackupItems(backups);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onRestoreBackup(backupId: string) {
    if (!window.confirm(`确认恢复备份 ${backupId}？`)) return;
    try {
      const result = await restoreBackup(backupId);
      setStatusMessage(`恢复完成，${result.restored_count} 个文件`);
      await refreshScopeFiles(scope);
      const backups = await listBackups();
      setBackupItems(backups);
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    void refreshScopeFiles(scope);
  }, [scope]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void onSaveFile();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [scope, selectedFile, fileContent]);

  return (
    <div className="app-layout">
      {/* ===== Sidebar ===== */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">AI</div>
          <span className="brand-text">Config Manager</span>
        </div>

        <div className="nav-section">
          <div className="nav-label">Menu</div>
          <button
            className={`nav-btn ${activeView === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveView("dashboard")}
          >
            <span className="nav-icon">&#9632;</span> Dashboard
          </button>
          <button
            className={`nav-btn ${activeView === "editor" ? "active" : ""}`}
            onClick={() => setActiveView("editor")}
          >
            <span className="nav-icon">&#9998;</span> Editor
          </button>
          <button
            className={`nav-btn ${activeView === "sync" ? "active" : ""}`}
            onClick={() => setActiveView("sync")}
          >
            <span className="nav-icon">&#8644;</span> Sync
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="workspace-info">
            {workspace ? workspace.app_root : "Loading..."}
          </div>
        </div>
      </aside>

      {/* ===== Main Area ===== */}
      <main className="main-area">
        {/* Top bar */}
        <div className="top-bar">
          <div>
            <h1>
              {activeView === "dashboard"
                ? "Dashboard"
                : activeView === "editor"
                  ? "Config Editor"
                  : "Sync & Tools"}
            </h1>
            <p className="top-bar-subtitle">
              {loading ? "Loading..." : "Local offline workspace"}
            </p>
          </div>
          <div className="top-bar-actions">
            <button className="btn" onClick={() => void boot()}>
              Refresh
            </button>
            {activeView === "sync" && (
              <button className="btn btn-primary" onClick={() => void onPreviewSync()}>
                Generate Preview
              </button>
            )}
          </div>
        </div>

        {/* Toast messages */}
        {statusMessage && <div className="toast toast-ok">{statusMessage}</div>}
        {errorMessage && <div className="toast toast-error">{errorMessage}</div>}

        {/* ===== Dashboard View ===== */}
        {activeView === "dashboard" && (
          <>
            {/* Stats row */}
            <div className="stats-row">
              <div className="stat-card accent">
                <p className="stat-label">Total Endpoints</p>
                <p className="stat-value">{totalEndpoints}</p>
                <p className="stat-sub">{AGENTS.length} agents configured</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Active</p>
                <p className="stat-value">{existingEndpoints}</p>
                <p className="stat-sub">Files present</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Missing</p>
                <p className="stat-value">{missingEndpoints}</p>
                <p className="stat-sub">Need sync</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Backups</p>
                <p className="stat-value">{backupItems.length}</p>
                <p className="stat-sub">Available snapshots</p>
              </div>
            </div>

            {/* Agent cards + Quick actions */}
            <div className="content-grid">
              {/* Agent endpoint detail */}
              <div className="card">
                <div className="card-header">
                  <h2>Agent Endpoints</h2>
                </div>
                <div className="card-body">
                  <ul className="endpoint-list">
                    {endpointSummary.map((item) =>
                      item.records.map((record) => (
                        <li key={`${record.agent}:${record.path}`} className="endpoint-item">
                          <div className={`endpoint-icon ${record.agent}`}>
                            {record.agent[0].toUpperCase()}
                          </div>
                          <div className="endpoint-detail">
                            <p className="endpoint-name">
                              {record.agent} / {record.kind}
                            </p>
                            <p className="endpoint-path">{record.path}</p>
                          </div>
                          <span className={`tag tag-${record.exists ? "exists" : "missing"}`}>
                            {record.exists ? "exists" : "missing"}
                          </span>
                        </li>
                      )),
                    )}
                  </ul>
                </div>
              </div>

              {/* Quick Actions + Recent Backups */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div className="card">
                  <div className="card-header">
                    <h2>Quick Actions</h2>
                  </div>
                  <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => {
                        setActiveView("sync");
                        void onPreviewSync();
                      }}
                    >
                      Preview & Sync
                    </button>
                    <button
                      className="btn"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => setActiveView("editor")}
                    >
                      Edit Configs
                    </button>
                    <button
                      className="btn"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => void onExportShare()}
                    >
                      Export Share Package
                    </button>
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h2>Recent Backups</h2>
                  </div>
                  <div className="card-body">
                    {backupItems.length === 0 ? (
                      <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>
                        No backups yet
                      </p>
                    ) : (
                      <ul className="backup-list">
                        {backupItems.slice(0, 3).map((item) => (
                          <li key={item.backup_id} className="backup-item">
                            <div className="backup-meta">
                              <p className="backup-id">{item.backup_id}</p>
                              <p className="backup-detail">
                                {formatUnixMs(item.created_at)} &middot; {item.trigger} &middot;{" "}
                                {item.entry_count} files
                              </p>
                            </div>
                            <button
                              className="btn btn-sm"
                              onClick={() => void onRestoreBackup(item.backup_id)}
                            >
                              Restore
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== Editor View ===== */}
        {activeView === "editor" && (
          <div className="editor-layout">
            {/* File panel */}
            <div className="file-panel">
              <div className="file-panel-header">
                <div className="scope-tabs">
                  {SCOPE_ITEMS.map((item) => (
                    <button
                      key={item}
                      className={`scope-tab ${scope === item ? "active" : ""}`}
                      onClick={() => setScope(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <input
                  className="search-input"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search files..."
                />
              </div>

              <div className="file-list-area">
                <ul className="file-list">
                  {visibleFiles.map((file) => (
                    <li key={file}>
                      <button
                        className={`file-item ${selectedFile === file ? "active" : ""}`}
                        onClick={() => void openFile(file)}
                      >
                        {file}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="file-panel-footer">
                <button className="btn btn-sm" onClick={() => void onCreateFile()}>
                  + New
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => void onDeleteFile()}>
                  Delete
                </button>
              </div>
            </div>

            {/* Code panel */}
            <div className="code-panel">
              {selectedFile ? (
                <>
                  <div className="code-header">
                    <p className="code-filename">
                      {scope}/{selectedFile}
                      {dirty && <span className="dirty">*</span>}
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={() => void onSaveFile()}>
                      Save
                    </button>
                  </div>
                  <textarea
                    className="code-editor"
                    value={fileContent}
                    onChange={(e) => {
                      setFileContent(e.target.value);
                      setDirty(true);
                    }}
                  />
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">&#128196;</div>
                  <p>Select a file to edit</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== Sync View (Sync + Share + Backup merged) ===== */}
        {activeView === "sync" && (
          <>
            {/* Sync layout */}
            <div className="sync-layout">
              {/* Sync list panel */}
              <div className="sync-list-panel">
                <div className="sync-toolbar">
                  <h2>Changes</h2>
                  <span className="tag tag-update">{changedSyncItems.length} pending</span>
                </div>
                <div className="sync-stats">
                  <span>
                    Changed: <strong>{changedSyncItems.length}</strong>
                  </span>
                  <span>
                    Selected: <strong>{selectedSyncIds.length}</strong>
                  </span>
                </div>
                <ul className="sync-items">
                  {changedSyncItems.map((item) => (
                    <li
                      key={item.id}
                      className={`sync-item ${focusedSyncId === item.id ? "active" : ""}`}
                      onClick={() => setFocusedSyncId(item.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedSyncIds.includes(item.id)}
                        onChange={() => toggleSyncItem(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <div className="sync-item-info">
                        <div className="sync-item-agent">{item.agent}</div>
                        <div className="sync-item-path">{item.target_relative_path}</div>
                      </div>
                      <span className={`tag tag-${item.status}`}>{item.status}</span>
                    </li>
                  ))}
                  {changedSyncItems.length === 0 && (
                    <li className="sync-item" style={{ justifyContent: "center", color: "var(--ink-muted)" }}>
                      Click "Generate Preview" to scan
                    </li>
                  )}
                </ul>
                <div className="sync-footer">
                  <button className="btn btn-primary" onClick={() => void onApplySync()}>
                    Apply Selected
                  </button>
                </div>
              </div>

              {/* Diff panel */}
              <div className="diff-panel">
                {focusedSyncItem ? (
                  <>
                    <div className="diff-header">
                      <h2>Diff</h2>
                      <p className="diff-source">
                        {focusedSyncItem.source_file} &rarr; {focusedSyncItem.agent}/
                        {focusedSyncItem.target_relative_path}
                      </p>
                    </div>
                    <div className="diff-body">
                      <div className="diff-side">
                        <div className="diff-side-label">Before</div>
                        <pre>{focusedSyncItem.before}</pre>
                      </div>
                      <div className="diff-side">
                        <div className="diff-side-label">After</div>
                        <pre>{focusedSyncItem.after}</pre>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-state-icon">&#128269;</div>
                    <p>Select an item to see diff</p>
                  </div>
                )}
              </div>
            </div>

            {/* Mapping editor */}
            <div className="mapping-section">
              <div className="mapping-header">
                <h2>Mapping Rules</h2>
                <button className="btn btn-sm" onClick={() => void onSaveMapping()}>
                  Save Mapping
                </button>
              </div>
              <textarea
                className="mapping-editor"
                value={mappingText}
                onChange={(e) => setMappingText(e.target.value)}
              />
            </div>

            {/* Share & Backup */}
            <div className="secondary-cards">
              {/* Export / Import */}
              <div className="card">
                <div className="card-header">
                  <h2>Share</h2>
                </div>
                <div className="card-body">
                  <div className="share-section">
                    <div className="share-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={sanitizeExport}
                          onChange={(e) => setSanitizeExport(e.target.checked)}
                        />
                        Sanitize export
                      </label>
                      <button className="btn btn-sm btn-primary" onClick={() => void onExportShare()}>
                        Export ZIP
                      </button>
                    </div>
                    {lastExportPath && <p className="mono-text">{lastExportPath}</p>}

                    <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "8px 0" }} />

                    <input
                      className="text-input"
                      value={importZipPath}
                      onChange={(e) => setImportZipPath(e.target.value)}
                      placeholder="/path/to/share.zip"
                    />
                    <div className="share-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={overwriteImport}
                          onChange={(e) => setOverwriteImport(e.target.checked)}
                        />
                        Overwrite
                      </label>
                      <button className="btn btn-sm" onClick={() => void onPreviewImport()}>
                        Preview
                      </button>
                      <button className="btn btn-sm btn-primary" onClick={() => void onApplyImport()}>
                        Import
                      </button>
                    </div>

                    {importPreviewData && (
                      <ul className="import-preview-list">
                        {importPreviewData.files.map((item) => (
                          <li key={item.relative_path}>
                            <span className={`tag tag-${item.status}`}>{item.status}</span>
                            <span>{item.relative_path}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Backups */}
              <div className="card">
                <div className="card-header">
                  <h2>Backups</h2>
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      const items = await listBackups();
                      setBackupItems(items);
                    }}
                  >
                    Refresh
                  </button>
                </div>
                <div className="card-body">
                  {backupItems.length === 0 ? (
                    <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: 13 }}>
                      No backups
                    </p>
                  ) : (
                    <ul className="backup-list">
                      {backupItems.map((item) => (
                        <li key={item.backup_id} className="backup-item">
                          <div className="backup-meta">
                            <p className="backup-id">{item.backup_id}</p>
                            <p className="backup-detail">
                              {formatUnixMs(item.created_at)} &middot; {item.trigger} &middot;{" "}
                              {item.entry_count} files
                            </p>
                          </div>
                          <button
                            className="btn btn-sm"
                            onClick={() => void onRestoreBackup(item.backup_id)}
                          >
                            Restore
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
