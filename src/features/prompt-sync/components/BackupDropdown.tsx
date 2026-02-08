import { useState, useRef, useEffect } from "react";
import { History, RotateCcw, ChevronDown } from "lucide-react";
import type { BackupInfo } from "@/types";
import { formatUnixMs } from "../utils/constants";
import { Btn } from "./ui";

export function BackupDropdown({
  backupItems,
  onRestore,
  onRefresh,
}: {
  backupItems: BackupInfo[];
  onRestore: (id: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Btn
        onClick={() => {
          if (!open) onRefresh();
          setOpen(!open);
        }}
      >
        <History size={14} /> 备份
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Btn>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 glass rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-black/5 text-sm font-semibold">
            备份历史
          </div>
          <div className="max-h-64 overflow-auto">
            {backupItems.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-400">暂无备份</p>
            ) : (
              <ul>
                {backupItems.map((b) => (
                  <li
                    key={b.backup_id}
                    className="flex items-center justify-between px-4 py-2.5 border-b border-black/5 last:border-0 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-semibold truncate">
                        {b.backup_id}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatUnixMs(b.created_at)} &middot; {b.trigger}{" "}
                        &middot; {b.entry_count} 个文件
                      </p>
                    </div>
                    <Btn
                      sm
                      onClick={() => {
                        onRestore(b.backup_id);
                        setOpen(false);
                      }}
                    >
                      <RotateCcw size={12} /> 恢复
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
