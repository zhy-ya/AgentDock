import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Zap,
  PenLine,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { previewSync, applySync } from "@/api";
import { fadeIn } from "../utils/constants";
import { useWorkspace } from "../hooks/useWorkspace";
import { usePromptEditors } from "../hooks/usePromptEditors";
import { useBackups } from "../hooks/useBackups";
import { Btn } from "./ui";
import { PromptEditors } from "./PromptEditors";
import { BackupPanel } from "./BackupPanel";

type View = "prompts" | "backups";

const NAV_ITEMS: { key: View; label: string; icon: typeof PenLine }[] = [
  { key: "prompts", label: "Prompt 修改", icon: PenLine },
  { key: "backups", label: "备份管理", icon: Archive },
];

export function PromptSyncLayout() {
  const {
    loading,
    statusMessage,
    setStatusMessage,
    errorMessage,
    setErrorMessage,
    boot,
  } = useWorkspace();

  const { editors, dirty, loadAll, updateContent, saveAll } =
    usePromptEditors(setStatusMessage, setErrorMessage);

  const onRestored = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const { backupItems, refreshBackups, restoreBackupAction, deleteBackupAction } =
    useBackups(setStatusMessage, setErrorMessage, { onRestored });

  const [view, setView] = useState<View>("prompts");

  useEffect(() => {
    async function init() {
      await boot();
      await loadAll();
      await refreshBackups();
    }
    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onQuickSync() {
    const ok = await saveAll();
    if (!ok) return;

    try {
      const preview = await previewSync();
      const changedIds = preview.items
        .filter((i) => i.status !== "unchanged")
        .map((i) => i.id);

      if (changedIds.length === 0) {
        setStatusMessage("所有文件已是最新，无需同步");
        return;
      }

      const result = await applySync(changedIds);
      setStatusMessage(
        `同步完成，${result.applied_count} 个文件已更新${result.backup_id ? `（备份 ${result.backup_id}）` : ""}`,
      );
      await refreshBackups();
    } catch (e) {
      setErrorMessage(String(e));
    }
  }

  return (
    <div className="h-screen grid grid-cols-[200px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="h-screen flex flex-col glass border-r border-black/5">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-green-500 rounded-lg flex items-center justify-center text-white font-extrabold text-xs shadow-[0_2px_8px_rgba(21,128,61,0.3)]">
            AD
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight leading-tight">
              AgentDock
            </p>
            <p className="text-[10px] text-gray-400">Manage AI CLI configs</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => {
                setView(key);
                if (key === "backups") void refreshBackups();
              }}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-left w-full",
                view === key
                  ? "bg-accent-bg text-accent"
                  : "text-gray-600 hover:bg-black/[0.03]",
              )}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="h-screen overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                {view === "prompts" ? "Prompt 修改" : "备份管理"}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {loading
                  ? "加载中..."
                  : view === "prompts"
                    ? "编辑 prompt，一键同步到 Codex / Gemini / Claude"
                    : "查看和恢复同步备份"}
              </p>
            </div>
            {view === "prompts" && (
              <div className="flex gap-2 shrink-0">
                <Btn primary onClick={() => void onQuickSync()}>
                  <Zap size={14} /> 一键同步
                  {dirty && (
                    <span className="ml-1 w-2 h-2 rounded-full bg-white/60 inline-block" />
                  )}
                </Btn>
                <Btn
                  onClick={() => {
                    void boot();
                    void loadAll();
                  }}
                >
                  <RefreshCw size={14} />
                </Btn>
              </div>
            )}
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

          {/* Content */}
          {view === "prompts" ? (
            <PromptEditors editors={editors} onContentChange={updateContent} />
          ) : (
            <BackupPanel
              backupItems={backupItems}
              onRestore={(id) => void restoreBackupAction(id)}
              onDelete={(id) => void deleteBackupAction(id)}
              onRefresh={() => void refreshBackups()}
            />
          )}
        </div>
      </main>
    </div>
  );
}
