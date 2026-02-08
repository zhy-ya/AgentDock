import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function SourceFileList({
  files,
  searchText,
  onSearchChange,
  selectedFile,
  onOpenFile,
}: {
  files: string[];
  searchText: string;
  onSearchChange: (value: string) => void;
  selectedFile: string;
  onOpenFile: (f: string) => void;
}) {
  return (
    <>
      <div className="p-4 border-b border-black/5 shrink-0">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            className="w-full border border-black/5 rounded-lg py-2 pl-9 pr-3 text-sm bg-white/70 outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索文件..."
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        <ul className="space-y-[1px]">
          {files.map((f) => (
            <li key={f}>
              <button
                onClick={() => onOpenFile(f)}
                className={cn(
                  "w-full text-left rounded-md px-3 py-[7px] text-sm transition-all cursor-pointer",
                  selectedFile === f
                    ? "bg-accent-bg text-accent font-semibold"
                    : "text-gray-500 hover:bg-black/[0.03] hover:text-gray-800",
                )}
              >
                {f}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
