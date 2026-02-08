use std::env;
use std::path::PathBuf;

pub const APP_DIR_NAME: &str = ".ai-config-manager";
pub const SOURCE_DIR_NAME: &str = "source";
pub const BACKUPS_DIR_NAME: &str = "backups";
pub const MAPPING_FILE_NAME: &str = "mapping.json";

pub fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or_else(|| "Unable to resolve HOME directory".to_string())
}

pub fn app_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(APP_DIR_NAME))
}

pub fn source_root() -> Result<PathBuf, String> {
    Ok(app_root()?.join(SOURCE_DIR_NAME))
}

pub fn backups_root() -> Result<PathBuf, String> {
    Ok(app_root()?.join(BACKUPS_DIR_NAME))
}

pub fn mapping_path() -> Result<PathBuf, String> {
    Ok(app_root()?.join(MAPPING_FILE_NAME))
}

pub fn resolve_scope_base(scope: &str) -> Result<PathBuf, String> {
    match scope {
        "source" => source_root(),
        "codex" => Ok(home_dir()?.join(".codex")),
        "gemini" => Ok(home_dir()?.join(".gemini")),
        "claude" => Ok(home_dir()?.join(".claude")),
        _ => Err(format!("Unsupported scope: {scope}")),
    }
}

pub fn resolve_agent_root(agent: &str) -> Result<PathBuf, String> {
    match agent {
        "codex" | "gemini" | "claude" => resolve_scope_base(agent),
        _ => Err(format!("Unsupported agent: {agent}")),
    }
}
