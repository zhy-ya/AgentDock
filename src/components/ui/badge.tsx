import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "muted"
  | "codex"
  | "gemini"
  | "claude"
  | "code";

const badgeClasses: Record<BadgeVariant, string> = {
  default: "border border-black/10 bg-black/6 text-zinc-800",
  muted: "border border-black/10 bg-white/72 text-zinc-600",
  codex: "border border-black/10 bg-white/78 text-zinc-800",
  code: "border border-black/10 bg-white/78 text-zinc-800",
  gemini: "border border-black/10 bg-white/78 text-zinc-800",
  claude: "border border-black/10 bg-white/78 text-zinc-800",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
        badgeClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
