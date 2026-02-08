mod backup;
mod files;
mod mapping;
mod paths;
mod sync;
mod types;
mod workspace;

use files::{normalize_relative_path, read_text, to_slash_path, write_atomic_bytes};
use types::*;
use workspace::{ensure_scope_dir, ensure_workspace_layout};

#[tauri::command]
fn init_workspace() -> Result<WorkspaceInfo, String> {
    workspace::init_workspace_inner()
}

#[tauri::command]
fn list_scope_files(scope: String) -> Result<ScopeFiles, String> {
    ensure_workspace_layout()?;
    let base = ensure_scope_dir(&scope)?;
    let files = files::list_files_recursive(&base)?;
    Ok(ScopeFiles {
        scope,
        base_path: base.display().to_string(),
        files,
    })
}

#[tauri::command]
fn read_scope_file(scope: String, relative_path: String) -> Result<FileContent, String> {
    ensure_workspace_layout()?;
    let base = ensure_scope_dir(&scope)?;
    let normalized = normalize_relative_path(&relative_path)?;
    let target = base.join(&normalized);
    if !target.exists() {
        return Err(format!("File does not exist: {}", target.display()));
    }
    let content = read_text(&target)?;
    Ok(FileContent {
        scope,
        relative_path: to_slash_path(&normalized),
        absolute_path: target.display().to_string(),
        content,
    })
}

#[tauri::command]
fn save_scope_file(scope: String, relative_path: String, content: String) -> Result<(), String> {
    ensure_workspace_layout()?;
    let base = ensure_scope_dir(&scope)?;
    let normalized = normalize_relative_path(&relative_path)?;
    let target = base.join(&normalized);
    write_atomic_bytes(&target, content.as_bytes())
}

#[tauri::command]
fn preview_sync() -> Result<SyncPreview, String> {
    sync::preview_sync_inner()
}

#[tauri::command]
fn apply_sync(
    selected_ids: Vec<String>,
    source_prompt_snapshots: Option<Vec<SourcePromptSnapshot>>,
) -> Result<ApplySyncResult, String> {
    sync::apply_sync_inner(selected_ids, source_prompt_snapshots)
}

#[tauri::command]
fn list_backups() -> Result<Vec<BackupInfo>, String> {
    backup::list_backups_inner()
}

#[tauri::command]
fn restore_backup(backup_id: String) -> Result<RestoreResult, String> {
    backup::restore_backup_inner(backup_id)
}

#[tauri::command]
fn delete_backup(backup_id: String) -> Result<(), String> {
    backup::delete_backup_inner(backup_id)
}

#[tauri::command]
fn get_backup_detail(backup_id: String) -> Result<BackupDetail, String> {
    backup::get_backup_detail_inner(backup_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            init_workspace,
            list_scope_files,
            read_scope_file,
            save_scope_file,
            preview_sync,
            apply_sync,
            list_backups,
            restore_backup,
            delete_backup,
            get_backup_detail,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
