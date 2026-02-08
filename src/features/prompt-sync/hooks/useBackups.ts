import { useState, useCallback } from "react";
import { listBackups, restoreBackup, deleteBackup } from "@/api";
import type { BackupInfo } from "@/types";

export function useBackups(
  setStatusMessage: (msg: string) => void,
  setErrorMessage: (msg: string) => void,
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
        await refreshBackups();
      } catch (e) {
        setErrorMessage(String(e));
      }
    },
    [setStatusMessage, setErrorMessage, refreshBackups],
  );

  const deleteBackupAction = useCallback(
    async (id: string) => {
      if (!window.confirm(`确认删除备份 ${id}？删除后无法恢复。`)) return;
      try {
        await deleteBackup(id);
        setStatusMessage("备份已删除");
        await refreshBackups();
      } catch (e) {
        setErrorMessage(String(e));
      }
    },
    [setStatusMessage, setErrorMessage, refreshBackups],
  );

  return { backupItems, refreshBackups, restoreBackupAction, deleteBackupAction };
}
