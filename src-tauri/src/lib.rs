use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

const APP_DIR_NAME: &str = ".ai-config-manager";
const SOURCE_DIR_NAME: &str = "source";
const BACKUPS_DIR_NAME: &str = "backups";
const EXPORTS_DIR_NAME: &str = "exports";
const MAPPING_FILE_NAME: &str = "mapping.json";
const CATEGORY_NAMES: [&str; 5] = ["instructions", "skills", "plugins", "commands", "mcp"];
const LEGACY_PROMPTS_CATEGORY: &str = "prompts";

#[derive(Debug, Serialize)]
struct ScopeInfo {
    name: String,
    path: String,
}

#[derive(Debug, Serialize)]
struct WorkspaceInfo {
    app_root: String,
    source_root: String,
    mapping_path: String,
    categories: Vec<String>,
    scopes: Vec<ScopeInfo>,
}

#[derive(Debug, Serialize)]
struct ScopeFiles {
    scope: String,
    base_path: String,
    files: Vec<String>,
}

#[derive(Debug, Serialize)]
struct FileContent {
    scope: String,
    relative_path: String,
    absolute_path: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CategoryMapping {
    codex: String,
    gemini: String,
    claude: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct MappingConfig {
    version: u32,
    categories: BTreeMap<String, CategoryMapping>,
}

#[derive(Debug, Serialize, Clone)]
struct SyncItem {
    id: String,
    agent: String,
    category: String,
    source_file: String,
    target_relative_path: String,
    target_absolute_path: String,
    status: String,
    before: String,
    after: String,
}

#[derive(Debug, Serialize)]
struct SyncPreview {
    generated_at: u128,
    items: Vec<SyncItem>,
}

#[derive(Debug, Serialize)]
struct ApplySyncResult {
    backup_id: Option<String>,
    applied_count: usize,
    files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BackupEntry {
    agent: String,
    target_relative_path: String,
    target_absolute_path: String,
    existed_before: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct BackupManifest {
    backup_id: String,
    created_at: u128,
    trigger: String,
    entries: Vec<BackupEntry>,
}

#[derive(Debug, Serialize)]
struct BackupInfo {
    backup_id: String,
    created_at: u128,
    trigger: String,
    entry_count: usize,
}

#[derive(Debug, Serialize)]
struct RestoreResult {
    restored_count: usize,
}

#[derive(Debug, Serialize)]
struct ExportResult {
    path: String,
    files: usize,
    sanitized: bool,
}

#[derive(Debug, Serialize)]
struct ImportFilePreview {
    relative_path: String,
    status: String,
}

#[derive(Debug, Serialize)]
struct ImportPreview {
    zip_path: String,
    files: Vec<ImportFilePreview>,
    has_mapping: bool,
}

#[derive(Debug, Serialize)]
struct ImportResult {
    backup_id: Option<String>,
    applied_count: usize,
    skipped_count: usize,
}

#[derive(Debug, Serialize)]
struct ShareManifest {
    version: u32,
    created_at: u128,
    sanitized: bool,
    files: Vec<String>,
}

#[derive(Debug, Serialize)]
struct AgentEndpoint {
    agent: String,
    kind: String,
    path: String,
    exists: bool,
}

fn now_millis() -> Result<u128, String> {
    Ok(SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis())
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "Unable to resolve HOME directory".to_string())
}

fn app_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(APP_DIR_NAME))
}

fn source_root() -> Result<PathBuf, String> {
    Ok(app_root()?.join(SOURCE_DIR_NAME))
}

fn backups_root() -> Result<PathBuf, String> {
    Ok(app_root()?.join(BACKUPS_DIR_NAME))
}

fn exports_root() -> Result<PathBuf, String> {
    Ok(app_root()?.join(EXPORTS_DIR_NAME))
}

fn mapping_path() -> Result<PathBuf, String> {
    Ok(app_root()?.join(MAPPING_FILE_NAME))
}

fn default_mapping() -> MappingConfig {
    let mut categories = BTreeMap::new();
    for category in CATEGORY_NAMES {
        categories.insert(category.to_string(), default_category_mapping(category));
    }

    MappingConfig {
        version: 1,
        categories,
    }
}

fn default_category_mapping(category: &str) -> CategoryMapping {
    match category {
        "instructions" => CategoryMapping {
            codex: "AGENTS.md".to_string(),
            gemini: "GEMINI.md".to_string(),
            claude: "CLAUDE.md".to_string(),
        },
        "skills" => CategoryMapping {
            codex: "skills".to_string(),
            gemini: "skills".to_string(),
            claude: "skills".to_string(),
        },
        "plugins" => CategoryMapping {
            codex: "plugins".to_string(),
            gemini: "plugins".to_string(),
            claude: "plugins".to_string(),
        },
        "commands" => CategoryMapping {
            codex: "rules".to_string(),
            gemini: "commands".to_string(),
            claude: "commands".to_string(),
        },
        "mcp" => CategoryMapping {
            codex: "mcp.json".to_string(),
            gemini: "antigravity/mcp_config.json".to_string(),
            claude: "mcp.json".to_string(),
        },
        _ => CategoryMapping {
            codex: category.to_string(),
            gemini: category.to_string(),
            claude: category.to_string(),
        },
    }
}

fn normalize_mapping(mut mapping: MappingConfig) -> (MappingConfig, bool) {
    let mut changed = false;

    if !mapping.categories.contains_key("instructions") {
        if let Some(legacy_prompts) = mapping.categories.remove(LEGACY_PROMPTS_CATEGORY) {
            mapping
                .categories
                .insert("instructions".to_string(), legacy_prompts);
            changed = true;
        }
    }

    for category in CATEGORY_NAMES {
        if !mapping.categories.contains_key(category) {
            mapping
                .categories
                .insert(category.to_string(), default_category_mapping(category));
            changed = true;
        }
    }

    if let Some(instructions) = mapping.categories.get_mut("instructions") {
        let mut local_changed = false;
        if instructions.codex == "prompts" {
            instructions.codex = "AGENTS.md".to_string();
            local_changed = true;
        }
        if instructions.gemini == "prompts" {
            instructions.gemini = "GEMINI.md".to_string();
            local_changed = true;
        }
        if instructions.claude == "prompts" {
            instructions.claude = "CLAUDE.md".to_string();
            local_changed = true;
        }
        if local_changed {
            changed = true;
        }
    }

    if let Some(commands) = mapping.categories.get_mut("commands") {
        if commands.codex == "commands" && commands.gemini == "commands" && commands.claude == "commands" {
            *commands = default_category_mapping("commands");
            changed = true;
        }
    }

    if let Some(mcp) = mapping.categories.get_mut("mcp") {
        if mcp.codex == "mcp" && mcp.gemini == "mcp" && mcp.claude == "mcp" {
            *mcp = default_category_mapping("mcp");
            changed = true;
        }
    }

    (mapping, changed)
}

fn looks_like_file_mapping_path(path: &str) -> bool {
    if path.is_empty() {
        return false;
    }
    Path::new(path).extension().is_some()
}

fn validate_subdir_path(path: &str) -> Result<(), String> {
    if path.is_empty() {
        return Ok(());
    }
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(format!("Path must be relative: {path}"));
    }

