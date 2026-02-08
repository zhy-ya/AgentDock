import { useState, useMemo, useCallback } from "react";
import { listScopeFiles } from "@/api";

const SCOPE = "source" as const;

export function useSourceFiles(
  _setStatusMessage: (msg: string) => void,
  setErrorMessage: (msg: string) => void,
) {
  const [files, setFiles] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");

  const visibleFiles = useMemo(() => {
    const kw = searchText.trim().toLowerCase();
    if (!kw) return files;
    return files.filter((f) => f.toLowerCase().includes(kw));
  }, [files, searchText]);

  const refreshFiles = useCallback(async () => {
    try {
      const d = await listScopeFiles(SCOPE);
      setFiles(d.files);
      return d.files;
    } catch (e) {
      setErrorMessage(String(e));
      return [];
    }
  }, [setErrorMessage]);

  return {
    files,
    searchText,
    setSearchText,
    visibleFiles,
    refreshFiles,
  };
}
