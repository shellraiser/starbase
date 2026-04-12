export type SessionStatus = 'running' | 'paused' | 'exited' | 'failed' | 'cancelled';

export interface Provider {
  id: string;
  name: string;
  cli: string;
  /** Flag that grants all tool permissions without prompting */
  autoApproveFlag?: string;
  /** Flag used to pass an initial prompt on the CLI */
  initialPromptFlag?: string;
  /** For agents that need the prompt typed in rather than passed as a flag */
  useKeystrokeInjection?: boolean;
  /** Resume a previous session */
  resumeFlag?: string;
  /** Flag placed before the model name, e.g. "--model" */
  modelFlag?: string;
  /** Available models for this provider */
  models?: { id: string; name: string }[];
  installCommand?: string;
  docUrl?: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    cli: 'claude',
    autoApproveFlag: '--dangerously-skip-permissions',
    resumeFlag: '--continue',
    modelFlag: '--model',
    models: [
      { id: 'claude-opus-4-6',           name: 'Opus 4.6' },
      { id: 'claude-sonnet-4-6',         name: 'Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
    ],
    installCommand: 'curl -fsSL https://claude.ai/install.sh | bash',
    docUrl: 'https://docs.anthropic.com/claude/docs/claude-code',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    cli: 'gemini',
    autoApproveFlag: '--yolo',
    initialPromptFlag: '-i',
    resumeFlag: '--resume',
    modelFlag: '--model',
    models: [
      { id: 'gemini-2.5-pro',   name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro',   name: 'Gemini 1.5 Pro' },
    ],
    installCommand: 'npm install -g @google/gemini-cli',
    docUrl: 'https://github.com/google-gemini/gemini-cli',
  },
  {
    id: 'codex',
    name: 'Codex (OpenAI)',
    cli: 'codex',
    autoApproveFlag: '--full-auto',
    resumeFlag: 'resume --last',
    modelFlag: '--model',
    models: [
      { id: 'o3',      name: 'o3' },
      { id: 'o4-mini', name: 'o4-mini' },
      { id: 'gpt-4o',  name: 'GPT-4o' },
    ],
    installCommand: 'npm install -g @openai/codex',
    docUrl: 'https://github.com/openai/codex',
  },
  {
    id: 'amp',
    name: 'Amp',
    cli: 'amp',
    autoApproveFlag: '--dangerously-allow-all',
    useKeystrokeInjection: true,
    installCommand: 'npm install -g @sourcegraph/amp@latest',
    docUrl: 'https://ampcode.com/manual#install',
  },
  {
    id: 'qwen',
    name: 'Qwen Code',
    cli: 'qwen',
    autoApproveFlag: '--yolo',
    initialPromptFlag: '-i',
    resumeFlag: '--continue',
    installCommand: 'npm install -g @qwen-code/qwen-code',
    docUrl: 'https://github.com/QwenLM/qwen-code',
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    cli: 'cursor-agent',
    autoApproveFlag: '-f',
    installCommand: 'curl https://cursor.com/install -fsS | bash',
    docUrl: 'https://cursor.sh',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    cli: 'copilot',
    autoApproveFlag: '--allow-all-tools',
    initialPromptFlag: '-i',
    installCommand: 'npm install -g @github/copilot',
    docUrl: 'https://docs.github.com/en/copilot',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    cli: 'opencode',
    useKeystrokeInjection: true,
    installCommand: 'npm install -g opencode-ai',
    docUrl: 'https://opencode.ai/docs/cli/',
  },
  {
    id: 'cline',
    name: 'Cline',
    cli: 'cline',
    autoApproveFlag: '--yolo',
    installCommand: 'npm install -g cline',
    docUrl: 'https://docs.cline.bot/cline-cli/overview',
  },
  {
    id: 'forge',
    name: 'Forge',
    cli: 'forge',
    initialPromptFlag: '-p',
    resumeFlag: '--conversation-id',
    installCommand: 'curl -fsSL https://forgecode.dev/cli | sh',
    docUrl: 'https://forgecode.dev/docs/',
  },
  {
    id: 'continue',
    name: 'Continue',
    cli: 'cn',
    initialPromptFlag: '-p',
    resumeFlag: '--resume',
    installCommand: 'npm i -g @continuedev/cli',
    docUrl: 'https://docs.continue.dev/guides/cli',
  },
  {
    id: 'hermes',
    name: 'Hermes Agent',
    cli: 'hermes',
    useKeystrokeInjection: true,
    resumeFlag: '--continue',
    installCommand: 'curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash',
    docUrl: 'https://hermes-agent.nousresearch.com/docs/',
  },
  {
    id: 'mistral',
    name: 'Mistral Vibe',
    cli: 'vibe',
    autoApproveFlag: '--auto-approve',
    initialPromptFlag: '--prompt',
    modelFlag: '--model',
    models: [
      { id: 'mistral-large-latest',  name: 'Mistral Large' },
      { id: 'codestral-latest',      name: 'Codestral' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium' },
    ],
    installCommand: 'curl -LsSf https://mistral.ai/vibe/install.sh | bash',
    docUrl: 'https://github.com/mistralai/mistral-vibe',
  },
  {
    id: 'codebuff',
    name: 'Codebuff',
    cli: 'codebuff',
    installCommand: 'npm install -g codebuff',
    docUrl: 'https://www.codebuff.com/docs/help/quick-start',
  },
  {
    id: 'kiro',
    name: 'Kiro (AWS)',
    cli: 'kiro-cli',
    installCommand: 'curl -fsSL https://cli.kiro.dev/install | bash',
    docUrl: 'https://kiro.dev/docs/cli/',
  },
  {
    id: 'goose',
    name: 'Goose',
    cli: 'goose',
    installCommand: 'curl -fsSL https://github.com/block/goose/releases/latest/download/install.sh | bash',
    docUrl: 'https://block.github.io/goose/',
  },
  {
    id: 'autohand',
    name: 'Autohand Code',
    cli: 'autohand',
    autoApproveFlag: '--unrestricted',
    initialPromptFlag: '-p',
    installCommand: 'npm install -g autohand-cli',
    docUrl: 'https://autohand.ai/code/',
  },
  {
    id: 'droid',
    name: 'Droid',
    cli: 'droid',
    resumeFlag: '-r',
    installCommand: 'curl -fsSL https://app.factory.ai/cli | sh',
    docUrl: 'https://docs.factory.ai/cli/getting-started/quickstart',
  },
  {
    id: 'charm',
    name: 'Charm',
    cli: 'charm',
    installCommand: 'brew install charmbracelet/tap/mods',
    docUrl: 'https://charm.sh',
  },
  {
    id: 'pi',
    name: 'Pi',
    cli: 'pi',
    resumeFlag: '-c',
    installCommand: 'npm install -g @mariozechner/pi-coding-agent',
    docUrl: 'https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent',
  },
];

export const PROVIDER_MAP = new Map(PROVIDERS.map((p) => [p.id, p]));

export interface SessionInfo {
  id: string;
  name: string;
  provider_id: string;
  model?: string;
  section: string;
  cwd: string;
  allow_all_tools: boolean;
  status: SessionStatus;
  rows: number;
  cols: number;
  worktree?: { path: string; repo_root: string };
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  sessionName: string;
  kind: 'created' | 'paused' | 'resumed' | 'exited' | 'failed' | 'cancelled' | 'deleted';
  message: string;
}

export interface HistoryEntry {
  id: string;
  name: string;
  provider_id: string;
  model?: string;
  cwd: string;
  allow_all_tools: boolean;
  section_name?: string;
  ended_at: string;
  final_status: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  path: string;
  scope: string;
}

export interface Section {
  id: string;
  name: string;
  collapsed: boolean;
  color: string;
}

export interface CreateSessionParams {
  name: string;
  provider_id: string;
  model?: string;
  section: string;
  cwd: string;
  allow_all_tools: boolean;
  initial_prompt?: string;
  ssh_connection_id?: string;
  worktree_branch?: string;
}

/** Colors used for section headers and accents — rotated through */
export const SECTION_COLORS = [
  '#6B8FBF',  // muted blue
  '#5B9E9E',  // teal
  '#BF8F3A',  // amber
  '#7B6BBF',  // purple
  '#5B9E6B',  // green
  '#BF5B6B',  // rose
  '#9E7B5B',  // warm brown
];
