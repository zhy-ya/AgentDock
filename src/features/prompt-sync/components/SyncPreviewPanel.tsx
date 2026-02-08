import { ArrowLeftRight, Eye, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SyncItem } from "@/types";
import { Badge, Btn } from "./ui";
import { DiffViewer } from "./DiffViewer";

function statusBadgeVariant(
  status: string,
): "green" | "yellow" | "blue" | "gray" {
  if (status === "create") return "green";
  if (status === "append") return "blue";
  return "yellow";
}

export function SyncPreviewPanel({
  changedItems,
  selectedIds,
  focusedId,
  focusedItem,
  onFocusItem,
  onToggleItem,
  onPreview,
  onApply,
}: {
  changedItems: SyncItem[];
  selectedIds: string[];
  focusedId: string;
  focusedItem: SyncItem | null;
  onFocusItem: (id: string) => void;
  onToggleItem: (id: string) => void;
  onPreview: () => void;
  onApply: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Btn primary onClick={onPreview}>
          <Eye size={14} /> 生成预览
        </Btn>
      </div>

      <div className="grid grid-cols-[380px_minmax(0,1fr)] gap-4 flex-1">
        {/* Change list */}
        <div className="glass rounded-2xl shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/5">
            <h2 className="text-[15px] font-semibold">变更列表</h2>
            <Badge variant="yellow">
              {changedItems.length} 项待处理
            </Badge>
          </div>
          <div className="flex gap-4 px-4 py-2.5 border-b border-black/5 text-sm text-gray-500">
            <span>
              变更:{" "}
              <strong className="text-gray-900">{changedItems.length}</strong>
            </span>
            <span>
              已选:{" "}
              <strong className="text-gray-900">{selectedIds.length}</strong>
            </span>
          </div>
          <ul className="flex-1 overflow-auto">
            {changedItems.map((item) => (
              <li
                key={item.id}
                onClick={() => onFocusItem(item.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border-b border-black/5 cursor-pointer transition-colors last:border-0",
                  focusedId === item.id
                    ? "bg-accent-bg"
                    : "hover:bg-black/[0.02]",
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => onToggleItem(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="accent-accent"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase">
                    {item.agent}
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">
                    {item.target_relative_path}
                  </div>
                </div>
                <Badge variant={statusBadgeVariant(item.status)}>
                  {item.status}
                </Badge>
              </li>
            ))}
            {changedItems.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-gray-400">
                点击「生成预览」扫描变更
              </li>
            )}
          </ul>
          <div className="p-3 border-t border-black/5">
            <Btn primary onClick={onApply}>
              <ArrowLeftRight size={14} /> 应用选中项
            </Btn>
          </div>
        </div>

        {/* Diff panel */}
        <div className="glass rounded-2xl shadow-sm flex flex-col overflow-hidden">
          {focusedItem ? (
            <>
              <div className="px-4 py-3.5 border-b border-black/5">
                <h2 className="text-[15px] font-semibold">差异对比</h2>
                <p className="text-[11px] text-gray-400 mt-1">
                  {focusedItem.source_file} &rarr;{" "}
                  {focusedItem.agent}/{focusedItem.target_relative_path}
                </p>
              </div>
              <div className="flex-1 overflow-auto">
                <DiffViewer
                  oldValue={focusedItem.before}
                  newValue={focusedItem.after}
                />
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
    </div>
  );
}