    for component in candidate.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err(format!("Path contains invalid components: {path}")),
        }
    }

    Ok(())
}

fn validate_mapping(mapping: &MappingConfig) -> Result<(), String> {
    if mapping.version == 0 {
        return Err("Mapping version must be greater than 0".to_string());
    }

    for (category, target) in &mapping.categories {
        if category.trim().is_empty() {
            return Err("Category name cannot be empty".to_string());
        }
        validate_subdir_path(&target.codex)?;
        validate_subdir_path(&target.gemini)?;
        validate_subdir_path(&target.claude)?;
    }

    Ok(())
}

fn save_mapping_inner(mapping: &MappingConfig) -> Result<(), String> {
    let (normalized, _) = normalize_mapping(mapping.clone());
    validate_mapping(&normalized)?;
    let path = mapping_path()?;
    let payload = serde_json::to_string_pretty(&normalized).map_err(|e| e.to_string())?;
    write_atomic_bytes(&path, payload.as_bytes())
}

fn load_mapping() -> Result<MappingConfig, String> {
    ensure_workspace_layout()?;
    let path = mapping_path()?;
    if !path.exists() {
        let mapping = default_mapping();
        save_mapping_inner(&mapping)?;
        return Ok(mapping);
    }

    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    match serde_json::from_str::<MappingConfig>(&raw) {
        Ok(mapping) => {
            let (normalized, changed) = normalize_mapping(mapping);
            validate_mapping(&normalized)?;
            if changed {
                save_mapping_inner(&normalized)?;
            }
            Ok(normalized)
        }
        Err(_) => {
            let mapping = default_mapping();
            save_mapping_inner(&mapping)?;
            Ok(mapping)
        }
    }
}

