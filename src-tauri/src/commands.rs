use crate::config::{self, AppConfig, MemoryProviderType, MemoryEntry};
use serde::{Deserialize, Serialize};
use crate::integrations::GitHubIssue;
use crate::session::{SessionInfo, SessionManager, SessionStatus};
use tauri::State;
use uuid::Uuid;

// ── Session ────────────────────────────────────────────────────────────────

/// Pre-create the `~/.claude/projects/<encoded-path>/` directory so Claude Code
/// skips the "Do you trust this folder?" dialog.  The encoding Claude uses is
/// the absolute path with every '/' replaced by '-'.
fn ensure_claude_project_dir(cwd: &str) {
    let home = match std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
        Ok(h) => h,
        Err(_) => return,
    };
    let encoded = cwd.replace('/', "-");
    let project_dir = std::path::PathBuf::from(home)
        .join(".claude")
        .join("projects")
        .join(encoded);
    let _ = std::fs::create_dir_all(project_dir);
}

#[tauri::command]
pub async fn create_session(
    app: tauri::AppHandle,
    manager: State<'_, SessionManager>,
    name: String,
    provider_id: String,
    cli: String,
    cli_args: Vec<String>,
    section: String,
    cwd: String,
    allow_all_tools: bool,
    keystroke_prompt: Option<String>,
) -> Result<String, String> {
    // Claude Code stores workspace trust in ~/.claude/projects/<encoded-cwd>/.
    // Pre-creating that directory prevents the "Do you trust this folder?" prompt
    // from appearing every time a session is relaunched.
    if provider_id == "claude" {
        ensure_claude_project_dir(&cwd);
    }

    let id = Uuid::new_v4().to_string();
    let info = SessionInfo {
        id: id.clone(),
        name,
        provider_id,
        section,
        cwd,
        allow_all_tools,
        status: SessionStatus::Running,
        rows: 24,
        cols: 100,
    };
    manager
        .create_session(app, info, cli, cli_args, keystroke_prompt.filter(|s| !s.is_empty()))
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub async fn send_input(
    manager: State<'_, SessionManager>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    manager.send_input(&session_id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn resize_terminal(
    manager: State<'_, SessionManager>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    manager.resize(&session_id, rows, cols).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn kill_session(
    manager: State<'_, SessionManager>,
    session_id: String,
) -> Result<(), String> {
    manager.kill_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_sessions(
    manager: State<'_, SessionManager>,
) -> Result<Vec<SessionInfo>, String> {
    Ok(manager.list_sessions())
}

#[tauri::command]
pub async fn get_home_dir() -> Result<String, String> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_cli(cli: String) -> bool {
    which::which(&cli).is_ok()
}

// ── Config ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn load_config(app: tauri::AppHandle) -> AppConfig {
    config::load(&app)
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    config::save(&app, &config).map_err(|e| e.to_string())
}

// ── Workspace persistence ───────────────────────────────────────────────────

fn workspace_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("workspace.json"))
}

#[tauri::command]
pub fn save_workspace(app: tauri::AppHandle, data: serde_json::Value) -> Result<(), String> {
    let path = workspace_path(&app)?;
    let json = serde_json::to_string_pretty(&data).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_workspace(app: tauri::AppHandle) -> serde_json::Value {
    workspace_path(&app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(serde_json::Value::Null)
}

// ── GitHub ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn github_fetch_issues(
    token: String,
    repo: Option<String>,
) -> Result<Vec<GitHubIssue>, String> {
    crate::integrations::github_list_issues(&token, repo.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn github_check_auth() -> bool {
    if let Ok(out) = std::process::Command::new("gh").args(["auth", "status"]).output() {
        out.status.success()
    } else {
        false
    }
}

// ── Memory ─────────────────────────────────────────────────────────────────

/// Find the best memory entry for a given CLI provider ID.
/// Prefers an explicit assignment; falls back to entries with no assignment (default).
fn resolve_memory_entry<'a>(entries: &'a [MemoryEntry], provider_id: &str) -> Option<&'a MemoryEntry> {
    entries.iter()
        .find(|e| e.assigned_cli_ids.iter().any(|id| id == provider_id))
        .or_else(|| entries.iter().find(|e| e.assigned_cli_ids.is_empty()))
}

#[tauri::command]
pub async fn memory_search(
    app: tauri::AppHandle,
    query: String,
    provider_id: String,
) -> Result<String, String> {
    let cfg = config::load(&app).memory;
    if !cfg.enabled || cfg.entries.is_empty() {
        return Ok(String::new());
    }
    let entry = match resolve_memory_entry(&cfg.entries, &provider_id) {
        Some(e) => e.clone(),
        None => return Ok(String::new()),
    };
    match entry.provider {
        MemoryProviderType::Mempalace | MemoryProviderType::CustomCli => {
            crate::integrations::memory_search_cli(&entry.cli_path, &entry.cli_search_args, &query)
                .map_err(|e| e.to_string())
        }
        MemoryProviderType::McpServer if !entry.mcp_url.is_empty() => {
            crate::integrations::memory_search_mcp(&entry.mcp_url, &query)
                .await
                .map_err(|e| e.to_string())
        }
        _ => Ok(String::new()),
    }
}

// ── SSH ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn ssh_test_connection(
    host: String,
    port: u16,
    username: String,
    key_path: Option<String>,
) -> Result<String, String> {
    crate::integrations::test_ssh_connection(&host, port, &username, key_path.as_deref())
        .map_err(|e| e.to_string())
}

