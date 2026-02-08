use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::files::{
    list_files_recursive, now_millis, read_text, to_slash_path, write_atomic_bytes,
};
use crate::mapping::{looks_like_file_mapping_path, MappingConfig, SyncMode};
use crate::paths::{backups_root, resolve_agent_root, source_root};
use crate::types::{ApplySyncResult, BackupEntry, BackupManifest, SyncItem, SyncPreview};

const AGENT_NAMES: [&str; 3] = ["codex", "gemini", "claude"];

fn is_per_agent_source(source_files: &[String]) -> bool {
    source_files.iter().any(|f| {
        let stem = Path::new(f)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("");
        stem == "base" || AGENT_NAMES.contains(&stem)
    })
}

fn compose_per_agent_content(
    category: &str,
    category_root: &Path,
    agent: &str,
    source_files: &[String],
) -> Result<Option<(String, String)>, String> {
    let base_file = source_files
        .iter()
        .find(|f| Path::new(f).file_stem().and_then(|s| s.to_str()) == Some("base"));
    let agent_file = source_files
        .iter()
        .find(|f| Path::new(f).file_stem().and_then(|s| s.to_str()) == Some(agent));

    let base_content = match base_file {
        Some(f) => read_text(&category_root.join(f))?,
        None => String::new(),
    };
    let agent_content = match agent_file {
        Some(f) => read_text(&category_root.join(f))?,
        None => String::new(),
    };

    let base_empty = base_content.trim().is_empty();
    let agent_empty = agent_content.trim().is_empty();

    if base_empty && agent_empty {
        return Ok(None);
    }

    let composed = if base_empty {
        agent_content
    } else if agent_empty {
        base_content
    } else {
        format!("{}\n\n{}", base_content.trim_end(), agent_content)
    };

    let desc = match (base_file, agent_file) {
        (Some(b), Some(a)) => format!("{category}/{b} + {category}/{a}"),
        (Some(b), None) => format!("{category}/{b}"),
        (None, Some(a)) => format!("{category}/{a}"),
        (None, None) => unreachable!(),
    };

    Ok(Some((composed, desc)))
}

fn apply_sync_mode(
    before: &str,
    after: String,
    sync_mode: &SyncMode,
    target_exists: bool,
) -> (String, String) {
    let after_content = match sync_mode {
        SyncMode::Replace => after,
        SyncMode::Append => {
            if before.is_empty() {
                after
            } else if before.trim_end().ends_with(after.trim()) {
                before.to_string()
            } else {
                format!("{}\n\n{}", before.trim_end(), after)
            }
        }
    };

    let status = if !target_exists {
        "create"
    } else if before == after_content {
        "unchanged"
    } else if matches!(sync_mode, SyncMode::Append) {
        "append"
    } else {
        "update"
    }
    .to_string();

    (after_content, status)
}

