import { useState, useEffect, useRef, useCallback } from "react";
import { readScopeFile, saveScopeFile } from "@/api";

const SCOPE = "source" as const;

export type EditorKey = "base" | "codex" | "gemini" | "claude";

export interface EditorState {
  content: string;
  original: string;
}

export const EDITOR_FILES: { key: EditorKey; path: string; label: string; sub: string }[] = [
  { key: "base", path: "instructions/base.md", label: "共享 Base", sub: "所有 Agent 共享的基础 prompt" },
  { key: "codex", path: "instructions/codex.md", label: "Codex", sub: "→ ~/.codex/AGENTS.md" },
  { key: "gemini", path: "instructions/gemini.md", label: "Gemini", sub: "→ ~/.gemini/GEMINI.md" },
  { key: "claude", path: "instructions/claude.md", label: "Claude", sub: "→ ~/.claude/CLAUDE.md" },
];

const EMPTY: EditorState = { content: "", original: "" };

export function usePromptEditors(
  _setStatusMessage: (msg: string) => void,
  setErrorMessage: (msg: string) => void,
) {
  const [editors, setEditors] = useState<Record<EditorKey, EditorState>>({
    base: EMPTY,
    codex: EMPTY,
    gemini: EMPTY,
    claude: EMPTY,
  });

  const editorsRef = useRef(editors);
  editorsRef.current = editors;

  const loadAll = useCallback(async () => {
    const next: Record<string, EditorState> = {};
    for (const { key, path } of EDITOR_FILES) {
      try {
        const d = await readScopeFile(SCOPE, path);
        next[key] = { content: d.content, original: d.content };
      } catch {
        // File doesn't exist yet — show empty editor
        next[key] = { content: "", original: "" };
      }
    }
    setEditors(next as Record<EditorKey, EditorState>);
  }, []);

  const updateContent = useCallback((key: EditorKey, value: string) => {
    setEditors((prev) => ({
      ...prev,
      [key]: { ...prev[key], content: value },
    }));
  }, []);

  const saveAll = useCallback(async (): Promise<boolean> => {
    let saved = 0;
    for (const { key, path } of EDITOR_FILES) {
      const state = editorsRef.current[key];
      // Skip base if empty and was empty (don't create empty base.md)
      if (key === "base" && state.original === "" && state.content.trim() === "") {
        continue;
      }
      if (state.content !== state.original) {
        try {
          await saveScopeFile(SCOPE, path, state.content);
          saved++;
        } catch (e) {
          setErrorMessage(String(e));
          return false;
        }
      }
    }
    // Update originals to match current
    setEditors((prev) => {
      const next = { ...prev };
      for (const { key } of EDITOR_FILES) {
        next[key] = { ...next[key], original: next[key].content };
      }
      return next;
    });
    return true;
  }, [setErrorMessage]);

  const dirty = EDITOR_FILES.some(
    ({ key }) => editors[key].content !== editors[key].original,
  );

  // Cmd+S shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveAll();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [saveAll]);

  return { editors, dirty, loadAll, updateContent, saveAll };
}
