import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { fadeIn } from "../utils/constants";
import { useWorkspace } from "../hooks/useWorkspace";
import { useSourceFiles } from "../hooks/useSourceFiles";
import { useFileEditor } from "../hooks/useFileEditor";
import { useBackups } from "../hooks/useBackups";
import { useSyncPreview } from "../hooks/useSyncPreview";
import { Btn } from "./ui";
import { SourceFileList } from "./SourceFileList";
import { FileEditor } from "./FileEditor";
import { SyncPreviewPanel } from "./SyncPreviewPanel";
import { BackupDropdown } from "./BackupDropdown";

export function PromptSyncLayout() {
  const {
    workspace,
    loading,
    statusMessage,
    setStatusMessage,
    errorMessage,
    setErrorMessage,
    boot,
  } = useWorkspace();

  const {
    searchText,
    setSearchText,
    visibleFiles,
    refreshFiles,
  } = useSourceFiles(setStatusMessage, setErrorMessage);

  const {
    selectedFile,
    fileContent,
    dirty,
    openFile,
    saveFile,
    updateContent,
  } = useFileEditor(setStatusMessage, setErrorMessage, refreshFiles);

  const {
    backupItems,
    setBackupItems,
    refreshBackups,
    restoreBackupAction,
  } = useBackups(setStatusMessage, setErrorMessage, refreshFiles);

  const {
    selectedSyncIds,
    focusedSyncId,
    setFocusedSyncId,
    changedSyncItems,
    focusedSyncItem,
    loadPreview,
    toggleItem,
    applySyncAction,
  } = useSyncPreview(setStatusMessage, setErrorMessage, refreshFiles, setBackupItems);

  useEffect(() => {
    async function init() {
      await boot();
      await refreshFiles();
      await refreshBackups();
    }
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen grid grid-cols-[280px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="h-screen overflow-hidden flex flex-col glass border-r border-white/30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-4 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-accent to-green-500 rounded-lg flex items-center justify-center text-white font-extrabold text-base shadow-[0_2px_8px_rgba(21,128,61,0.3)]">
            AI
          </div>
          <span className="text-base font-bold tracking-tight">
            配置管理器
          </span>
        </div>

        {/* File List */}
        <SourceFileList
          files={visibleFiles}
          searchText={searchText}
          onSearchChange={setSearchText}
          selectedFile={selectedFile}
          onOpenFile={(f) => void openFile(f)}
        />

        {/* Workspace path footer */}
        <div className="p-3 border-t border-black/5 shrink-0">
          <p className="text-[11px] text-gray-400 break-all leading-relaxed">
            {workspace ? workspace.app_root : "加载中..."}
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="h-screen overflow-y-auto p-6 flex flex-col gap-5">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Prompt 同步管理
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading ? "加载中..." : "编辑 source 文件，一键同步到各 Agent"}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <BackupDropdown
              backupItems={backupItems}
              onRestore={(id) => void restoreBackupAction(id)}
              onRefresh={() => void refreshBackups()}
            />
            <Btn
              onClick={() => {
                void boot();
                void refreshFiles();
                void refreshBackups();
              }}
            >
              <RefreshCw size={14} /> 刷新
            </Btn>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {statusMessage && (
            <motion.div
              {...fadeIn}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm backdrop-blur-sm bg-green-50/70 border border-green-600/10 text-green-700"
            >
              <CheckCircle2 size={16} /> {statusMessage}
            </motion.div>
          )}
          {errorMessage && (
            <motion.div
              {...fadeIn}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm backdrop-blur-sm bg-red-50/80 border border-red-600/10 text-red-600"
            >
              <XCircle size={16} /> {errorMessage}
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Editor */}
        <FileEditor
          selectedFile={selectedFile}
          fileContent={fileContent}
          dirty={dirty}
          onSave={() => void saveFile()}
          onContentChange={updateContent}
        />

        {/* Sync Preview Panel */}
        <SyncPreviewPanel
          changedItems={changedSyncItems}
          selectedIds={selectedSyncIds}
          focusedId={focusedSyncId}
          focusedItem={focusedSyncItem}
          onFocusItem={setFocusedSyncId}
          onToggleItem={toggleItem}
          onPreview={() => void loadPreview()}
          onApply={() => void applySyncAction()}
        />
      </main>
    </div>
  );
}