pub fn build_sync_items(mapping: &MappingConfig) -> Result<Vec<SyncItem>, String> {
    let src_root = source_root()?;
    let mut items = Vec::new();
    let mut planned_targets = HashSet::new();

    for (category, target_mapping) in &mapping.categories {
        let category_root = src_root.join(category);
        if !category_root.exists() {
            continue;
        }

        let source_files = list_files_recursive(&category_root)?;
        if source_files.is_empty() {
            continue;
        }

        let is_file_mapping = looks_like_file_mapping_path(&target_mapping.codex);
        let per_agent = is_file_mapping && is_per_agent_source(&source_files);

        let targets = [
            ("codex", target_mapping.codex.as_str()),
            ("gemini", target_mapping.gemini.as_str()),
            ("claude", target_mapping.claude.as_str()),
        ];

        if per_agent {
            for (agent, mapped_path) in &targets {
                let composed =
                    compose_per_agent_content(category, &category_root, agent, &source_files)?;
                let (after, source_desc) = match composed {
                    Some(v) => v,
                    None => continue,
                };

                let agent_root = resolve_agent_root(agent)?;
                let target_rel = PathBuf::from(mapped_path);
                let target_rel_str = to_slash_path(&target_rel);
                let target_key = format!("{agent}:{target_rel_str}");
                planned_targets.insert(target_key);

                let target_abs = agent_root.join(&target_rel);
                let target_exists = target_abs.exists();
                let before = if target_exists {
                    read_text(&target_abs)?
                } else {
                    String::new()
                };

                let (after_content, status) =
                    apply_sync_mode(&before, after, &target_mapping.sync_mode, target_exists);

                let id = format!("{agent}:{category}:{target_rel_str}");
                items.push(SyncItem {
                    id,
                    agent: agent.to_string(),
                    category: category.to_string(),
                    source_file: source_desc,
                    target_relative_path: target_rel_str,
                    target_absolute_path: target_abs.display().to_string(),
                    status,
                    before,
                    after: after_content,
                });
            }
        } else {
            for relative_under_category in &source_files {
                let source_abs = category_root.join(relative_under_category);
                let after = read_text(&source_abs)?;
                let source_file = format!("{category}/{relative_under_category}");

                for (agent, subdir) in &targets {
                    let agent_root = resolve_agent_root(agent)?;
                    let target_rel = if subdir.is_empty() {
                        PathBuf::from(relative_under_category)
                    } else if looks_like_file_mapping_path(subdir) {
                        PathBuf::from(subdir)
                    } else {
                        Path::new(subdir).join(relative_under_category)
                    };

                    let target_rel_str = to_slash_path(&target_rel);
                    let target_key = format!("{agent}:{target_rel_str}");
                    if planned_targets.contains(&target_key) {
                        return Err(format!(
                            "Category '{category}' maps multiple source files to the same target: {target_rel_str}"
                        ));
                    }
                    planned_targets.insert(target_key);

                    let target_abs = agent_root.join(&target_rel);
                    let target_exists = target_abs.exists();
                    let before = if target_exists {
                        read_text(&target_abs)?
                    } else {
                        String::new()
                    };

                    let (after_content, status) = apply_sync_mode(
                        &before,
                        after.clone(),
                        &target_mapping.sync_mode,
                        target_exists,
                    );

                    let id = format!("{agent}:{category}:{target_rel_str}");
                    items.push(SyncItem {
                        id,
                        agent: agent.to_string(),
                        category: category.to_string(),
                        source_file: source_file.clone(),
                        target_relative_path: target_rel_str,
                        target_absolute_path: target_abs.display().to_string(),
                        status,
                        before,
                        after: after_content,
                    });
                }
            }
        }
    }

    items.sort_by(|a, b| {
        a.agent
            .cmp(&b.agent)
            .then(a.target_relative_path.cmp(&b.target_relative_path))
    });
    Ok(items)
}

pub fn preview_sync_inner() -> Result<SyncPreview, String> {
    use crate::workspace::ensure_workspace_layout;
    use crate::mapping::load_mapping;

    ensure_workspace_layout()?;
    let mapping = load_mapping()?;
    let items = build_sync_items(&mapping)?;
    Ok(SyncPreview {
        generated_at: now_millis()?,
        items,
    })
}

pub fn apply_sync_inner(selected_ids: Vec<String>) -> Result<ApplySyncResult, String> {
    use crate::workspace::ensure_workspace_layout;
    use crate::mapping::load_mapping;

    ensure_workspace_layout()?;
    let mapping = load_mapping()?;
    let all_items = build_sync_items(&mapping)?;

    let selected: HashSet<String> = selected_ids.into_iter().collect();
    let should_filter = !selected.is_empty();

    let chosen: Vec<SyncItem> = all_items
        .into_iter()
        .filter(|item| item.status != "unchanged")
        .filter(|item| !should_filter || selected.contains(&item.id))
        .collect();

    if chosen.is_empty() {
        return Ok(ApplySyncResult {
            backup_id: None,
            applied_count: 0,
            files: Vec::new(),
        });
    }

    let backup_id = now_millis()?.to_string();
    let backup_dir = backups_root()?.join(&backup_id);
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    let mut applied_files = Vec::new();

    for item in &chosen {
        let target_abs = PathBuf::from(&item.target_absolute_path);
        let existed_before = target_abs.exists();

        if existed_before {
            let backup_file = backup_dir
                .join(&item.agent)
                .join(Path::new(&item.target_relative_path));
            let original = fs::read(&target_abs).map_err(|e| e.to_string())?;
            write_atomic_bytes(&backup_file, &original)?;
        }

        entries.push(BackupEntry {
            agent: item.agent.clone(),
            target_relative_path: item.target_relative_path.clone(),
            target_absolute_path: item.target_absolute_path.clone(),
            existed_before,
        });

        write_atomic_bytes(&target_abs, item.after.as_bytes())?;
        applied_files.push(item.target_absolute_path.clone());
    }

    let manifest = BackupManifest {
        backup_id: backup_id.clone(),
        created_at: now_millis()?,
        trigger: "sync".to_string(),
        entries,
    };
    let payload = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    write_atomic_bytes(&backup_dir.join("manifest.json"), payload.as_bytes())?;

    Ok(ApplySyncResult {
        backup_id: Some(backup_id),
        applied_count: applied_files.len(),
        files: applied_files,
    })
}
