import { useState, useEffect, useRef, useCallback } from "react";
import { readScopeFile, saveScopeFile } from "@/api";

const SCOPE = "source" as const;

export function useFileEditor(
  setStatusMessage: (msg: string) => void,
  setErrorMessage: (msg: string) => void,
  refreshFiles: () => Promise<string[]>,
) {
  const [selectedFile, setSelectedFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const contentRef = useRef(fileContent);
  const selectedRef = useRef(selectedFile);
  contentRef.current = fileContent;
  selectedRef.current = selectedFile;

  const clearSelection = useCallback(() => {
    setSelectedFile("");
    setFileContent("");
    setDirty(false);
  }, []);

  const openFile = useCallback(
    async (f: string) => {
      if (dirty && !window.confirm("当前文件有未保存更改，是否放弃？")) return;
      setErrorMessage("");
      try {
        const d = await readScopeFile(SCOPE, f);
        setSelectedFile(f);
        setFileContent(d.content);
        setDirty(false);
      } catch (e) {
        setErrorMessage(String(e));
      }
    },
    [dirty, setErrorMessage],
  );

  const saveFile = useCallback(async () => {
    if (!selectedRef.current) return;
    try {
      await saveScopeFile(SCOPE, selectedRef.current, contentRef.current);
      setDirty(false);
      setStatusMessage(`已保存 source/${selectedRef.current}`);
      await refreshFiles();
    } catch (e) {
      setErrorMessage(String(e));
    }
  }, [setStatusMessage, setErrorMessage, refreshFiles]);

  const updateContent = useCallback((value: string) => {
    setFileContent(value);
    setDirty(true);
  }, []);

  // Cmd+S shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveFile();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [saveFile]);

  return {
    selectedFile,
    fileContent,
    dirty,
    openFile,
    saveFile,
    updateContent,
    clearSelection,
  };
}
