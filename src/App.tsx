import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FileCode2,
  RefreshCw,
  ArrowLeftRight,
  Plus,
  Trash2,
  Save,
  Download,
  Upload,
  Search,
  FileText,
  History,
  RotateCcw,
  Eye,
  CheckCircle2,
  XCircle,
  Package,
  Zap,
} from "lucide-react";
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
  BackupInfo,
  ImportPreview,
  MappingConfig,
  ScopeName,
  SyncItem,
  SyncPreview,
  WorkspaceInfo,
} from "./types";
import { cn } from "@/lib/utils";
import "./App.css";

type ViewKey = "dashboard" | "editor" | "sync";

const SCOPE_ITEMS: ScopeName[] = ["source", "codex", "gemini", "claude"];
const AGENTS: ScopeName[] = ["codex", "gemini", "claude"];

const AGENT_COLORS: Record<string, { bg: string; text: string }> = {
  codex: { bg: "bg-codex-bg", text: "text-codex" },
  gemini: { bg: "bg-gemini-bg", text: "text-gemini" },
  claude: { bg: "bg-claude-bg", text: "text-claude" },
};

const NAV_ITEMS: { key: ViewKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "总览", icon: LayoutDashboard },
  { key: "editor", label: "编辑器", icon: FileCode2 },
  { key: "sync", label: "同步", icon: ArrowLeftRight },
];

const VIEW_TITLES: Record<ViewKey, { title: string; sub: string }> = {
  dashboard: { title: "总览", sub: "本地离线工作区" },
  editor: { title: "配置编辑器", sub: "管理配置源与代理文件" },
  sync: { title: "同步与工具", sub: "预览变更、映射、共享与备份" },
};

function formatUnixMs(ms: number) {
  return new Date(ms).toLocaleString();
}

const fadeIn = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 } };
const stagger = { animate: { transition: { staggerChildren: 0.04 } } };

