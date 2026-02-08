use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Component, Path};

use crate::files::write_atomic_bytes;
use crate::paths::{mapping_path, source_root};

pub const CATEGORY_NAMES: [&str; 5] = ["instructions", "skills", "plugins", "commands", "mcp"];
pub const LEGACY_PROMPTS_CATEGORY: &str = "prompts";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "lowercase")]
pub enum SyncMode {
    #[default]
    Replace,
    Append,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CategoryMapping {
    pub codex: String,
    pub gemini: String,
    pub claude: String,
    #[serde(default)]
    pub sync_mode: SyncMode,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MappingConfig {
    pub version: u32,
    pub categories: BTreeMap<String, CategoryMapping>,
}

pub fn default_mapping() -> MappingConfig {
    let mut categories = BTreeMap::new();
    for category in CATEGORY_NAMES {
        categories.insert(category.to_string(), default_category_mapping(category));
    }
    MappingConfig {
        version: 1,
        categories,
    }
}

pub fn default_category_mapping(category: &str) -> CategoryMapping {
    match category {
        "instructions" => CategoryMapping {
            codex: "AGENTS.md".to_string(),
            gemini: "GEMINI.md".to_string(),
            claude: "CLAUDE.md".to_string(),
            sync_mode: SyncMode::Replace,
        },
        "skills" => CategoryMapping {
            codex: "skills".to_string(),
            gemini: "skills".to_string(),
            claude: "skills".to_string(),
            sync_mode: SyncMode::Replace,
        },
        "plugins" => CategoryMapping {
            codex: "plugins".to_string(),
            gemini: "plugins".to_string(),
            claude: "plugins".to_string(),
            sync_mode: SyncMode::Replace,
        },
        "commands" => CategoryMapping {
            codex: "rules".to_string(),
            gemini: "commands".to_string(),
            claude: "commands".to_string(),
            sync_mode: SyncMode::Replace,
        },
        "mcp" => CategoryMapping {
            codex: "mcp.json".to_string(),
            gemini: "antigravity/mcp_config.json".to_string(),
            claude: "mcp.json".to_string(),
            sync_mode: SyncMode::Replace,
        },
        _ => CategoryMapping {
            codex: category.to_string(),
            gemini: category.to_string(),
            claude: category.to_string(),
            sync_mode: SyncMode::Replace,
        },
    }
}

pub fn normalize_mapping(mut mapping: MappingConfig) -> (MappingConfig, bool) {
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
        if commands.codex == "commands"
            && commands.gemini == "commands"
            && commands.claude == "commands"
        {
            let saved_mode = commands.sync_mode.clone();
            *commands = default_category_mapping("commands");
            commands.sync_mode = saved_mode;
            changed = true;
        }
    }

    if let Some(mcp) = mapping.categories.get_mut("mcp") {
        if mcp.codex == "mcp" && mcp.gemini == "mcp" && mcp.claude == "mcp" {
            let saved_mode = mcp.sync_mode.clone();
            *mcp = default_category_mapping("mcp");
            mcp.sync_mode = saved_mode;
            changed = true;
        }
    }

    (mapping, changed)
}

pub fn looks_like_file_mapping_path(path: &str) -> bool {
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

pub fn save_mapping_inner(mapping: &MappingConfig) -> Result<(), String> {
    let (normalized, _) = normalize_mapping(mapping.clone());
    validate_mapping(&normalized)?;
    let path = mapping_path()?;
    let payload = serde_json::to_string_pretty(&normalized).map_err(|e| e.to_string())?;
    write_atomic_bytes(&path, payload.as_bytes())
}

pub fn load_mapping() -> Result<MappingConfig, String> {
    use crate::workspace::ensure_workspace_layout;

    ensure_workspace_layout()?;
    let path = mapping_path()?;
    if !path.exists() {
        let mapping = default_mapping();
        save_mapping_inner(&mapping)?;
        return Ok(mapping);
    }

    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
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

/// When source directory is empty (first launch), bootstrap by reading
/// the core prompt files from the three agent CLIs.
pub fn bootstrap_source_from_agents(mapping: &MappingConfig) -> Result<bool, String> {
    let src_root = source_root()?;

    let existing = crate::files::list_files_recursive(&src_root)?;
    if !existing.is_empty() {
        return Ok(false);
    }

    let instructions = match mapping.categories.get("instructions") {
        Some(m) => m,
        None => return Ok(false),
    };

    let category_dir = src_root.join("instructions");
    std::fs::create_dir_all(&category_dir).map_err(|e| e.to_string())?;

    let agents: [(&str, &str); 3] = [
        ("claude", &instructions.claude),
        ("codex", &instructions.codex),
        ("gemini", &instructions.gemini),
    ];

    let mut bootstrapped = false;
    for (agent, mapped_path) in &agents {
        let agent_root = crate::paths::resolve_agent_root(agent)?;
        let target_file = agent_root.join(mapped_path);
        if !target_file.exists() {
            continue;
        }
        let content = crate::files::read_text(&target_file)?;
        if content.trim().is_empty() {
            continue;
        }
        let source_name = format!("{agent}.md");
        write_atomic_bytes(&category_dir.join(&source_name), content.as_bytes())?;
        bootstrapped = true;
    }

    Ok(bootstrapped)
}
