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
  default: "bg-emerald-100/85 text-emerald-700",
  muted: "bg-white/60 text-slate-600",
  codex: "border border-[#111111]/18 bg-[#111111]/6 text-[#111111]",
  code: "border border-[#111111]/18 bg-[#111111]/6 text-[#111111]",
  gemini:
    "border border-[#3186FF]/28 bg-[linear-gradient(135deg,rgba(49,134,255,0.2),rgba(252,65,61,0.14),rgba(251,188,4,0.16),rgba(0,185,92,0.18))] text-[#2E67D1]",
  claude: "border border-[#C98A58]/24 bg-[#E9C9AA]/32 text-[#9A5A2D]",
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
