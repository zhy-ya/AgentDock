import { useState, useCallback } from "react";
import { listBackups, restoreBackup, deleteBackup } from "@/api";
import type { BackupInfo, RestoreResult } from "@/types";

interface UseBackupsOptions {
  onRestored?: (backupId: string, result: RestoreResult) => Promise<void> | void;
}

export function useBackups(
  setStatusMessage: (msg: string) => void,
  setErrorMessage: (msg: string) => void,
  options: UseBackupsOptions = {},
) {
  const [backupItems, setBackupItems] = useState<BackupInfo[]>([]);
  const { onRestored } = options;

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
      try {
        const r = await restoreBackup(id);
        setStatusMessage(
          r.restored_count === 0 ? "恢复完成，当前内容与目标备份一致" : `恢复完成，${r.restored_count} 个文件`,
        );
        await refreshBackups();
        if (onRestored) {
          await onRestored(id, r);
        }
      } catch (e) {
        setErrorMessage(String(e));
      }
    },
    [setStatusMessage, setErrorMessage, refreshBackups, onRestored],
  );

  const deleteBackupAction = useCallback(
    async (id: string) => {
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
