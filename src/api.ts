import { invoke } from "@tauri-apps/api/core";
import type {
  AgentEndpoint,
  ApplySyncResult,
  BackupInfo,
  ExportResult,
  FileContent,
  ImportPreview,
  ImportResult,
  MappingConfig,
  RestoreResult,
  ScopeFiles,
  ScopeName,
  SyncPreview,
  WorkspaceInfo,
} from "./types";

export function initWorkspace() {
  return invoke<WorkspaceInfo>("init_workspace");
}

export function getAgentEndpoints() {
  return invoke<AgentEndpoint[]>("get_agent_endpoints");
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

export function deleteScopeFile(scope: ScopeName, relativePath: string) {
  return invoke<void>("delete_scope_file", {
    scope,
    relativePath,
  });
}

export function getMapping() {
  return invoke<MappingConfig>("get_mapping");
}

export function saveMapping(mapping: MappingConfig) {
  return invoke<void>("save_mapping", { mapping });
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

export function exportSharePackage(sanitize: boolean) {
  return invoke<ExportResult>("export_share_package", { sanitize });
}

export function previewImportPackage(zipPath: string) {
  return invoke<ImportPreview>("preview_import_package", { zipPath });
}

export function applyImportPackage(zipPath: string, overwrite: boolean) {
  return invoke<ImportResult>("apply_import_package", {
    zipPath,
    overwrite,
  });
}