fn resolve_scope_base(scope: &str) -> Result<PathBuf, String> {
    match scope {
        "source" => source_root(),
        "codex" => Ok(home_dir()?.join(".codex")),
        "gemini" => Ok(home_dir()?.join(".gemini")),
        "claude" => Ok(home_dir()?.join(".claude")),
        _ => Err(format!("Unsupported scope: {scope}")),
    }
}

fn resolve_agent_root(agent: &str) -> Result<PathBuf, String> {
    match agent {
        "codex" | "gemini" | "claude" => resolve_scope_base(agent),
        _ => Err(format!("Unsupported agent: {agent}")),
    }
}

fn ensure_workspace_layout() -> Result<(), String> {
    let app = app_root()?;
    let source = source_root()?;
    let backups = backups_root()?;
    let exports = exports_root()?;
    fs::create_dir_all(&app).map_err(|e| e.to_string())?;
    fs::create_dir_all(&source).map_err(|e| e.to_string())?;
    fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    fs::create_dir_all(&exports).map_err(|e| e.to_string())?;

    let legacy_prompts = source.join(LEGACY_PROMPTS_CATEGORY);
    let instructions = source.join("instructions");
    if legacy_prompts.exists() && !instructions.exists() {
        fs::rename(&legacy_prompts, &instructions).map_err(|e| e.to_string())?;
    }

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

fn ensure_scope_dir(scope: &str) -> Result<PathBuf, String> {
    let path = resolve_scope_base(scope)?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn normalize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let path = Path::new(relative_path);
    if path.is_absolute() {
        return Err("relative_path must not be absolute".to_string());
    }

    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            _ => return Err("relative_path contains invalid components".to_string()),
        }
    }

    if normalized.as_os_str().is_empty() {
        return Err("relative_path cannot be empty".to_string());
    }

    Ok(normalized)
}

fn to_slash_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn list_files_recursive(base: &Path) -> Result<Vec<String>, String> {
    if !base.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(base)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
    {
        let relative = entry
            .path()
            .strip_prefix(base)
            .map_err(|e| e.to_string())?;
        files.push(to_slash_path(relative));
    }

    files.sort();
    Ok(files)
}

fn write_atomic_bytes(path: &Path, data: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("Missing parent directory for path: {}", path.display()))?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;

    let stamp = now_millis()?;
    let file_name = path
        .file_name()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| "unnamed".to_string());
    let tmp = parent.join(format!(".{file_name}.tmp.{stamp}"));

    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
}

fn read_text(path: &Path) -> Result<String, String> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(text),
        Err(_) => {
            let bytes = fs::read(path).map_err(|e| e.to_string())?;
            Ok(String::from_utf8_lossy(&bytes).to_string())
        }
    }
}