function App() {
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [endpoints, setEndpoints] = useState<{ agent: ScopeName; kind: string; path: string; exists: boolean }[]>([]);

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
    const kw = searchText.trim().toLowerCase();
    if (!kw) return files;
    return files.filter((f) => f.toLowerCase().includes(kw));
  }, [files, searchText]);

  const changedSyncItems = useMemo(() => {
    if (!syncPreviewData) return [];
    return syncPreviewData.items.filter((i) => i.status !== "unchanged");
  }, [syncPreviewData]);

  const focusedSyncItem = useMemo<SyncItem | null>(() => {
    if (!syncPreviewData || !focusedSyncId) return null;
    return syncPreviewData.items.find((i) => i.id === focusedSyncId) ?? null;
  }, [syncPreviewData, focusedSyncId]);

  const totalEndpoints = endpoints.length;
  const existingEndpoints = endpoints.filter((e) => e.exists).length;
  const missingEndpoints = endpoints.filter((e) => !e.exists).length;

  async function refreshScopeFiles(s: ScopeName) {
    try {
      const d = await listScopeFiles(s);
      setFiles(d.files);
      setBasePath(d.base_path);
      if (selectedFile && !d.files.includes(selectedFile)) {
        setSelectedFile("");
        setFileContent("");
        setDirty(false);
      }
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function boot() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [ws, mapping, backups, ep] = await Promise.all([
        initWorkspace(),
        getMapping(),
        listBackups(),
        getAgentEndpoints(),
      ]);
      setWorkspace(ws);
      setMappingText(`${JSON.stringify(mapping, null, 2)}\n`);
      setBackupItems(backups);
      setEndpoints(ep);
      setStatusMessage("工作区就绪");
      await refreshScopeFiles(scope);
    } catch (e) {
      setErrorMessage(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function openFile(f: string) {
    if (dirty && !window.confirm("当前文件有未保存更改，是否放弃？")) return;
    setErrorMessage("");
    try {
      const d = await readScopeFile(scope, f);
      setSelectedFile(f);
      setFileContent(d.content);
      setDirty(false);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onSaveFile() {
    if (!selectedFile) return;
    try {
      await saveScopeFile(scope, selectedFile, fileContent);
      setDirty(false);
      setStatusMessage(`已保存 ${scope}/${selectedFile}`);
      await refreshScopeFiles(scope);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onCreateFile() {
    const suggested = scope === "source" ? "instructions/global.md" : scope === "codex" ? "AGENTS.md" : scope === "gemini" ? "GEMINI.md" : "CLAUDE.md";
    const p = window.prompt("输入新文件路径", suggested)?.trim();
    if (!p) return;
    try {
      await saveScopeFile(scope, p, "");
      setStatusMessage(`已创建 ${scope}/${p}`);
      await refreshScopeFiles(scope);
      await openFile(p);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onDeleteFile() {
    if (!selectedFile || !window.confirm(`确认删除 ${scope}/${selectedFile}？`)) return;
    try {
      await deleteScopeFile(scope, selectedFile);
      setStatusMessage(`已删除 ${scope}/${selectedFile}`);
      setSelectedFile("");
      setFileContent("");
      setDirty(false);
      await refreshScopeFiles(scope);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onSaveMapping() {
    try {
      const parsed = JSON.parse(mappingText) as MappingConfig;
      await saveMapping(parsed);
      setStatusMessage("映射规则已保存");
      setEndpoints(await getAgentEndpoints());
    } catch (e) {
      setErrorMessage(`映射保存失败: ${String(e)}`);
    }
  }

  async function onPreviewSync() {
    try {
      const d = await previewSync();
      setSyncPreviewData(d);
      const ids = d.items.filter((i) => i.status !== "unchanged").map((i) => i.id);
      setSelectedSyncIds(ids);
      setFocusedSyncId(ids[0] ?? "");
      setStatusMessage(`预览完成，共 ${d.items.length} 个端点`);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  function toggleSyncItem(id: string) {
    setSelectedSyncIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function onApplySync() {
    try {
      const r = await applySync(selectedSyncIds);
      setStatusMessage(`同步完成，${r.applied_count} 个文件${r.backup_id ? `（备份 ${r.backup_id}）` : ""}`);
      await onPreviewSync();
      const [b, ep] = await Promise.all([listBackups(), getAgentEndpoints()]);
      setBackupItems(b);
      setEndpoints(ep);
      await refreshScopeFiles(scope);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onExportShare() {
    try {
      const r = await exportSharePackage(sanitizeExport);
      setLastExportPath(r.path);
      setStatusMessage(`导出完成: ${r.path}`);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onPreviewImport() {
    if (!importZipPath.trim()) { setErrorMessage("请输入 zip 路径"); return; }
    try {
      const r = await previewImportPackage(importZipPath.trim());
      setImportPreviewData(r);
      setStatusMessage(`预览完成，${r.files.length} 个文件`);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onApplyImport() {
    if (!importZipPath.trim()) { setErrorMessage("请输入 zip 路径"); return; }
    if (!window.confirm("确认执行导入？")) return;
    try {
      const r = await applyImportPackage(importZipPath.trim(), overwriteImport);
      setStatusMessage(`导入完成，${r.applied_count} 个应用，${r.skipped_count} 个跳过`);
      await refreshScopeFiles(scope);
      setBackupItems(await listBackups());
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  async function onRestoreBackup(id: string) {
    if (!window.confirm(`确认恢复备份 ${id}？`)) return;
    try {
      const r = await restoreBackup(id);
      setStatusMessage(`恢复完成，${r.restored_count} 个文件`);
      await refreshScopeFiles(scope);
      setBackupItems(await listBackups());
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  useEffect(() => { void boot(); }, []);
  useEffect(() => { void refreshScopeFiles(scope); }, [scope]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void onSaveFile(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [scope, selectedFile, fileContent]);

  /* ============ UI helpers ============ */

  function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
      <motion.div {...fadeIn} className={cn("glass rounded-2xl shadow-sm overflow-hidden", className)}>
        {children}
      </motion.div>
    );
  }

  function CardHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/5">
        <h2 className="text-[15px] font-semibold tracking-tight">{children}</h2>
        {action}
      </div>
    );
  }

  function Badge({ variant, children }: { variant: "green" | "yellow" | "gray"; children: React.ReactNode }) {
    const cls = variant === "green" ? "bg-accent-light text-accent" : variant === "yellow" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400";
    return <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold", cls)}>{children}</span>;
  }

  function Btn({
    children, primary, danger, sm, className, ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean; danger?: boolean; sm?: boolean }) {
    return (
      <button
        {...rest}
        className={cn(
          "inline-flex items-center gap-1.5 font-semibold rounded-lg cursor-pointer transition-all duration-150",
          sm ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-[13px]",
          primary
            ? "bg-gradient-to-br from-accent to-green-600 text-white border-0 shadow-[0_2px_6px_rgba(21,128,61,0.2)] hover:shadow-[0_3px_10px_rgba(21,128,61,0.3)]"
            : danger
              ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              : "bg-white/70 backdrop-blur-sm text-gray-800 border border-black/10 hover:bg-gray-100",
          className,
        )}
      >
        {children}
      </button>
    );
  }

  /* ============ RENDER ============ */

  return (
    <div className="min-h-screen grid grid-cols-[240px_minmax(0,1fr)]">
      {/* ===== 侧边栏 ===== */}
      <aside className="glass border-r border-white/30 flex flex-col gap-8 p-6">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 bg-gradient-to-br from-accent to-green-500 rounded-lg flex items-center justify-center text-white font-extrabold text-base shadow-[0_2px_8px_rgba(21,128,61,0.3)]">
            AI
          </div>
          <span className="text-base font-bold tracking-tight">配置管理器</span>
        </div>

        <nav className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-1">导航</span>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full text-left cursor-pointer border border-transparent",
                activeView === key
                  ? "bg-accent-bg border-accent/10 text-accent font-semibold"
                  : "text-gray-500 hover:bg-black/[0.03] hover:text-gray-800",
              )}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-black/5">
          <p className="text-[11px] text-gray-400 break-all leading-relaxed">
            {workspace ? workspace.app_root : "加载中..."}
          </p>
        </div>
      </aside>

      {/* ===== 主区域 ===== */}
      <main className="p-6 overflow-auto flex flex-col gap-5">
        {/* 顶栏 */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{VIEW_TITLES[activeView].title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{loading ? "加载中..." : VIEW_TITLES[activeView].sub}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Btn onClick={() => void boot()}><RefreshCw size={14} /> 刷新</Btn>
            {activeView === "sync" && <Btn primary onClick={() => void onPreviewSync()}><Eye size={14} /> 生成预览</Btn>}
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div {...fadeIn} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm backdrop-blur-sm bg-green-50/70 border border-green-600/10 text-green-700">
              <CheckCircle2 size={16} /> {statusMessage}
            </motion.div>
          )}
          {errorMessage && (
            <motion.div {...fadeIn} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm backdrop-blur-sm bg-red-50/80 border border-red-600/10 text-red-600">
              <XCircle size={16} /> {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ======= 总览 ======= */}
        <AnimatePresence mode="wait">
          {activeView === "dashboard" && (
            <motion.div key="dashboard" {...fadeIn} className="flex flex-col gap-5">
              {/* 统计卡片 */}
              <motion.div className="grid grid-cols-4 gap-4" {...stagger}>
                {([
                  { label: "全部端点", value: totalEndpoints, sub: `已配置 ${AGENTS.length} 个代理`, accent: true },
                  { label: "已就绪", value: existingEndpoints, sub: "文件已存在", accent: false },
                  { label: "缺失", value: missingEndpoints, sub: "需要同步", accent: false },
                  { label: "备份", value: backupItems.length, sub: "可用快照", accent: false },
                ] as const).map((s, i) => (
                  <motion.div
                    key={i}
                    {...fadeIn}
                    whileHover={{ y: -2 }}
                    className={cn(
                      "glass rounded-2xl p-5 shadow-sm",
                      s.accent && "!bg-gradient-to-br from-accent to-green-600 !border-transparent text-white shadow-[0_4px_16px_rgba(21,128,61,0.25)]",
                    )}
                  >
                    <p className={cn("text-sm font-medium mb-2", s.accent ? "text-white/80" : "text-gray-500")}>{s.label}</p>
                    <p className="text-[32px] font-extrabold leading-none tracking-tight">{s.value}</p>
                    <p className={cn("text-[11px] mt-2", s.accent ? "text-white/60" : "text-gray-400")}>{s.sub}</p>
                  </motion.div>
                ))}
              </motion.div>

              {/* 端点列表 + 快捷操作 */}
              <div className="grid grid-cols-2 gap-4">
                <GlassCard>
                  <CardHeader>代理端点</CardHeader>
                  <div className="p-5">
                    <ul className="space-y-0">
                      {endpoints.map((r) => (
                        <li key={`${r.agent}:${r.path}`} className="flex items-center gap-3 py-2.5 border-b border-black/5 last:border-0">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold uppercase", AGENT_COLORS[r.agent]?.bg, AGENT_COLORS[r.agent]?.text)}>
                            {r.agent[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{r.agent} / {r.kind}</p>
                            <p className="text-[11px] text-gray-400 truncate">{r.path}</p>
                          </div>
                          <Badge variant={r.exists ? "green" : "gray"}>{r.exists ? "就绪" : "缺失"}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                </GlassCard>

                <div className="flex flex-col gap-4">
                  <GlassCard>
                    <CardHeader>快捷操作</CardHeader>
                    <div className="p-5 flex flex-col gap-2.5">
                      <Btn primary className="w-full justify-center" onClick={() => { setActiveView("sync"); void onPreviewSync(); }}>
                        <Zap size={14} /> 预览并同步
                      </Btn>
                      <Btn className="w-full justify-center" onClick={() => setActiveView("editor")}>
                        <FileCode2 size={14} /> 编辑配置
                      </Btn>
                      <Btn className="w-full justify-center" onClick={() => void onExportShare()}>
                        <Package size={14} /> 导出共享包
                      </Btn>
                    </div>
                  </GlassCard>

                  <GlassCard>
                    <CardHeader>近期备份</CardHeader>
                    <div className="p-5">
                      {backupItems.length === 0 ? (
                        <p className="text-sm text-gray-400">暂无备份</p>
                      ) : (
                        <ul className="space-y-0">
                          {backupItems.slice(0, 3).map((b) => (
                            <li key={b.backup_id} className="flex items-center justify-between py-2.5 border-b border-black/5 last:border-0 gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-mono font-semibold">{b.backup_id}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{formatUnixMs(b.created_at)} &middot; {b.trigger} &middot; {b.entry_count} 个文件</p>
                              </div>
                              <Btn sm onClick={() => void onRestoreBackup(b.backup_id)}><RotateCcw size={12} /> 恢复</Btn>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </GlassCard>
                </div>
              </div>
            </motion.div>
          )}

          {/* ======= 编辑器 ======= */}
          {activeView === "editor" && (
            <motion.div key="editor" {...fadeIn} className="grid grid-cols-[260px_minmax(0,1fr)] gap-4 flex-1 min-h-0">
              {/* 文件面板 */}
              <div className="glass rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-black/5 flex flex-col gap-3">
                  <div className="flex gap-1 bg-gray-200/60 rounded-lg p-[3px]">
                    {SCOPE_ITEMS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setScope(s)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 px-1 text-xs font-semibold capitalize transition-all cursor-pointer",
                          scope === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className="w-full border border-black/5 rounded-lg py-2 pl-9 pr-3 text-sm bg-white/70 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="搜索文件..."
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-2">
                  <ul className="space-y-[1px]">
                    {visibleFiles.map((f) => (
                      <li key={f}>
                        <button
                          onClick={() => void openFile(f)}
                          className={cn(
                            "w-full text-left rounded-md px-3 py-[7px] text-sm transition-all cursor-pointer",
                            selectedFile === f ? "bg-accent-bg text-accent font-semibold" : "text-gray-500 hover:bg-black/[0.03] hover:text-gray-800",
                          )}
                        >
                          {f}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 border-t border-black/5 flex gap-2">
                  <Btn sm onClick={() => void onCreateFile()}><Plus size={12} /> 新建</Btn>
                  <Btn sm danger onClick={() => void onDeleteFile()}><Trash2 size={12} /> 删除</Btn>
                </div>
              </div>

              {/* 代码面板 */}
              <div className="glass rounded-2xl shadow-sm flex flex-col overflow-hidden">
                {selectedFile ? (
                  <>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 gap-3">
                      <p className="text-sm font-semibold">
                        {scope}/{selectedFile}
                        {dirty && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      <Btn sm primary onClick={() => void onSaveFile()}><Save size={12} /> 保存</Btn>
                    </div>
                    <textarea
                      className="code-editor-textarea"
                      value={fileContent}
                      onChange={(e) => { setFileContent(e.target.value); setDirty(true); }}
                    />
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-gray-400 gap-2">
                    <FileText size={40} strokeWidth={1} className="opacity-30" />
                    <p className="text-sm">请在左侧选择文件</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ======= 同步 ======= */}
          {activeView === "sync" && (
            <motion.div key="sync" {...fadeIn} className="flex flex-col gap-4">
              <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-4 flex-1">
                {/* 变更列表 */}
                <div className="glass rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/5">
                    <h2 className="text-[15px] font-semibold">变更列表</h2>
                    <Badge variant="yellow">{changedSyncItems.length} 项待处理</Badge>
                  </div>
                  <div className="flex gap-4 px-4 py-2.5 border-b border-black/5 text-sm text-gray-500">
                    <span>变更: <strong className="text-gray-900">{changedSyncItems.length}</strong></span>
                    <span>已选: <strong className="text-gray-900">{selectedSyncIds.length}</strong></span>
                  </div>
                  <ul className="flex-1 overflow-auto">
                    {changedSyncItems.map((item) => (
                      <li
                        key={item.id}
                        onClick={() => setFocusedSyncId(item.id)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-2.5 border-b border-black/5 cursor-pointer transition-colors last:border-0",
                          focusedSyncId === item.id ? "bg-accent-bg" : "hover:bg-black/[0.02]",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={selectedSyncIds.includes(item.id)}
                          onChange={() => toggleSyncItem(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-accent"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold uppercase">{item.agent}</div>
                          <div className="text-[11px] text-gray-400 truncate">{item.target_relative_path}</div>
                        </div>
                        <Badge variant={item.status === "create" ? "green" : "yellow"}>{item.status}</Badge>
                      </li>
                    ))}
                    {changedSyncItems.length === 0 && (
                      <li className="px-4 py-8 text-center text-sm text-gray-400">点击「生成预览」扫描变更</li>
                    )}
                  </ul>
                  <div className="p-3 border-t border-black/5">
                    <Btn primary onClick={() => void onApplySync()}><ArrowLeftRight size={14} /> 应用选中项</Btn>
                  </div>
                </div>

                {/* 差异面板 */}
                <div className="glass rounded-2xl shadow-sm flex flex-col overflow-hidden">
                  {focusedSyncItem ? (
                    <>
                      <div className="px-4 py-3.5 border-b border-black/5">
                        <h2 className="text-[15px] font-semibold">差异对比</h2>
                        <p className="text-[11px] text-gray-400 mt-1">{focusedSyncItem.source_file} &rarr; {focusedSyncItem.agent}/{focusedSyncItem.target_relative_path}</p>
                      </div>
                      <div className="flex-1 grid grid-cols-2 overflow-hidden">
                        <div className="flex flex-col overflow-hidden border-r border-black/5">
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100/60 border-b border-black/5">变更前</div>
                          <pre className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{focusedSyncItem.before}</pre>
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-100/60 border-b border-black/5">变更后</div>
                          <pre className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{focusedSyncItem.after}</pre>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] text-gray-400 gap-2">
                      <Search size={40} strokeWidth={1} className="opacity-30" />
                      <p className="text-sm">选择一项查看差异</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 映射规则 */}
              <GlassCard>
                <CardHeader action={<Btn sm onClick={() => void onSaveMapping()}><Save size={12} /> 保存映射</Btn>}>映射规则</CardHeader>
                <textarea className="mapping-textarea" value={mappingText} onChange={(e) => setMappingText(e.target.value)} />
              </GlassCard>

              {/* 共享 & 备份 */}
              <div className="grid grid-cols-2 gap-4">
                <GlassCard>
                  <CardHeader>共享</CardHeader>
                  <div className="p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={sanitizeExport} onChange={(e) => setSanitizeExport(e.target.checked)} className="accent-accent" />
                        脱敏导出
                      </label>
                      <Btn sm primary onClick={() => void onExportShare()}><Download size={12} /> 导出 ZIP</Btn>
                    </div>
                    {lastExportPath && <p className="text-[11px] font-mono text-gray-400 break-all">{lastExportPath}</p>}
                    <hr className="border-black/5" />
                    <input
                      className="w-full border border-black/5 rounded-lg py-2 px-3 text-sm bg-white/70 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
                      value={importZipPath}
                      onChange={(e) => setImportZipPath(e.target.value)}
                      placeholder="输入 zip 绝对路径"
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={overwriteImport} onChange={(e) => setOverwriteImport(e.target.checked)} className="accent-accent" />
                        覆盖已有
                      </label>
                      <Btn sm onClick={() => void onPreviewImport()}><Eye size={12} /> 预览</Btn>
                      <Btn sm primary onClick={() => void onApplyImport()}><Upload size={12} /> 导入</Btn>
                    </div>
                    {importPreviewData && (
                      <ul className="mt-1 border border-black/5 rounded-lg overflow-hidden">
                        {importPreviewData.files.map((f) => (
                          <li key={f.relative_path} className="flex items-center gap-3 px-3 py-2 border-b border-black/5 text-sm last:border-0">
                            <Badge variant={f.status === "create" ? "green" : "yellow"}>{f.status}</Badge>
                            <span>{f.relative_path}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </GlassCard>

                <GlassCard>
                  <CardHeader action={<Btn sm onClick={async () => setBackupItems(await listBackups())}><RefreshCw size={12} /> 刷新</Btn>}>备份历史</CardHeader>
                  <div className="p-5">
                    {backupItems.length === 0 ? (
                      <p className="text-sm text-gray-400">暂无备份</p>
                    ) : (
                      <ul className="space-y-0">
                        {backupItems.map((b) => (
                          <li key={b.backup_id} className="flex items-center justify-between py-2.5 border-b border-black/5 last:border-0 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-mono font-semibold">{b.backup_id}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{formatUnixMs(b.created_at)} &middot; {b.trigger} &middot; {b.entry_count} 个文件</p>
                            </div>
                            <Btn sm onClick={() => void onRestoreBackup(b.backup_id)}><History size={12} /> 恢复</Btn>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
