import type { ScopeName } from "@/types";

export const AGENTS: ScopeName[] = ["codex", "gemini", "claude"];

export const AGENT_COLORS: Record<string, { bg: string; text: string }> = {
  codex: { bg: "bg-codex-bg", text: "text-codex" },
  gemini: { bg: "bg-gemini-bg", text: "text-gemini" },
  claude: { bg: "bg-claude-bg", text: "text-claude" },
};

export const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

export const stagger = {
  animate: { transition: { staggerChildren: 0.04 } },
};

export function formatUnixMs(ms: number) {
  return new Date(ms).toLocaleString();
}
