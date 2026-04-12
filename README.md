<div align="center">
  <img src="src-tauri/icons/icon.png" width="128" height="128" alt="Starbase icon" />

  # Starbase

  **Run multiple AI coding agents at once — from a single, unified control centre.**

  [![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)
  [![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)](#installation)
  [![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8D8)](https://tauri.app)
  [![Latest Release](https://img.shields.io/github/v/release/shellraiser/starbase?color=orange)](https://github.com/shellraiser/starbase/releases/latest)

  [Download](#installation) · [Quick Start](#quick-start) · [Features](#features) · [Providers](#supported-ai-providers)

</div>

---

Starbase is a lightweight, native desktop app that puts every AI coding agent you use under one roof. Spin up sessions with Claude Code, Gemini CLI, Codex, or any of 20+ supported providers — each in its own terminal panel — then switch between them instantly without losing context. Think of it as a mission-control dashboard for AI-assisted development.

Built with [Tauri 2](https://tauri.app) and Rust, Starbase is fast, resource-efficient, and runs natively on macOS, Linux, and Windows.

---

## Installation

Download the latest installer for your platform from the [Releases](https://github.com/shellraiser/starbase/releases/latest) page.

### macOS
| Architecture | Installer |
|---|---|
| Apple Silicon (M1/M2/M3/M4) | `Starbase_x.x.x_aarch64.dmg` |
| Intel | `Starbase_x.x.x_x64.dmg` |

Open the `.dmg`, drag **Starbase** to your Applications folder, and launch it.

> **First launch on macOS:** If macOS blocks the app with "unidentified developer", right-click → Open → Open to bypass Gatekeeper.

### Linux
| Package | Format |
|---|---|
| Debian / Ubuntu | `starbase_x.x.x_amd64.deb` |
| Fedora / RHEL | `starbase-x.x.x-1.x86_64.rpm` |
| Universal | `starbase_x.x.x_amd64.AppImage` |

**Debian/Ubuntu:**
```bash
sudo dpkg -i starbase_x.x.x_amd64.deb
```

**AppImage:**
```bash
chmod +x starbase_x.x.x_amd64.AppImage
./starbase_x.x.x_amd64.AppImage
```

### Windows
Download `Starbase_x.x.x_x64-setup.exe` and run the installer.

---

## Quick Start

1. **Launch Starbase.** On first run, the onboarding wizard walks you through choosing a working directory and creating your first session.
2. **Pick a provider.** Select any of the 20+ supported AI coding agents. If the CLI isn't installed yet, Starbase shows the exact install command.
3. **Start a session.** Give it a name, choose a model (where applicable), and click **Start**. A full terminal opens immediately.
4. **Open more sessions.** Click **New Session** in the sidebar to spin up additional agents in parallel. Each session is completely independent.
5. **Switch between sessions** by clicking their names in the sidebar — terminals preserve their full history and remain live in the background.

---

## Features

### Multi-Agent Session Management

Run as many AI agent sessions as you like simultaneously. Every session gets its own isolated terminal with full PTY support — scrollback, colour output, and interactive prompts all work exactly as they would in your native terminal.

- **Parallel sessions** — switch between agents without killing any of them
- **Persistent terminals** — session output is preserved when you switch away
- **Session status indicators** — at-a-glance running / paused / exited / failed states
- **Kill & dismiss** — two-click kill confirmation prevents accidental termination
- **Clear terminal** — wipe the display without ending the session

### Resume Paused Sessions

Paused sessions (such as Claude Code's `--continue` state) can be resumed with a single click directly from the sidebar. Starbase automatically passes the correct resume flags for each provider and shows a loading indicator while the previous conversation reloads.

### Agent Profiles

Save reusable configurations — provider, model, working directory, colour label, and tool permissions — as named profiles. Apply a profile when creating a new session to skip manual configuration every time.

### Per-Session Provider & Model Switching

Change the AI provider or model for any session on the fly without recreating it. The inline picker lets you switch and apply in two clicks.

### Git Worktree Support

Create isolated Git worktrees directly from the new-session dialog. Starbase calls `git worktree add` automatically, sets the session's working directory to the new worktree path, and cleans up the worktree when the session is dismissed.

### GitHub Integration

Connect a GitHub personal access token to browse issues from any repository without leaving the app. Issues panel shows title, body, labels, assignees, and a direct link — useful for feeding context to your agents.

### SSH Remote Development

Define SSH connections (agent, key-file, or password auth) and launch agent sessions over SSH. Starbase manages the connection lifecycle so your agents run on the remote machine transparently.

### Memory Providers

Inject contextual memory into agent prompts using any of three supported providers:

| Provider | Description |
|---|---|
| **MemPalace** | Local-first vector memory with 96.6% recall on LongMemEval |
| **Custom CLI** | Any CLI tool that accepts a query string and prints to stdout |
| **MCP Server** | Any MCP-compatible HTTP memory server |

Multiple memory entries can be defined and assigned to specific AI providers, or used as a global fallback.

### Command History

Starbase keeps a searchable history of every command you've sent across all sessions. Browse and replay past inputs with the built-in history panel.

### Skills Discovery

The **Info** tab of any session scans the working directory for Claude Code skill files (`.claude/commands/`) and lists them with their names, descriptions, and scope — so you always know which `/skills` are available in context.

### Custom Themes

Five built-in colour schemes, each with a live mini-preview and instant application before you save:

| Theme | Accent | Mood |
|---|---|---|
| **Starbase** (default) | Amber `#FF9900` | Dark space, warm amber |
| **Deep Space** | Cobalt `#2266FF` | Near-absolute black, cold blue |
| **Klingon** | Crimson `#CC1111` | Blood red on near-black |
| **Holodeck** | Gold `#FFD700` | Pure black, vivid TNG grid |
| **Federation** | Steel blue `#4499CC` | Navy, measured and professional |

Click any theme card to preview it immediately across the whole UI. Hit **Save** to make it permanent, or close settings to revert.

Load your own theme by pasting a JSON object of CSS variable overrides, or by importing a `.json` / `.starbase-theme` file. Export your current theme to share with others.

### Settings & Configuration

All settings are persisted to disk via Tauri's config directory. Available panels:

- **General** — default working directory, onboarding reset
- **GitHub** — token management, connection test
- **SSH** — connection profiles with test-connection support
- **Memory** — provider configuration and session assignment
- **Profiles** — reusable agent profile management
- **Theme** — colour scheme picker and custom theme import/export

---

## Supported AI Providers

| Provider | CLI | Models |
|---|---|---|
| [Claude Code](https://claude.ai/code) | `claude` | Opus 4.6, Sonnet 4.6, Haiku 4.5 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `gemini` | 2.5 Pro, 2.0 Flash, 1.5 Pro |
| [Codex (OpenAI)](https://github.com/openai/codex) | `codex` | o3, o4-mini, GPT-4o |
| [Amp](https://ampcode.com) | `amp` | — |
| [Qwen Code](https://github.com/QwenLM/qwen-code) | `qwen` | — |
| [Cursor Agent](https://cursor.com) | `cursor-agent` | — |
| [GitHub Copilot](https://github.com/features/copilot) | `copilot` | — |
| [OpenCode](https://opencode.ai) | `opencode` | — |
| [Cline](https://github.com/cline/cline) | `cline` | — |
| [Forge](https://forgecode.dev) | `forge` | — |
| [Continue](https://continue.dev) | `cn` | — |
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) | `hermes` | — |
| [Mistral Vibe](https://mistral.ai) | `vibe` | Large, Codestral, Medium |
| [Codebuff](https://codebuff.com) | `codebuff` | — |
| [Kiro (AWS)](https://kiro.dev) | `kiro-cli` | — |
| [Goose](https://block.github.io/goose) | `goose` | — |
| [Autohand Code](https://autohand.dev) | `autohand` | — |
| [Droid](https://droid.dev) | `droid` | — |
| [Charm](https://charm.sh) | `charm` | — |
| [Pi](https://pi.ai) | `pi` | — |

If a provider's CLI is not found on `$PATH`, Starbase shows its install command inline so you can get going without leaving the app.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable toolchain)
- Platform build dependencies:
  - **Linux:** `libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`
  - **macOS / Windows:** no additional dependencies

### Steps

```bash
git clone https://github.com/shellraiser/starbase.git
cd starbase
npm install
npm run tauri dev
```

To produce a production build:

```bash
npm run tauri build
```

Installer artifacts are written to `src-tauri/target/release/bundle/`.

---

## Project Structure

```
starbase/
├── src/                        # React + TypeScript frontend
│   ├── components/
│   │   ├── settings/           # Settings panel sections
│   │   ├── FocusView.tsx       # Active session terminal view
│   │   ├── Sidebar.tsx         # Session list & navigation
│   │   ├── TerminalView.tsx    # xterm.js terminal wrapper
│   │   ├── CreateSessionModal.tsx
│   │   ├── EditSessionModal.tsx
│   │   └── HistoryPanel.tsx
│   ├── styles/
│   │   └── lcars.css           # LCARS-inspired design system
│   └── types/
│       ├── index.ts            # Provider definitions & session types
│       └── integrations.ts     # GitHub, SSH, Memory, Theme types
└── src-tauri/                  # Rust backend
    ├── src/
    │   ├── commands.rs         # Tauri command handlers
    │   ├── session.rs          # PTY session lifecycle management
    │   ├── config.rs           # App config persistence
    │   └── integrations.rs     # GitHub & SSH integration
    └── icons/                  # App icons (all sizes)
```

---

## Contributing

Contributions are welcome. Please open an issue to discuss significant changes before submitting a pull request.

```bash
# Fork, clone, then:
npm install
npm run tauri dev
```

---

## License

MIT — see [LICENSE](LICENSE).
