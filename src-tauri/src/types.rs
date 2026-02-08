use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct ScopeInfo {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceInfo {
    pub app_root: String,
    pub source_root: String,
    pub mapping_path: String,
    pub categories: Vec<String>,
    pub scopes: Vec<ScopeInfo>,
}

#[derive(Debug, Serialize)]
pub struct ScopeFiles {
    pub scope: String,
    pub base_path: String,
    pub files: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct FileContent {
    pub scope: String,
    pub relative_path: String,
    pub absolute_path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct SyncItem {
    pub id: String,
    pub agent: String,
    pub category: String,
    pub source_file: String,
    pub target_relative_path: String,
    pub target_absolute_path: String,
    pub status: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Serialize)]
pub struct SyncPreview {
    pub generated_at: u128,
    pub items: Vec<SyncItem>,
}

#[derive(Debug, Serialize)]
pub struct ApplySyncResult {
    pub backup_id: Option<String>,
    pub applied_count: usize,
    pub files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupEntry {
    pub agent: String,
    pub target_relative_path: String,
    pub target_absolute_path: String,
    pub existed_before: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupManifest {
    pub backup_id: String,
    pub created_at: u128,
    pub trigger: String,
    pub entries: Vec<BackupEntry>,
}

#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub backup_id: String,
    pub created_at: u128,
    pub trigger: String,
    pub entry_count: usize,
}

#[derive(Debug, Serialize)]
pub struct RestoreResult {
    pub restored_count: usize,
}

#[derive(Debug, Serialize)]
pub struct BackupDetailEntry {
    pub agent: String,
    pub target_relative_path: String,
    pub existed_before: bool,
    pub backup_content: Option<String>,
    pub current_content: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BackupDetail {
    pub backup_id: String,
    pub created_at: u128,
    pub trigger: String,
    pub entries: Vec<BackupDetailEntry>,
}
