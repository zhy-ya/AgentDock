import { useState } from "react";
import { RotateCcw, RefreshCw, Archive, Eye, ChevronDown, X, Trash2 } from "lucide-react";
import type { BackupInfo, BackupDetail } from "@/types";
import { getBackupDetail } from "@/api";
import { formatUnixMs, AGENT_COLORS } from "../utils/constants";
import { Btn } from "./ui";

export function BackupPanel({
  backupItems,
  onRestore,
  onDelete,
  onRefresh,
}: {
  backupItems: BackupInfo[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [detail, setDetail] = useState<BackupDetail | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function onView(id: string) {
    if (detail?.backup_id === id) {
      setDetail(null);
      return;
    }
    setLoadingId(id);
    try {
      const d = await getBackupDetail(id);
      setDetail(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">备份历史</h2>
        <Btn onClick={onRefresh}>
          <RefreshCw size={14} /> 刷新
        </Btn>
      </div>

      {backupItems.length === 0 ? (
        <div className="glass rounded-2xl shadow-sm flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
          <Archive size={40} strokeWidth={1} className="opacity-30" />
          <p className="text-sm">暂无备份</p>
          <p className="text-xs">同步操作会自动创建备份</p>
        </div>
      ) : (
        <div className="glass rounded-2xl shadow-sm overflow-hidden">
          <ul>
            {backupItems.map((b) => {
              const isExpanded = detail?.backup_id === b.backup_id;
              return (
                <li
                  key={b.backup_id}
                  className="border-b border-black/5 last:border-0"
                >
                  <div className="flex items-center justify-between px-5 py-3.5 gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono font-semibold truncate">
                        {b.backup_id}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatUnixMs(b.created_at)} &middot; {b.trigger}{" "}
                        &middot; {b.entry_count} 个文件
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Btn
                        sm
                        onClick={() => void onView(b.backup_id)}
                        disabled={loadingId === b.backup_id}
                      >
                        {isExpanded ? (
                          <X size={12} />
                        ) : (
                          <Eye size={12} />
                        )}
                        {loadingId === b.backup_id
                          ? "加载中"
                          : isExpanded
                            ? "收起"
                            : "查看"}
                      </Btn>
                      <Btn sm onClick={() => onRestore(b.backup_id)}>
                        <RotateCcw size={12} /> 恢复
                      </Btn>
                      <Btn sm danger onClick={() => onDelete(b.backup_id)}>
                        <Trash2 size={12} /> 删除
                      </Btn>
                    </div>
                  </div>

                  {isExpanded && detail && (
                    <BackupDetailView detail={detail} />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function BackupDetailView({ detail }: { detail: BackupDetail }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <div className="border-t border-black/5 bg-gray-50/50">
      {detail.entries.map((entry, idx) => {
        const colors = AGENT_COLORS[entry.agent];
        const isOpen = expandedIdx === idx;
        return (
          <div
            key={`${entry.agent}-${entry.target_relative_path}`}
            className="border-b border-black/5 last:border-0"
          >
            <button
              onClick={() => setExpandedIdx(isOpen ? null : idx)}
              className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-black/[0.02] transition-colors cursor-pointer"
            >
              <span
                className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${colors?.bg ?? "bg-gray-100"} ${colors?.text ?? "text-gray-600"}`}
              >
                {entry.agent}
              </span>
              <span className="text-xs text-gray-500 flex-1 truncate font-mono">
                {entry.target_relative_path}
              </span>
              <span className="text-[11px] text-gray-400">
                {entry.existed_before ? "已备份" : "新建文件"}
              </span>
              <ChevronDown
                size={14}
                className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="px-5 pb-3">
                {entry.backup_content != null ? (
                  <div className="rounded-lg overflow-hidden border border-black/5">
                    <div className="px-3 py-1.5 bg-gray-100 text-[11px] font-semibold text-gray-500">
                      备份内容
                    </div>
                    <pre className="p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-auto bg-white">
                      {entry.backup_content}
                    </pre>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-2">
                    该文件在同步前不存在
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
