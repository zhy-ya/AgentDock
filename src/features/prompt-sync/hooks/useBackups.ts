import { useState, useCallback } from "react";
import { listBackups, restoreBackup } from "@/api";
import type { BackupInfo } from "@/types";

export function useBackups(
  setStatusMessage: (msg: string) => void,
  setErrorMessage: (msg: string) => void,
  refreshFiles: () => Promise<string[]>,
) {
  const [backupItems, setBackupItems] = useState<BackupInfo[]>([]);

  const refreshBackups = useCallback(async () => {
    try {
      const items = await listBackups();
      setBackupItems(items);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }, [setErrorMessage]);

  const restoreBackupAction = useCallback(
    async (id: string) => {
      if (!window.confirm(`确认恢复备份 ${id}？`)) return;
      try {
        const r = await restoreBackup(id);
        setStatusMessage(`恢复完成，${r.restored_count} 个文件`);
        await refreshFiles();
        await refreshBackups();
      } catch (e) {
        setErrorMessage(String(e));
      }
    },
    [setStatusMessage, setErrorMessage, refreshFiles, refreshBackups],
  );

  return {
    backupItems,
    setBackupItems,
    refreshBackups,
    restoreBackupAction,
  };
}