fn build_sync_items(mapping: &MappingConfig) -> Result<Vec<SyncItem>, String> {
    let src_root = source_root()?;
    let mut items = Vec::new();
    let mut planned_targets = HashSet::new();

    for (category, target_mapping) in &mapping.categories {
        let category_root = src_root.join(category);
        if !category_root.exists() {
            continue;
        }

        let source_files = list_files_recursive(&category_root)?;
        for relative_under_category in source_files {
            let source_abs = category_root.join(&relative_under_category);
            let after = read_text(&source_abs)?;

            let source_file = format!("{category}/{relative_under_category}");
            let targets = [
                ("codex", target_mapping.codex.as_str()),
                ("gemini", target_mapping.gemini.as_str()),
                ("claude", target_mapping.claude.as_str()),
            ];

            for (agent, subdir) in targets {
                let agent_root = resolve_agent_root(agent)?;
                let target_rel = if subdir.is_empty() {
                    PathBuf::from(&relative_under_category)
                } else if looks_like_file_mapping_path(subdir) {
                    PathBuf::from(subdir)
                } else {
                    Path::new(subdir).join(&relative_under_category)
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
                let before = if target_abs.exists() {
                    read_text(&target_abs)?
                } else {
                    String::new()
                };

                let status = if !target_abs.exists() {
                    "create"
                } else if before == after {
                    "unchanged"
                } else {
                    "update"
                }
                .to_string();

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
                    after: after.clone(),
                });
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

fn load_backup_manifest(backup_id: &str) -> Result<(PathBuf, BackupManifest), String> {
    let backup_dir = backups_root()?.join(backup_id);
    let manifest_path = backup_dir.join("manifest.json");
    let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
    let manifest = serde_json::from_str::<BackupManifest>(&raw).map_err(|e| e.to_string())?;
    Ok((backup_dir, manifest))
}

fn is_sensitive_key_name(key: &str) -> bool {
    let lowered = key.to_ascii_lowercase();
    lowered.contains("api_key")
        || lowered.contains("apikey")
        || lowered.contains("token")
        || lowered.contains("secret")
        || lowered.contains("password")
        || lowered.contains("private_key")
}

fn sanitize_content(content: &str) -> String {
    let mut out = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        let maybe_delim = if trimmed.contains('=') {
            Some('=')
        } else if trimmed.contains(':') {
            Some(':')
        } else {
            None
        };

        if let Some(delim) = maybe_delim {
            let mut parts = line.splitn(2, delim);
            let left = parts.next().unwrap_or_default();
            let right = parts.next().unwrap_or_default();
            if is_sensitive_key_name(left.trim()) {
                out.push_str(left);
                out.push(delim);
                if !right.starts_with(' ') {
                    out.push(' ');
                }
                out.push_str("***");
                out.push('\n');
                continue;
            }
        }

        out.push_str(line);
        out.push('\n');
    }

    if !content.ends_with('\n') && out.ends_with('\n') {
        out.pop();
    }

    out
}

fn endpoint_for(agent: &str, kind: &str, relative_path: &str) -> Result<AgentEndpoint, String> {
    let root = resolve_scope_base(agent)?;
    let absolute = root.join(relative_path);
    Ok(AgentEndpoint {
        agent: agent.to_string(),
        kind: kind.to_string(),
        path: absolute.display().to_string(),
        exists: absolute.exists(),
    })
}

#[tauri::command]
fn get_agent_endpoints() -> Result<Vec<AgentEndpoint>, String> {
    ensure_workspace_layout()?;
    let mut endpoints = Vec::new();

    let known_paths = [
        ("codex", "instructions", "AGENTS.md"),
        ("codex", "settings", "config.toml"),
        ("codex", "skills", "skills"),
        ("codex", "commands", "rules"),
        ("gemini", "instructions", "GEMINI.md"),
        ("gemini", "settings", "settings.json"),
        ("gemini", "skills", "skills"),
        ("gemini", "skills", "antigravity/skills"),
        ("gemini", "skills", "antigravity/global_skills"),
        ("gemini", "mcp", "antigravity/mcp_config.json"),
        ("claude", "instructions", "CLAUDE.md"),
        ("claude", "settings", "settings.json"),
        ("claude", "settings", "settings.local.json"),
        ("claude", "skills", "skills"),
        ("claude", "commands", "commands"),
        ("claude", "plugins", "plugins"),
    ];

    for (agent, kind, relative_path) in known_paths {
        endpoints.push(endpoint_for(agent, kind, relative_path)?);
    }

    Ok(endpoints)
}

#[tauri::command]
fn init_workspace() -> Result<WorkspaceInfo, String> {
    ensure_workspace_layout()?;

    let source = source_root()?;
    let mapping = mapping_path()?;
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
        mapping_path: mapping.display().to_string(),
        categories: CATEGORY_NAMES.iter().map(|v| v.to_string()).collect(),
        scopes,
    })
}