// ── Session history ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub name: String,
    pub provider_id: String,
    pub model: Option<String>,
    pub cwd: String,
    pub allow_all_tools: bool,
    pub section_name: Option<String>,
    pub ended_at: String,
    pub final_status: String,
}

fn history_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("history.json"))
}

#[tauri::command]
pub fn append_history(app: tauri::AppHandle, entry: HistoryEntry) -> Result<(), String> {
    let path = history_path(&app)?;
    let mut entries: Vec<HistoryEntry> = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    entries.push(entry);
    if entries.len() > 200 {
        entries.drain(0..entries.len() - 200);
    }
    let json = serde_json::to_string_pretty(&entries).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_history(app: tauri::AppHandle) -> Vec<HistoryEntry> {
    history_path(&app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
pub fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    let path = history_path(&app)?;
    std::fs::write(path, "[]").map_err(|e| e.to_string())
}

// ── Git worktree ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRepoInfo {
    pub root: String,
    pub branch: String,
}

#[tauri::command]
pub async fn detect_git_repo(cwd: String) -> Option<GitRepoInfo> {
    let root_out = std::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(&cwd)
        .output()
        .ok()?;
    if !root_out.status.success() { return None; }
    let root = String::from_utf8_lossy(&root_out.stdout).trim().to_string();

    let branch_out = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&root)
        .output()
        .ok();
    let branch = branch_out
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_else(|| "main".to_string());

    Some(GitRepoInfo { root, branch })
}

#[tauri::command]
pub async fn create_worktree(repo_root: String, branch_name: String) -> Result<String, String> {
    let safe_branch = branch_name.replace(['/', '\\', ' '], "-");
    let worktree_path = format!("{}-wt-{}", repo_root.trim_end_matches('/'), safe_branch);
    let out = std::process::Command::new("git")
        .args(["worktree", "add", &worktree_path, "-b", &safe_branch])
        .current_dir(&repo_root)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(worktree_path)
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

#[tauri::command]
pub async fn remove_worktree(repo_root: String, worktree_path: String) -> Result<(), String> {
    let out = std::process::Command::new("git")
        .args(["worktree", "remove", "--force", &worktree_path])
        .current_dir(&repo_root)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).trim().to_string())
    }
}

// ── Skills discovery ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    pub path: String,
    pub scope: String,
}

#[tauri::command]
pub async fn discover_skills(cwd: String) -> Vec<SkillInfo> {
    let mut skills: std::collections::HashMap<String, SkillInfo> = std::collections::HashMap::new();

    if let Ok(home) = std::env::var("HOME") {
        for dir in &[".kiro/skills", ".claude/skills"] {
            scan_skills_dir(
                &std::path::PathBuf::from(&home).join(dir),
                "global",
                &mut skills,
            );
        }
    }

    let workspace = std::path::PathBuf::from(&cwd);
    for dir in &[".kiro/skills", ".claude/skills"] {
        scan_skills_dir(&workspace.join(dir), "workspace", &mut skills);
    }

    let mut result: Vec<SkillInfo> = skills.into_values().collect();
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

fn scan_skills_dir(
    dir: &std::path::Path,
    scope: &str,
    skills: &mut std::collections::HashMap<String, SkillInfo>,
) {
    let Ok(entries) = std::fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") { continue; }
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        if let Some(skill) = parse_skill_frontmatter(&content, &path.to_string_lossy(), scope) {
            skills.insert(skill.name.clone(), skill);
        }
    }
}

fn parse_skill_frontmatter(content: &str, path: &str, scope: &str) -> Option<SkillInfo> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") { return None; }
    let rest = &trimmed[3..];
    let end = rest.find("\n---")?;
    let frontmatter = &rest[..end];

    let mut name: Option<String> = None;
    let mut description: Option<String> = None;
    for line in frontmatter.lines() {
        if let Some(v) = line.strip_prefix("name:") {
            name = Some(v.trim().trim_matches('"').to_string());
        }
        if let Some(v) = line.strip_prefix("description:") {
            description = Some(v.trim().trim_matches('"').to_string());
        }
    }

    Some(SkillInfo {
        name: name.unwrap_or_else(|| {
            std::path::Path::new(path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Unknown")
                .to_string()
        }),
        description: description.unwrap_or_default(),
        path: path.to_string(),
        scope: scope.to_string(),
    })
}
