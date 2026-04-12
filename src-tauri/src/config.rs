use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// ── Top-level config ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct AppConfig {
    pub github: GitHubConfig,
    pub ssh: SshConfig,
    pub memory: MemoryConfig,
    pub theme: ThemeConfig,
    #[serde(default)]
    pub profiles: Vec<AgentProfile>,
    /// Default working directory for new sessions (falls back to home dir if empty)
    pub default_cwd: String,
    /// False on first launch; set true after onboarding wizard completes
    #[serde(default)]
    pub onboarded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProfile {
    pub id: String,
    pub name: String,
    pub provider_id: String,
    pub model: Option<String>,
    pub allow_all_tools: bool,
    pub default_cwd: Option<String>,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ThemeConfig {
    pub preset: String,
    pub custom: std::collections::HashMap<String, String>,
}

impl Default for ThemeConfig {
    fn default() -> Self {
        ThemeConfig { preset: "starbase".into(), custom: Default::default() }
    }
}

// ── GitHub ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct GitHubConfig {
    /// Personal access token (repo, read:user scopes).
    /// Leave empty to rely on the `gh` CLI being authenticated instead.
    pub token: String,
    pub enabled: bool,
}

// ── SSH ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct SshConfig {
    pub connections: Vec<SshConnection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_type: SshAuthType,
    /// Path to private key file; only used when auth_type == Key
    pub key_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SshAuthType {
    Agent,
    Key,
    Password,
}

// ── Memory ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct MemoryConfig {
    pub enabled: bool,
    pub entries: Vec<MemoryEntry>,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        MemoryConfig { enabled: false, entries: vec![] }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub name: String,
    pub provider: MemoryProviderType,
    /// For CLI providers: path to the binary (e.g. "mempalace")
    pub cli_path: String,
    /// Args before the query, e.g. ["search"]
    pub cli_search_args: Vec<String>,
    /// For McpServer providers: full URL to the MCP endpoint
    pub mcp_url: String,
    /// Inject retrieved memory as a prefix to the initial prompt
    pub inject_into_prompt: bool,
    /// Starbase CLI provider IDs this entry applies to.
    /// Empty vec = default fallback for any provider not matched by another entry.
    pub assigned_cli_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum MemoryProviderType {
    /// mempalace CLI — default
    #[default]
    Mempalace,
    /// Any other CLI binary following the same interface
    CustomCli,
    /// MCP-compatible HTTP server
    McpServer,
}

// ── Persistence ───────────────────────────────────────────────────────────────

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf> {
    use tauri::Manager;
    let dir = app
        .path()
        .app_data_dir()
        .context("could not resolve app data dir")?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("config.json"))
}

pub fn load(app: &tauri::AppHandle) -> AppConfig {
    config_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(app: &tauri::AppHandle, config: &AppConfig) -> Result<()> {
    let path = config_path(app)?;
    let json = serde_json::to_string_pretty(config)?;
    std::fs::write(path, json)?;
    Ok(())
}
