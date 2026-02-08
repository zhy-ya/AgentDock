import { cn } from "@/lib/utils";
import { AGENT_COLORS } from "../utils/constants";
import type { EditorKey, EditorState } from "../hooks/usePromptEditors";
import { EDITOR_FILES } from "../hooks/usePromptEditors";

const AGENT_KEYS: EditorKey[] = ["codex", "gemini", "claude"];

export function PromptEditors({
  editors,
  onContentChange,
}: {
  editors: Record<EditorKey, EditorState>;
  onContentChange: (key: EditorKey, value: string) => void;
}) {
  const base = EDITOR_FILES.find((e) => e.key === "base")!;
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Base (shared) */}
      <EditorCard
        editorKey="base"
        label={base.label}
        sub={base.sub}
        state={editors.base}
        onChange={(v) => onContentChange("base", v)}
        className="min-h-[240px] max-h-[40vh]"
      />

      {/* 3 agent editors */}
      <div className="grid grid-cols-3 gap-4 flex-1 min-h-0">
        {AGENT_KEYS.map((key) => {
          const meta = EDITOR_FILES.find((e) => e.key === key)!;
          return (
            <EditorCard
              key={key}
              editorKey={key}
              label={meta.label}
              sub={meta.sub}
              state={editors[key]}
              onChange={(v) => onContentChange(key, v)}
              className="min-h-[320px] max-h-[50vh]"
            />
          );
        })}
      </div>
    </div>
  );
}

function EditorCard({
  editorKey,
  label,
  sub,
  state,
  onChange,
  className,
}: {
  editorKey: EditorKey;
  label: string;
  sub: string;
  state: EditorState;
  onChange: (value: string) => void;
  className?: string;
}) {
  const isDirty = state.content !== state.original;
  const colors = editorKey !== "base" ? AGENT_COLORS[editorKey] : undefined;

  return (
    <div
      className={cn(
        "glass rounded-2xl shadow-sm flex flex-col overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-4 py-2.5 border-b border-black/5 shrink-0",
          colors && colors.bg,
        )}
      >
        <div>
          <span className={cn("text-sm font-semibold", colors?.text)}>
            {label}
            {isDirty && <span className="text-red-500 ml-1">*</span>}
          </span>
          <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
        </div>
      </div>
      <textarea
        className="flex-1 w-full border-0 p-3 font-mono text-sm leading-relaxed resize-none outline-none bg-[oklch(0.98_0_0/0.7)]"
        value={state.content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          editorKey === "base"
            ? "输入所有 Agent 共享的 prompt（可选）..."
            : `输入 ${label} 专属 prompt...`
        }
      />
    </div>
  );
}