#[tauri::command]
fn get_mapping() -> Result<MappingConfig, String> {
    load_mapping()
}

#[tauri::command]
fn save_mapping(mapping: MappingConfig) -> Result<(), String> {
    ensure_workspace_layout()?;
    save_mapping_inner(&mapping)
}

#[tauri::command]
fn list_scope_files(scope: String) -> Result<ScopeFiles, String> {
    ensure_workspace_layout()?;
    let base = ensure_scope_dir(&scope)?;
    let files = list_files_recursive(&base)?;

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
fn delete_scope_file(scope: String, relative_path: String) -> Result<(), String> {
    ensure_workspace_layout()?;
    let base = ensure_scope_dir(&scope)?;
    let normalized = normalize_relative_path(&relative_path)?;
    let target = base.join(&normalized);

    if target.exists() {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn preview_sync() -> Result<SyncPreview, String> {
    ensure_workspace_layout()?;
    let mapping = load_mapping()?;
    let items = build_sync_items(&mapping)?;
    Ok(SyncPreview {
        generated_at: now_millis()?,
        items,
    })
}

#[tauri::command]
fn apply_sync(selected_ids: Vec<String>) -> Result<ApplySyncResult, String> {
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

#[tauri::command]
fn list_backups() -> Result<Vec<BackupInfo>, String> {
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
        let manifest = serde_json::from_str::<BackupManifest>(&raw).map_err(|e| e.to_string())?;

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

#[tauri::command]
fn restore_backup(backup_id: String) -> Result<RestoreResult, String> {
    ensure_workspace_layout()?;
    let (backup_dir, manifest) = load_backup_manifest(&backup_id)?;
    let mut restored = 0;

    for entry in &manifest.entries {
        let target = PathBuf::from(&entry.target_absolute_path);
        if entry.existed_before {
            let backup_file = backup_dir
                .join(&entry.agent)
                .join(Path::new(&entry.target_relative_path));
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

#[tauri::command]
fn export_share_package(sanitize: bool) -> Result<ExportResult, String> {
    ensure_workspace_layout()?;

    let export_file = exports_root()?.join(format!("share-{}.zip", now_millis()?));
    let writer = fs::File::create(&export_file).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(writer);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut written_files = Vec::new();

    let source = source_root()?;
    for entry in WalkDir::new(&source)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().is_file())
    {
        let relative = entry
            .path()
            .strip_prefix(&source)
            .map_err(|e| e.to_string())?;
        let relative_str = to_slash_path(relative);
        let zip_name = format!("source/{relative_str}");

        let bytes = fs::read(entry.path()).map_err(|e| e.to_string())?;
        let payload = if sanitize {
            String::from_utf8(bytes)
                .map(|v| sanitize_content(&v).into_bytes())
                .unwrap_or_else(|v| v.into_bytes())
        } else {
            bytes
        };

        zip.start_file(zip_name, options.clone())
            .map_err(|e| e.to_string())?;
        zip.write_all(&payload).map_err(|e| e.to_string())?;
        written_files.push(relative_str);
    }

    let mapping = fs::read(mapping_path()?).map_err(|e| e.to_string())?;
    zip.start_file("mapping.json", options.clone())
        .map_err(|e| e.to_string())?;
    zip.write_all(&mapping).map_err(|e| e.to_string())?;

    let manifest = ShareManifest {
        version: 1,
        created_at: now_millis()?,
        sanitized: sanitize,
        files: written_files.clone(),
    };
    let manifest_text = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    zip.start_file("manifest.json", options)
        .map_err(|e| e.to_string())?;
    zip.write_all(manifest_text.as_bytes())
        .map_err(|e| e.to_string())?;

    zip.finish().map_err(|e| e.to_string())?;

    Ok(ExportResult {
        path: export_file.display().to_string(),
        files: written_files.len(),
        sanitized: sanitize,
    })
}

#[tauri::command]
fn preview_import_package(zip_path: String) -> Result<ImportPreview, String> {
    ensure_workspace_layout()?;

    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let source = source_root()?;
    let mut files = Vec::new();
    let mut has_mapping = false;

    for idx in 0..archive.len() {
        let entry = archive.by_index(idx).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name.ends_with('/') {
            continue;
        }

        if let Some(relative) = name.strip_prefix("source/") {
            let normalized = normalize_relative_path(relative)?;
            let target = source.join(&normalized);
            let status = if target.exists() { "overwrite" } else { "create" };
            files.push(ImportFilePreview {
                relative_path: to_slash_path(&normalized),
                status: status.to_string(),
            });
        } else if name == "mapping.json" {
            has_mapping = true;
        }
    }

    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    Ok(ImportPreview {
        zip_path,
        files,
        has_mapping,
    })
}

#[tauri::command]
fn apply_import_package(zip_path: String, overwrite: bool) -> Result<ImportResult, String> {
    ensure_workspace_layout()?;

    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut source_entries: Vec<(PathBuf, Vec<u8>)> = Vec::new();
    let mut mapping_entry: Option<Vec<u8>> = None;

    for idx in 0..archive.len() {
        let mut entry = archive.by_index(idx).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name.ends_with('/') {
            continue;
        }

        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes).map_err(|e| e.to_string())?;

        if let Some(relative) = name.strip_prefix("source/") {
            let normalized = normalize_relative_path(relative)?;
            source_entries.push((normalized, bytes));
        } else if name == "mapping.json" {
            mapping_entry = Some(bytes);
        }
    }

    source_entries.sort_by(|a, b| to_slash_path(&a.0).cmp(&to_slash_path(&b.0)));

    let source = source_root()?;
    let mapping_file = mapping_path()?;

    let backup_id = now_millis()?.to_string();
    let backup_dir = backups_root()?.join(&backup_id);
    fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    let mut applied = 0usize;
    let mut skipped = 0usize;

    for (relative, payload) in source_entries {
        let target = source.join(&relative);
        if target.exists() && !overwrite {
            skipped += 1;
            continue;
        }

        let existed_before = target.exists();
        if existed_before {
            let backup_file = backup_dir.join("source").join(&relative);
            let original = fs::read(&target).map_err(|e| e.to_string())?;
            write_atomic_bytes(&backup_file, &original)?;
        }

        entries.push(BackupEntry {
            agent: "source".to_string(),
            target_relative_path: to_slash_path(&relative),
            target_absolute_path: target.display().to_string(),
            existed_before,
        });

        write_atomic_bytes(&target, &payload)?;
        applied += 1;
    }

    if let Some(mapping_bytes) = mapping_entry {
        if mapping_file.exists() {
            let backup_file = backup_dir.join("workspace").join("mapping.json");
            let original = fs::read(&mapping_file).map_err(|e| e.to_string())?;
            write_atomic_bytes(&backup_file, &original)?;
            entries.push(BackupEntry {
                agent: "workspace".to_string(),
                target_relative_path: "mapping.json".to_string(),
                target_absolute_path: mapping_file.display().to_string(),
                existed_before: true,
            });
        } else {
            entries.push(BackupEntry {
                agent: "workspace".to_string(),
                target_relative_path: "mapping.json".to_string(),
                target_absolute_path: mapping_file.display().to_string(),
                existed_before: false,
            });
        }

        write_atomic_bytes(&mapping_file, &mapping_bytes)?;
        applied += 1;
    }

    let backup_ref = if entries.is_empty() {
        fs::remove_dir_all(&backup_dir).ok();
        None
    } else {
        let manifest = BackupManifest {
            backup_id: backup_id.clone(),
            created_at: now_millis()?,
            trigger: "import".to_string(),
            entries,
        };

        let payload = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
        write_atomic_bytes(&backup_dir.join("manifest.json"), payload.as_bytes())?;
        Some(backup_id)
    };

    Ok(ImportResult {
        backup_id: backup_ref,
        applied_count: applied,
        skipped_count: skipped,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            init_workspace,
            get_agent_endpoints,
            get_mapping,
            save_mapping,
            list_scope_files,
            read_scope_file,
            save_scope_file,
            delete_scope_file,
            preview_sync,
            apply_sync,
            list_backups,
            restore_backup,
            export_share_package,
            preview_import_package,
            apply_import_package,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
