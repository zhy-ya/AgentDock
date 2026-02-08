import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ChevronDown,
  Eye,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import type { BackupDetail, BackupInfo } from "@/types";
import { getBackupDetail } from "@/api";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { formatUnixMs } from "../utils/constants";
const MIN_REFRESH_FEEDBACK_MS = 550;

export function BackupPanel({
  backupItems,
  onRestore,
  onDelete,
  onRefresh,
}: {
  backupItems: BackupInfo[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => Promise<void> | void;
}) {
  const [detail, setDetail] = useState<BackupDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    type: "restore" | "delete";
    id: string;
  } | null>(null);

  async function onView(id: string) {
    if (detail?.backup_id === id) {
      setDetail(null);
      return;
    }
    setLoadingId(id);
    try {
      const next = await getBackupDetail(id);
      setDetail(next);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingId(null);
    }
  }

  function onConfirmAction() {
    if (!confirmState) return;
    const { type, id } = confirmState;
    setConfirmState(null);
    if (type === "restore") {
      onRestore(id);
      return;
    }
    onDelete(id);
  }

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const startedAt = Date.now();
    try {
      await onRefresh();
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_REFRESH_FEEDBACK_MS) {
        await new Promise((resolve) =>
          setTimeout(resolve, MIN_REFRESH_FEEDBACK_MS - elapsed),
        );
      }
      setIsRefreshing(false);
    }
  }

  return (
    <>
      <Card className="glass-strong">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>备份历史</CardTitle>
            <CardDescription>同步操作会自动生成快照，可回滚到任意历史版本。</CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
          >
            <RefreshMotionIcon active={isRefreshing} className="size-3.5" />
            刷新
          </Button>
        </CardHeader>
        <CardContent className="pt-4">
          {backupItems.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-2">
              {backupItems.map((item) => {
                const isExpanded = detail?.backup_id === item.backup_id;
                return (
                  <li
                    key={item.backup_id}
                    className="rounded-xl border border-white/50 bg-white/45 p-3 backdrop-blur-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs font-semibold text-slate-700">
                          {item.backup_id}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatUnixMs(item.created_at)} · {item.trigger} · {item.entry_count} 个文件
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={loadingId === item.backup_id}
                          onClick={() => void onView(item.backup_id)}
                        >
                          <Eye className="size-3.5" />
                          {loadingId === item.backup_id
                            ? "加载中"
                            : isExpanded
                              ? "收起"
                              : "查看"}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            setConfirmState({
                              type: "restore",
                              id: item.backup_id,
                            })
                          }
                        >
                          <RotateCcw className="size-3.5" />
                          恢复
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() =>
                            setConfirmState({
                              type: "delete",
                              id: item.backup_id,
                            })
                          }
                        >
                          <Trash2 className="size-3.5" />
                          删除
                        </Button>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && detail && (
                        <motion.div
                          key={detail.backup_id}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <BackupDetailView detail={detail} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmState} onOpenChange={(open) => !open && setConfirmState(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmState?.type === "restore" ? "确认恢复备份" : "确认删除备份"}
            </DialogTitle>
            <DialogDescription>
              {confirmState?.type === "restore"
                ? `将恢复备份 ${confirmState.id} 的内容，是否继续？`
                : `将删除备份 ${confirmState?.id}，删除后无法恢复，是否继续？`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmState(null)}>
              取消
            </Button>
            <Button
              variant={confirmState?.type === "delete" ? "danger" : "default"}
              onClick={onConfirmAction}
            >
              {confirmState?.type === "restore" ? "确认恢复" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/65 bg-white/35 py-16 text-slate-500">
      <Archive className="size-10 opacity-50" strokeWidth={1.5} />
      <p className="text-sm font-medium">暂无备份</p>
      <p className="text-xs">执行一次同步后会自动创建备份快照。</p>
    </div>
  );
}

function BackupDetailView({ detail }: { detail: BackupDetail }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-white/45 bg-white/55">
      {detail.entries.map((entry, idx) => {
        const isOpen = expandedIdx === idx;
        return (
          <div key={`${entry.agent}-${entry.target_relative_path}`} className="border-b border-white/45 last:border-0">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-white/60"
              onClick={() => setExpandedIdx(isOpen ? null : idx)}
            >
              <Badge variant={toAgentVariant(entry.agent)}>{entry.agent}</Badge>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">
                {entry.target_relative_path}
              </span>
              <span className="text-[11px] text-slate-500">
                {entry.existed_before ? "已备份" : "新建文件"}
              </span>
              <ChevronDown
                className={`size-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white/75 px-3 pb-3">
                    {entry.backup_content == null ? (
                      <p className="py-2 text-xs text-slate-500">该文件在同步前不存在</p>
                    ) : (
                      <pre className="max-h-64 overflow-auto rounded-lg border border-white/65 bg-white/90 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-700">
                        {entry.backup_content}
                      </pre>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function toAgentVariant(agent: string): "codex" | "gemini" | "claude" | "muted" {
  if (agent === "codex" || agent === "gemini" || agent === "claude") {
    return agent;
  }
  return "muted";
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
