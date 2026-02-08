import { useState, useMemo, useCallback } from "react";
import { previewSync, applySync, listBackups } from "@/api";
import type { SyncItem, SyncPreview } from "@/types";

export function useSyncPreview(
  setStatusMessage: (msg: string) => void,
  setErrorMessage: (msg: string) => void,
  refreshFiles: () => Promise<string[]>,
  setBackupItems: (items: Awaited<ReturnType<typeof listBackups>>) => void,
) {
  const [syncPreviewData, setSyncPreviewData] = useState<SyncPreview | null>(
    null,
  );
  const [selectedSyncIds, setSelectedSyncIds] = useState<string[]>([]);
  const [focusedSyncId, setFocusedSyncId] = useState("");

  const changedSyncItems = useMemo(() => {
    if (!syncPreviewData) return [];
    return syncPreviewData.items.filter((i) => i.status !== "unchanged");
  }, [syncPreviewData]);

  const focusedSyncItem = useMemo<SyncItem | null>(() => {
    if (!syncPreviewData || !focusedSyncId) return null;
    return syncPreviewData.items.find((i) => i.id === focusedSyncId) ?? null;
  }, [syncPreviewData, focusedSyncId]);

  const loadPreview = useCallback(async () => {
    try {
      const d = await previewSync();
      setSyncPreviewData(d);
      const ids = d.items
        .filter((i) => i.status !== "unchanged")
        .map((i) => i.id);
      setSelectedSyncIds(ids);
      setFocusedSyncId(ids[0] ?? "");
      setStatusMessage(`预览完成，共 ${d.items.length} 个端点`);
    } catch (e) {
      setErrorMessage(String(e));
    }
  }, [setStatusMessage, setErrorMessage]);

  const toggleItem = useCallback((id: string) => {
    setSelectedSyncIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const applySyncAction = useCallback(async () => {
    try {
      const r = await applySync(selectedSyncIds);
      setStatusMessage(
        `同步完成，${r.applied_count} 个文件${r.backup_id ? `（备份 ${r.backup_id}）` : ""}`,
      );
      // Refresh preview and backups
      const [, backups] = await Promise.all([
        loadPreview(),
        listBackups(),
      ]);
      setBackupItems(backups);
      await refreshFiles();
    } catch (e) {
      setErrorMessage(String(e));
    }
  }, [
    selectedSyncIds,
    setStatusMessage,
    setErrorMessage,
    loadPreview,
    setBackupItems,
    refreshFiles,
  ]);

  return {
    syncPreviewData,
    selectedSyncIds,
    focusedSyncId,
    setFocusedSyncId,
    changedSyncItems,
    focusedSyncItem,
    loadPreview,
    toggleItem,
    applySyncAction,
  };
}
