use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::process::Command;

// ── GitHub ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubIssue {
    pub number: u64,
    pub title: String,
    pub body: Option<String>,
    pub state: String,
    pub url: String,
    pub repo: String,
    pub labels: Vec<String>,
    pub assignees: Vec<String>,
}

/// Fetch open issues/PRs using the `gh` CLI. Falls back to the REST API
/// if `token` is supplied and `gh` is not available.
pub async fn github_list_issues(
    token: &str,
    repo: Option<&str>,
) -> Result<Vec<GitHubIssue>> {
    // Prefer `gh` CLI when available
    if which::which("gh").is_ok() {
        return github_issues_via_gh(repo).await;
    }
    if !token.is_empty() {
        return github_issues_via_api(token, repo).await;
    }
    anyhow::bail!("GitHub: install `gh` CLI or provide a Personal Access Token")
}

async fn github_issues_via_gh(repo: Option<&str>) -> Result<Vec<GitHubIssue>> {
    let mut args = vec!["issue", "list", "--json",
        "number,title,body,state,url,labels,assignees", "--limit", "50"];
    let repo_flag;
    if let Some(r) = repo {
        repo_flag = format!("--repo={}", r);
        args.push(&repo_flag);
    }

    let out = Command::new("gh").args(&args).output()?;
    if !out.status.success() {
        anyhow::bail!("{}", String::from_utf8_lossy(&out.stderr));
    }

    #[derive(Deserialize)]
    struct GhIssue {
        number: u64,
        title: String,
        body: Option<String>,
        state: Option<String>,
        url: String,
        labels: Vec<GhLabel>,
        assignees: Vec<GhUser>,
    }
    #[derive(Deserialize)]
    struct GhLabel { name: String }
    #[derive(Deserialize)]
    struct GhUser { login: String }

    let raw: Vec<GhIssue> = serde_json::from_slice(&out.stdout)?;
    let repo_name = repo.unwrap_or("").to_string();
    Ok(raw.into_iter().map(|i| GitHubIssue {
        number: i.number,
        title: i.title,
        body: i.body,
        state: i.state.unwrap_or_else(|| "open".into()),
        url: i.url,
        repo: repo_name.clone(),
        labels: i.labels.into_iter().map(|l| l.name).collect(),
        assignees: i.assignees.into_iter().map(|a| a.login).collect(),
    }).collect())
}

async fn github_issues_via_api(token: &str, repo: Option<&str>) -> Result<Vec<GitHubIssue>> {
    let client = reqwest::Client::new();
    let url = if let Some(r) = repo {
        format!("https://api.github.com/repos/{}/issues?state=open&per_page=50", r)
    } else {
        "https://api.github.com/issues?filter=assigned&state=open&per_page=50".into()
    };

    #[derive(Deserialize)]
    struct ApiIssue {
        number: u64,
        title: String,
        body: Option<String>,
        state: String,
        html_url: String,
        labels: Vec<ApiLabel>,
        assignees: Vec<ApiUser>,
    }
    #[derive(Deserialize)]
    struct ApiLabel { name: String }
    #[derive(Deserialize)]
    struct ApiUser { login: String }

    let resp: Vec<ApiIssue> = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Starbase/0.1")
        .send().await?
        .error_for_status()?
        .json().await?;

    let repo_name = repo.unwrap_or("").to_string();
    Ok(resp.into_iter().map(|i| GitHubIssue {
        number: i.number,
        title: i.title,
        body: i.body,
        state: i.state,
        url: i.html_url,
        repo: repo_name.clone(),
        labels: i.labels.into_iter().map(|l| l.name).collect(),
        assignees: i.assignees.into_iter().map(|a| a.login).collect(),
    }).collect())
}

// ── Memory ─────────────────────────────────────────────────────────────────

/// Run a CLI memory search and return the captured stdout.
pub fn memory_search_cli(cli: &str, args: &[String], query: &str) -> Result<String> {
    let mut cmd = Command::new(cli);
    for arg in args { cmd.arg(arg); }
    cmd.arg(query);

    let out = cmd.output()?;
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

/// Query an MCP-compatible memory server's search endpoint.
pub async fn memory_search_mcp(mcp_url: &str, query: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(mcp_url)
        .json(&serde_json::json!({
            "tool": "search",
            "arguments": { "query": query }
        }))
        .send().await?
        .error_for_status()?
        .text().await?;
    Ok(resp)
}

// ── SSH test ───────────────────────────────────────────────────────────────

/// Quick round-trip test: `ssh -o ConnectTimeout=5 ... true`.
pub fn test_ssh_connection(
    host: &str,
    port: u16,
    username: &str,
    key_path: Option<&str>,
) -> Result<String> {
    let mut cmd = Command::new("ssh");
    cmd.args(["-o", "ConnectTimeout=8", "-o", "StrictHostKeyChecking=accept-new",
              "-o", "BatchMode=yes",
              "-p", &port.to_string()]);
    if let Some(key) = key_path {
        cmd.args(["-i", key]);
    }
    cmd.arg(format!("{}@{}", username, host));
    cmd.arg("echo starbase-ok");

    let out = cmd.output()?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().into())
    } else {
        anyhow::bail!("{}", String::from_utf8_lossy(&out.stderr).trim())
    }
}
