// ── GitHub ────────────────────────────────────────────────────────────────────

export interface GitHubIssue {
  number: number;
  title: string;
  body?: string;
  state: string;
  url: string;
  repo: string;
  labels: string[];
  assignees: string[];
}

// ── SSH ───────────────────────────────────────────────────────────────────────

export type SshAuthType = 'agent' | 'key' | 'password';

export interface SshConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: SshAuthType;
  key_path?: string;
}

// ── Memory ────────────────────────────────────────────────────────────────────

export type MemoryProviderType = 'mempalace' | 'custom_cli' | 'mcp_server';

export interface MemoryEntry {
  id: string;
  name: string;
  provider: MemoryProviderType;
  cli_path: string;
  cli_search_args: string[];
  mcp_url: string;
  inject_into_prompt: boolean;
  /** Starbase CLI provider IDs this entry applies to. Empty = default fallback. */
  assigned_cli_ids: string[];
}

export interface MemoryConfig {
  enabled: boolean;
  entries: MemoryEntry[];
}

/** Find the best entry for a given CLI provider ID (mirrors Rust resolve_memory_entry). */
export function resolveMemoryEntry(entries: MemoryEntry[], providerId: string): MemoryEntry | undefined {
  return entries.find(e => e.assigned_cli_ids.includes(providerId))
    ?? entries.find(e => e.assigned_cli_ids.length === 0);
}

// ── Agent profiles ────────────────────────────────────────────────────────────

export interface AgentProfile {
  id: string;
  name: string;
  provider_id: string;
  model?: string;
  allow_all_tools: boolean;
  default_cwd?: string;
  color?: string;
}

// ── Theme ─────────────────────────────────────────────────────────────────────

export interface ThemeConfig {
  preset: string;
  custom: Record<string, string>;
}

export interface ThemePreset {
  id: string;
  name: string;
  accent: string; // preview swatch color
  vars: Record<string, string>;
}

