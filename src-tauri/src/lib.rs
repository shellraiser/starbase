mod commands;
mod config;
mod integrations;
mod session;

use commands::*;
use session::SessionManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(SessionManager::new())
        .invoke_handler(tauri::generate_handler![
            // Sessions
            create_session,
            send_input,
            resize_terminal,
            kill_session,
            list_sessions,
            get_home_dir,
            check_cli,
            // Config
            load_config,
            save_config,
            // Workspace
            save_workspace,
            load_workspace,
            // GitHub
            github_fetch_issues,
            github_check_auth,
            // Memory
            memory_search,
            // SSH
            ssh_test_connection,
            // History
            append_history,
            load_history,
            clear_history,
            // Git worktree
            detect_git_repo,
            create_worktree,
            remove_worktree,
            // Skills
            discover_skills,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
