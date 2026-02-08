use std::fs;
use std::path::PathBuf;

use crate::files::{read_text, write_atomic_bytes};
use crate::paths::backups_root;
use crate::types::{BackupDetail, BackupDetailEntry, BackupInfo, BackupManifest, RestoreResult};
use crate::workspace::ensure_workspace_layout;

fn load_backup_manifest(backup_id: &str) -> Result<(PathBuf, BackupManifest), String> {
    let backup_dir = backups_root()?.join(backup_id);
    let manifest_path = backup_dir.join("manifest.json");
    let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
    let manifest =
        serde_json::from_str::<BackupManifest>(&raw).map_err(|e| e.to_string())?;
    Ok((backup_dir, manifest))
}

pub fn list_backups_inner() -> Result<Vec<BackupInfo>, String> {
    ensure_workspace_layout()?;
    let root = backups_root()?;
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let backup_dir = entry.path();
        if !backup_dir.is_dir() {
            continue;
        }

        let manifest_path = backup_dir.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }

        let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
        let manifest =
            serde_json::from_str::<BackupManifest>(&raw).map_err(|e| e.to_string())?;

        items.push(BackupInfo {
            backup_id: manifest.backup_id,
            created_at: manifest.created_at,
            trigger: manifest.trigger,
            entry_count: manifest.entries.len(),
        });
    }

    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(items)
}

pub fn restore_backup_inner(backup_id: String) -> Result<RestoreResult, String> {
    ensure_workspace_layout()?;
    let (backup_dir, manifest) = load_backup_manifest(&backup_id)?;
    let mut restored = 0;

    for entry in &manifest.entries {
        let target = PathBuf::from(&entry.target_absolute_path);
        if entry.existed_before {
            let backup_file = backup_dir
                .join(&entry.agent)
                .join(std::path::Path::new(&entry.target_relative_path));
            if !backup_file.exists() {
                continue;
            }
            let original = fs::read(&backup_file).map_err(|e| e.to_string())?;
            write_atomic_bytes(&target, &original)?;
            restored += 1;
        } else if target.exists() {
            fs::remove_file(&target).map_err(|e| e.to_string())?;
            restored += 1;
        }
    }

    Ok(RestoreResult {
        restored_count: restored,
    })
}

pub fn delete_backup_inner(backup_id: String) -> Result<(), String> {
    ensure_workspace_layout()?;
    let backup_dir = backups_root()?.join(&backup_id);
    if !backup_dir.exists() {
        return Err(format!("Backup not found: {backup_id}"));
    }
    fs::remove_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn get_backup_detail_inner(backup_id: String) -> Result<BackupDetail, String> {
    ensure_workspace_layout()?;
    let (backup_dir, manifest) = load_backup_manifest(&backup_id)?;

    let mut entries = Vec::new();
    for entry in &manifest.entries {
        let backup_file = backup_dir
            .join(&entry.agent)
            .join(std::path::Path::new(&entry.target_relative_path));

        let backup_content = if entry.existed_before && backup_file.exists() {
            Some(read_text(&backup_file)?)
        } else {
            None
        };

        let current_target = PathBuf::from(&entry.target_absolute_path);
        let current_content = if current_target.exists() {
            Some(read_text(&current_target)?)
        } else {
            None
        };

        entries.push(BackupDetailEntry {
            agent: entry.agent.clone(),
            target_relative_path: entry.target_relative_path.clone(),
            existed_before: entry.existed_before,
            backup_content,
            current_content,
        });
    }

    Ok(BackupDetail {
        backup_id: manifest.backup_id,
        created_at: manifest.created_at,
        trigger: manifest.trigger,
        entries,
    })
}
