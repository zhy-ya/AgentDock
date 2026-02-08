export type ScopeName = "source" | "codex" | "gemini" | "claude";

export interface ScopeInfo {
  name: ScopeName;
  path: string;
}

export interface WorkspaceInfo {
  app_root: string;
  source_root: string;
  mapping_path: string;
  categories: string[];
  scopes: ScopeInfo[];
}

export interface AgentEndpoint {
  agent: ScopeName;
  kind: string;
  path: string;
  exists: boolean;
}

export interface ScopeFiles {
  scope: ScopeName;
  base_path: string;
  files: string[];
}

export interface FileContent {
  scope: ScopeName;
  relative_path: string;
  absolute_path: string;
  content: string;
}

export interface CategoryMapping {
  codex: string;
  gemini: string;
  claude: string;
}

export interface MappingConfig {
  version: number;
  categories: Record<string, CategoryMapping>;
}

export interface SyncItem {
  id: string;
  agent: ScopeName;
  category: string;
  source_file: string;
  target_relative_path: string;
  target_absolute_path: string;
  status: "create" | "update" | "unchanged";
  before: string;
  after: string;
}

export interface SyncPreview {
  generated_at: number;
  items: SyncItem[];
}

export interface ApplySyncResult {
  backup_id: string | null;
  applied_count: number;
  files: string[];
}

export interface BackupInfo {
  backup_id: string;
  created_at: number;
  trigger: string;
  entry_count: number;
}

export interface RestoreResult {
  restored_count: number;
}

export interface ExportResult {
  path: string;
  files: number;
  sanitized: boolean;
}

export interface ImportFilePreview {
  relative_path: string;
  status: "create" | "overwrite";
}

export interface ImportPreview {
  zip_path: string;
  files: ImportFilePreview[];
  has_mapping: boolean;
}

export interface ImportResult {
  backup_id: string | null;
  applied_count: number;
  skipped_count: number;
}