export const BUILT_IN_THEMES: ThemePreset[] = [
  {
    id: 'starbase',
    name: 'Starbase',
    accent: '#FF9900',
    vars: {}, // CSS defaults — amber on dark space
  },
  {
    // Inky interstellar void — cold cobalt blue, near-absolute-black backgrounds
    id: 'deep-space',
    name: 'Deep Space',
    accent: '#2266FF',
    vars: {
      '--bg-app':       '#02020a',
      '--bg-surface':   '#05050f',
      '--bg-elevated':  '#0a0a1c',
      '--bg-input':     '#040410',
      '--bg-hover':     '#0d0d24',
      '--bg-selected':  '#10102c',
      '--accent':       '#2266FF',
      '--accent-dim':   'rgba(34,102,255,0.28)',
      '--accent-faint': 'rgba(34,102,255,0.07)',
      '--border':       'rgba(34,102,255,0.13)',
      '--border-mid':   'rgba(34,102,255,0.28)',
      '--text':         '#bbc8e8',
      '--text-dim':     'rgba(100,120,180,0.45)',
      '--text-muted':   'rgba(130,155,210,0.65)',
      '--text-bright':  '#dde6f8',
      '--text-accent':  '#4d88ff',
    },
  },
  {
    // Klingon warbird — honour, battle, blood — deep crimson on near-black
    id: 'klingon',
    name: 'Klingon',
    accent: '#CC1111',
    vars: {
      '--bg-app':       '#0b0505',
      '--bg-surface':   '#110707',
      '--bg-elevated':  '#1a0909',
      '--bg-input':     '#0d0606',
      '--bg-hover':     '#200b0b',
      '--bg-selected':  '#280d0d',
      '--accent':       '#CC1111',
      '--accent-dim':   'rgba(204,17,17,0.28)',
      '--accent-faint': 'rgba(204,17,17,0.07)',
      '--border':       'rgba(204,17,17,0.14)',
      '--border-mid':   'rgba(204,17,17,0.30)',
      '--accent-red':   '#dd2222',
      '--text':         '#ddd0c8',
      '--text-dim':     'rgba(170,110,90,0.45)',
      '--text-muted':   'rgba(195,140,115,0.65)',
      '--text-bright':  '#ede8e4',
      '--text-accent':  '#ee2222',
    },
  },
  {
    // TNG holodeck — pure black with vivid gold-yellow grid, terminal aesthetic
    id: 'holodeck',
    name: 'Holodeck',
    accent: '#FFD700',
    vars: {
      '--bg-app':       '#000000',
      '--bg-surface':   '#010101',
      '--bg-elevated':  '#050505',
      '--bg-input':     '#000000',
      '--bg-hover':     '#090909',
      '--bg-selected':  '#0e0e0e',
      '--accent':       '#FFD700',
      '--accent-dim':   'rgba(255,215,0,0.22)',
      '--accent-faint': 'rgba(255,215,0,0.06)',
      '--border':       'rgba(255,215,0,0.15)',
      '--border-mid':   'rgba(255,215,0,0.32)',
      '--text':         '#e8d870',
      '--text-dim':     'rgba(180,155,40,0.45)',
      '--text-muted':   'rgba(210,185,70,0.65)',
      '--text-bright':  '#fff0a0',
      '--text-accent':  '#FFD700',
      '--accent-green': '#88cc44',
      '--accent-red':   '#cc4422',
    },
  },
  {
    // Starfleet bridge — clean Federation blues, measured and professional
    id: 'federation',
    name: 'Federation',
    accent: '#4499CC',
    vars: {
      '--bg-app':       '#060e16',
      '--bg-surface':   '#0a1520',
      '--bg-elevated':  '#101e2e',
      '--bg-input':     '#081018',
      '--bg-hover':     '#142236',
      '--bg-selected':  '#182a40',
      '--accent':       '#4499CC',
      '--accent-dim':   'rgba(68,153,204,0.28)',
      '--accent-faint': 'rgba(68,153,204,0.07)',
      '--border':       'rgba(68,153,204,0.15)',
      '--border-mid':   'rgba(68,153,204,0.32)',
      '--accent-teal':  '#44BBAA',
      '--text':         '#ccdde8',
      '--text-dim':     'rgba(90,130,160,0.45)',
      '--text-muted':   'rgba(120,165,195,0.65)',
      '--text-bright':  '#e4f0f8',
      '--text-accent':  '#66bbee',
    },
  },
];

// All CSS variable names that themes are allowed to override
export const THEME_VAR_KEYS = [
  '--bg-app','--bg-surface','--bg-elevated','--bg-input','--bg-hover','--bg-selected',
  '--accent','--accent-dim','--accent-faint','--accent-blue','--accent-teal',
  '--accent-purple','--accent-green','--accent-red',
  '--border','--border-mid','--border-dim',
  '--text','--text-dim','--text-muted','--text-bright','--text-accent',
];

// ── App config (mirrors Rust AppConfig) ──────────────────────────────────────

export interface GitHubConfig {
  token: string;
  enabled: boolean;
}

export interface SshConfig {
  connections: SshConnection[];
}

export interface AppConfig {
  github: GitHubConfig;
  ssh: SshConfig;
  memory: MemoryConfig;
  theme: ThemeConfig;
  profiles: AgentProfile[];
  default_cwd: string;
  onboarded: boolean;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  github: { token: '', enabled: false },
  ssh: { connections: [] },
  theme: { preset: 'starbase', custom: {} },
  profiles: [],
  default_cwd: '',
  onboarded: false,
  memory: {
    enabled: false,
    entries: [],
  },
};

export const MEMORY_PROVIDERS: { id: MemoryProviderType; name: string; desc: string }[] = [
  {
    id: 'mempalace',
    name: 'MemPalace',
    desc: 'Local-first vector memory — 96.6% recall on LongMemEval. Install via pip.',
  },
  {
    id: 'custom_cli',
    name: 'Custom CLI',
    desc: 'Any CLI tool that accepts a query argument and prints results to stdout.',
  },
  {
    id: 'mcp_server',
    name: 'MCP Server',
    desc: 'Any MCP-compatible HTTP memory server.',
  },
];
