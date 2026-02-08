import { useState, useCallback } from "react";
import { initWorkspace } from "@/api";
import type { WorkspaceInfo } from "@/types";

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const boot = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");
    try {
      const ws = await initWorkspace();
      setWorkspace(ws);
      setStatusMessage("工作区就绪");
    } catch (e) {
      setErrorMessage(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    workspace,
    loading,
    statusMessage,
    setStatusMessage,
    errorMessage,
    setErrorMessage,
    boot,
  };
}
