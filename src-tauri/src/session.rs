use anyhow::Result;
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: String,
    pub name: String,
    pub provider_id: String,
    pub section: String,
    pub cwd: String,
    pub allow_all_tools: bool,
    pub status: SessionStatus,
    pub rows: u16,
    pub cols: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Running,
    Paused,
    Exited,
    Failed,
    Cancelled,
    Error, // kept for backward compat
}

pub struct SessionHandle {
    pub info: SessionInfo,
    /// Shared so keystroke-injection threads can also write.
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Box<dyn portable_pty::MasterPty + Send>,
}

pub struct SessionManager {
    sessions: Arc<Mutex<HashMap<String, SessionHandle>>>,
}

impl SessionManager {
    pub fn new() -> Self {
        SessionManager {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Spawn a PTY session running `cli` with `args` in `cwd`.
    /// `keystroke_prompt`: typed into the PTY after 3 s for agents that have no
    /// prompt flag (e.g. amp, opencode, hermes).
    pub fn create_session(
        &self,
        app: AppHandle,
        info: SessionInfo,
        cli: String,
        args: Vec<String>,
        keystroke_prompt: Option<String>,
    ) -> Result<()> {
        let pty_system = native_pty_system();

        let pair = pty_system.openpty(PtySize {
            rows: info.rows,
            cols: info.cols,
            pixel_width: 0,
            pixel_height: 0,
        })?;

        let mut cmd = CommandBuilder::new(&cli);
        for arg in &args {
            cmd.arg(arg);
        }
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");
        cmd.cwd(&info.cwd);

        let _child = pair.slave.spawn_command(cmd)?;
        let raw_writer = pair.master.take_writer()?;
        let writer: Arc<Mutex<Box<dyn Write + Send>>> = Arc::new(Mutex::new(raw_writer));
        let mut reader = pair.master.try_clone_reader()?;

        // Keystroke injection for agents without a prompt flag
        if let Some(prompt) = keystroke_prompt {
            let w = writer.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                if let Ok(mut w) = w.lock() {
                    let _ = w.write_all(prompt.as_bytes());
                    let _ = w.write_all(b"\n");
                    let _ = w.flush();
                }
            });
        }

        // Background reader → Tauri events
        let session_id = info.id.clone();
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) | Err(_) => {
                        let _ = app_clone.emit(
                            &format!("session_exit_{}", session_id),
                            serde_json::json!({ "id": session_id }),
                        );
                        break;
                    }
                    Ok(n) => {
                        let payload = base64_encode(&buf[..n]);
                        let _ = app_clone.emit(
                            &format!("session_output_{}", session_id),
                            serde_json::json!({ "id": session_id, "data": payload }),
                        );
                    }
                }
            }
        });

        let handle = SessionHandle {
            info,
            writer,
            master: pair.master,
        };
        self.sessions.lock().unwrap().insert(handle.info.id.clone(), handle);
        Ok(())
    }

    pub fn send_input(&self, session_id: &str, data: &[u8]) -> Result<()> {
        let sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.get(session_id) {
            let mut w = handle.writer.lock().unwrap();
            w.write_all(data)?;
            w.flush()?;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Session not found: {}", session_id))
        }
    }

    pub fn resize(&self, session_id: &str, rows: u16, cols: u16) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        if let Some(handle) = sessions.get_mut(session_id) {
            handle.master.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })?;
            handle.info.rows = rows;
            handle.info.cols = cols;
            Ok(())
        } else {
            Err(anyhow::anyhow!("Session not found: {}", session_id))
        }
    }

    pub fn kill_session(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        sessions
            .remove(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found: {}", session_id))?;
        Ok(())
    }

    pub fn list_sessions(&self) -> Vec<SessionInfo> {
        self.sessions.lock().unwrap().values().map(|h| h.info.clone()).collect()
    }
}

fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i] as u32;
        let b1 = if i + 1 < data.len() { data[i + 1] as u32 } else { 0 };
        let b2 = if i + 2 < data.len() { data[i + 2] as u32 } else { 0 };
        out.push(CHARS[((b0 >> 2) & 0x3F) as usize] as char);
        out.push(CHARS[(((b0 & 0x3) << 4) | ((b1 >> 4) & 0xF)) as usize] as char);
        out.push(if i + 1 < data.len() { CHARS[(((b1 & 0xF) << 2) | ((b2 >> 6) & 0x3)) as usize] as char } else { '=' });
        out.push(if i + 2 < data.len() { CHARS[(b2 & 0x3F) as usize] as char } else { '=' });
        i += 3;
    }
    out
}
