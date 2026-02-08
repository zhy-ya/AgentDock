import { type ReactNode, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CloudUpload,
  Database,
  FolderSync,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { applySync, previewSync } from "@/api";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { useBackups } from "../hooks/useBackups";
import { usePromptEditors } from "../hooks/usePromptEditors";
import { useWorkspace } from "../hooks/useWorkspace";
import { BackupPanel } from "./BackupPanel";
import { PromptEditors } from "./PromptEditors";

type View = "prompts" | "backups";
const MIN_REFRESH_FEEDBACK_MS = 650;

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
  const { editors, dirty, loadAll, updateContent, saveAll } =
    usePromptEditors(setStatusMessage, setErrorMessage);

  const onRestored = useCallback(async () => {
    await loadAll();
  }, [loadAll]);

  const { backupItems, refreshBackups, restoreBackupAction, deleteBackupAction } =
    useBackups(setStatusMessage, setErrorMessage, { onRestored });

  const [view, setView] = useState<View>("prompts");
  const [isReloading, setIsReloading] = useState(false);

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
    const saved = await saveAll();
    if (!saved) return;
    try {
      const preview = await previewSync();
      const changedIds = preview.items
        .filter((item) => item.status !== "unchanged")
        .map((item) => item.id);

      if (changedIds.length === 0) {
        setStatusMessage("所有文件已是最新，无需同步");
        return;
      }

      const result = await applySync(changedIds);
      setStatusMessage(
        `同步完成，${result.applied_count} 个文件已更新${result.backup_id ? `（备份 ${result.backup_id}）` : ""}`,
      );
      await refreshBackups();
    } catch (error) {
      setErrorMessage(String(error));
    }
  }

  async function onReloadWorkspace() {
    if (isReloading) return;
    setIsReloading(true);
    setStatusMessage("正在刷新工作区...");
    const startedAt = Date.now();
    try {
      await boot();
      await loadAll();
      await refreshBackups();
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_REFRESH_FEEDBACK_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_REFRESH_FEEDBACK_MS - elapsed),
        );
      }
      setIsReloading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-8 md:py-8">
      <BackgroundOrbs />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative mx-auto flex w-full max-w-7xl flex-col gap-5"
      >
        <Card className="glass-strong overflow-hidden">
          <CardHeader className="flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 p-2 text-white shadow-[0_16px_30px_-18px_rgba(6,182,212,0.8)]">
                  <FolderSync className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">AgentDock Prompt Sync</CardTitle>
                  <CardDescription>统一管理 Codex / Gemini / Claude 指令配置</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="muted">
                  <Database className="mr-1 size-3.5" />
                  备份 {backupItems.length}
                </Badge>
                {dirty && (
                  <Badge>
                    <Sparkles className="mr-1 size-3.5" />
                    存在未保存修改
                  </Badge>
                )}
                {workspace && (
                  <Badge variant="muted" className="max-w-[min(60vw,30rem)] truncate">
                    {workspace.app_root}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => void onReloadWorkspace()}
                disabled={loading || isReloading}
              >
                <RefreshMotionIcon active={loading || isReloading} className="size-4" />
                刷新
              </Button>
              <Button onClick={() => void onQuickSync()} disabled={loading || isReloading}>
                <CloudUpload className="size-4" />
                一键同步
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Tabs
          value={view}
          onValueChange={(next) => {
            const selected = next as View;
            setView(selected);
            if (selected === "backups") {
              void refreshBackups();
            }
          }}
        >
          <TabsList>
            <TabsTrigger value="prompts">Prompt 修改</TabsTrigger>
            <TabsTrigger value="backups">备份管理</TabsTrigger>
          </TabsList>
          <TabsContent value="prompts">
            <PromptEditors editors={editors} onContentChange={updateContent} />
          </TabsContent>
          <TabsContent value="backups">
            <BackupPanel
              backupItems={backupItems}
              onRestore={(id) => void restoreBackupAction(id)}
              onDelete={(id) => void deleteBackupAction(id)}
              onRefresh={() => refreshBackups()}
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {statusMessage && (
          <StatusToast key={`ok-${statusMessage}`} tone="success">
            <CheckCircle2 className="size-4" />
            {statusMessage}
          </StatusToast>
        )}
        {errorMessage && (
          <StatusToast key={`error-${errorMessage}`} tone="error">
            <XCircle className="size-4" />
            {errorMessage}
          </StatusToast>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusToast({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`fixed right-4 top-4 z-50 flex max-w-lg items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-xl ${
        tone === "success"
          ? "border-emerald-300/60 bg-emerald-50/85 text-emerald-700"
          : "border-red-300/60 bg-red-50/88 text-red-700"
      }`}
    >
      {children}
    </motion.div>
  );
}

function BackgroundOrbs() {
  return (
    <>
      <motion.div
        className="pointer-events-none absolute -left-16 top-6 h-64 w-64 rounded-full bg-cyan-300/28 blur-3xl"
        animate={{ y: [0, -12, 0], x: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 7, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-emerald-300/24 blur-3xl"
        animate={{ y: [0, 16, 0], x: [0, -8, 0] }}
        transition={{ repeat: Infinity, duration: 9, ease: "easeInOut" }}
      />
    </>
  );
}

function RefreshMotionIcon({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <motion.span
      className="inline-flex"
      animate={active ? { rotate: 360 } : { rotate: 0 }}
      transition={
        active
          ? { rotate: { duration: 1, repeat: Infinity, ease: "linear" } }
          : { duration: 0.2 }
      }
    >
      <RefreshCw className={className} />
    </motion.span>
  );
}
