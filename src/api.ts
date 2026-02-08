import { invoke } from "@tauri-apps/api/core";
import type {
  ApplySyncResult,
  BackupDetail,
  BackupInfo,
  FileContent,
  RestoreResult,
  ScopeFiles,
  ScopeName,
  SyncPreview,
  WorkspaceInfo,
} from "./types";

export function initWorkspace() {
  return invoke<WorkspaceInfo>("init_workspace");
}

export function listScopeFiles(scope: ScopeName) {
  return invoke<ScopeFiles>("list_scope_files", { scope });
}

export function readScopeFile(scope: ScopeName, relativePath: string) {
  return invoke<FileContent>("read_scope_file", {
    scope,
    relativePath,
  });
}

export function saveScopeFile(scope: ScopeName, relativePath: string, content: string) {
  return invoke<void>("save_scope_file", {
    scope,
    relativePath,
    content,
  });
}

export function previewSync() {
  return invoke<SyncPreview>("preview_sync");
}

export function applySync(selectedIds: string[]) {
  return invoke<ApplySyncResult>("apply_sync", { selectedIds });
}

export function listBackups() {
  return invoke<BackupInfo[]>("list_backups");
}

export function restoreBackup(backupId: string) {
  return invoke<RestoreResult>("restore_backup", { backupId });
}

export function deleteBackup(backupId: string) {
  return invoke<void>("delete_backup", { backupId });
}

export function getBackupDetail(backupId: string) {
  return invoke<BackupDetail>("get_backup_detail", { backupId });
}
