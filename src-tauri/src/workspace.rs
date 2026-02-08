use std::fs;

use crate::files::list_files_recursive;
use crate::mapping::{
    bootstrap_source_from_agents, default_mapping, load_mapping, save_mapping_inner, CATEGORY_NAMES,
};
use crate::paths::{app_root, backups_root, mapping_path, resolve_scope_base, source_root};
use crate::types::{ScopeInfo, WorkspaceInfo};

pub fn ensure_workspace_layout() -> Result<(), String> {
    let app = app_root()?;
    let source = source_root()?;
    let backups = backups_root()?;
    fs::create_dir_all(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(&source).map_err(|e| e.to_string())?;
    fs::create_dir_all(&backups).map_err(|e| e.to_string())?;

    for category in CATEGORY_NAMES {
        fs::create_dir_all(source.join(category)).map_err(|e| e.to_string())?;
    }

    let mapping = mapping_path()?;
    if !mapping.exists() {
        let default = default_mapping();
        save_mapping_inner(&default)?;
    }

    Ok(())
}

pub fn ensure_scope_dir(scope: &str) -> Result<std::path::PathBuf, String> {
    let path = resolve_scope_base(scope)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn init_workspace_inner() -> Result<WorkspaceInfo, String> {
    ensure_workspace_layout()?;

    let mapping = load_mapping()?;
    bootstrap_source_from_agents(&mapping)?;

    // Check if source was bootstrapped and has files
    let source = source_root()?;
    let _files = list_files_recursive(&source)?;
    let mapping_p = mapping_path()?;

    let scopes = vec![
        ScopeInfo {
            name: "source".to_string(),
            path: source.display().to_string(),
        },
        ScopeInfo {
            name: "codex".to_string(),
            path: resolve_scope_base("codex")?.display().to_string(),
        },
        ScopeInfo {
            name: "gemini".to_string(),
            path: resolve_scope_base("gemini")?.display().to_string(),
        },
        ScopeInfo {
            name: "claude".to_string(),
            path: resolve_scope_base("claude")?.display().to_string(),
        },
    ];

    Ok(WorkspaceInfo {
        app_root: app_root()?.display().to_string(),
        source_root: source.display().to_string(),
        mapping_path: mapping_p.display().to_string(),
        categories: CATEGORY_NAMES.iter().map(|v| v.to_string()).collect(),
        scopes,
    })
}
