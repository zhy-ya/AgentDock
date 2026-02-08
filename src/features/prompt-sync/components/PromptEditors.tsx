import { motion } from "framer-motion";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { EditorKey, EditorState } from "../hooks/usePromptEditors";
import { EDITOR_FILES } from "../hooks/usePromptEditors";

const AGENT_KEYS: EditorKey[] = ["codex", "gemini", "claude"];
const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 18 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, delay: index * 0.04 },
  }),
};

const AGENT_BADGE: Partial<Record<EditorKey, "codex" | "gemini" | "claude">> = {
  codex: "codex",
  gemini: "gemini",
  claude: "claude",
};

export function PromptEditors({
  editors,
  onContentChange,
}: {
  editors: Record<EditorKey, EditorState>;
  onContentChange: (key: EditorKey, value: string) => void;
}) {
  const base = EDITOR_FILES.find((e) => e.key === "base")!;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <EditorCard
        editorKey="base"
        label={base.label}
        sub={base.sub}
        state={editors.base}
        onChange={(v) => onContentChange("base", v)}
        className="min-h-[240px] max-h-[40vh]"
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
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
              className="min-h-[300px] lg:max-h-[52vh]"
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
  const badgeVariant = AGENT_BADGE[editorKey] ?? "muted";

  return (
    <motion.div
      variants={CARD_VARIANTS}
      initial="hidden"
      animate="show"
      custom={editorKey === "base" ? 0 : AGENT_KEYS.indexOf(editorKey) + 1}
    >
      <Card
        className={cn(
          "flex h-full flex-col overflow-hidden rounded-2xl border border-white/60",
          className,
        )}
      >
        <CardHeader className="gap-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">{label}</CardTitle>
            <div className="flex items-center gap-2">
              {editorKey !== "base" && <Badge variant={badgeVariant}>{editorKey}</Badge>}
              {isDirty && <span className="size-2 rounded-full bg-amber-400 shadow-sm" />}
            </div>
          </div>
          <CardDescription>{sub}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 px-4 pb-4 pt-3">
          <Textarea
            className="min-h-full flex-1 resize-none"
            value={state.content}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              editorKey === "base"
                ? "输入所有 Agent 共享的 prompt（可选）..."
                : `输入 ${label} 专属 prompt...`
            }
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
