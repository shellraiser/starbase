import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Section,
  SessionInfo,
  CreateSessionParams,
  PROVIDERS,
  PROVIDER_MAP,
  SECTION_COLORS,
  ActivityEvent,
  HistoryEntry,
} from './types';
import { AppConfig, DEFAULT_APP_CONFIG, GitHubIssue, SshConnection, BUILT_IN_THEMES, THEME_VAR_KEYS, resolveMemoryEntry } from './types/integrations';
import Sidebar from './components/Sidebar';
import FocusView from './components/FocusView';
import SessionCard from './components/SessionCard';
import CreateSessionModal from './components/CreateSessionModal';
import EditSessionModal from './components/EditSessionModal';
import SettingsPanel from './components/SettingsPanel';
import HistoryPanel from './components/HistoryPanel';
import OnboardingModal from './components/OnboardingModal';
import './styles/lcars.css';

type ViewMode = 'focus' | 'grid';
type PanelView = 'sessions' | 'settings' | 'history';

function useStardate() {
  const [label, setLabel] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const year = now.getFullYear();
      const doy = Math.floor(
        (now.getTime() - new Date(year, 0, 0).getTime()) / 86400000
      );
      setLabel(`STARDATE ${year - 1900}.${String(doy).padStart(3, '0')}`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);
  return label;
}

function buildCliArgs(
  provider: ReturnType<typeof PROVIDER_MAP.get>,
  allowAllTools: boolean,
  initialPrompt: string | undefined,
  useKeystroke: boolean,
  model?: string,
  resume?: boolean,
): { args: string[]; keystrokePrompt: string | undefined } {
  if (!provider) return { args: [], keystrokePrompt: undefined };

  const args: string[] = [];

  // Resume flags come first so they act as the primary subcommand/flag
  // e.g. "claude --continue", "codex resume --last"
  if (resume && provider.resumeFlag) {
    args.push(...provider.resumeFlag.split(/\s+/).filter(Boolean));
  }

  if (allowAllTools && provider.autoApproveFlag) {
    args.push(provider.autoApproveFlag);
  }

  if (model && provider.modelFlag) {
    args.push(provider.modelFlag, model);
  }

  if (provider.id === 'kiro') {
    args.push('chat');
  }

  // Skip initial prompt when resuming — the conversation already has context
  let keystrokePrompt: string | undefined;
  if (initialPrompt && !resume) {
    if (useKeystroke || !provider.initialPromptFlag) {
      keystrokePrompt = initialPrompt;
    } else {
      args.push(provider.initialPromptFlag, initialPrompt);
    }
  }

  return { args, keystrokePrompt };
}

export default function App() {
  const [sections, setSections] = useState<Section[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('focus');
  const [panelView, setPanelView] = useState<PanelView>('sessions');
  const [showModal, setShowModal] = useState(false);
  const [modalSectionId, setModalSectionId] = useState<string | undefined>();
  const [homeDir, setHomeDir] = useState('~');
  const [appConfig, setAppConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [githubIssues, setGithubIssues] = useState<GitHubIssue[]>([]);
  const [editingSession, setEditingSession] = useState<SessionInfo | null>(null);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Apply theme CSS vars whenever config changes
  useEffect(() => {
    const preset = BUILT_IN_THEMES.find(t => t.id === appConfig.theme?.preset) ?? BUILT_IN_THEMES[0];
    const vars = { ...preset.vars, ...(appConfig.theme?.custom ?? {}) };
    const root = document.documentElement;
    THEME_VAR_KEYS.forEach(k => root.style.removeProperty(k));
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }, [appConfig.theme]);
  const sectionColorIdx = useRef(0);
  const stardate = useStardate();

  useEffect(() => {
    invoke<string>('get_home_dir').then(setHomeDir).catch(console.error);
    invoke<AppConfig>('load_config').then((cfg) => {
      setAppConfig(cfg);
      if (!cfg.onboarded) setShowOnboarding(true);
      // Pre-fetch GitHub issues if enabled
      if (cfg.github.enabled) {
        invoke<GitHubIssue[]>('github_fetch_issues', {
          token: cfg.github.token,
          repo: null,
        }).then(setGithubIssues).catch(console.error);
      }
    }).catch(console.error);
  }, []);

  // Workspace persistence — load on mount
  const workspaceLoaded = useRef(false);
  useEffect(() => {
    invoke<{ sections?: Section[]; sessions?: SessionInfo[] } | null>('load_workspace')
      .then((ws) => {
        if (ws?.sections?.length) setSections(ws.sections);
        if (ws?.sessions?.length) {
          setSessions(ws.sessions.map((s) => ({ ...s, status: 'paused' as const })));
        }
      })
      .catch(() => { /* first launch — no workspace file yet */ })
      .finally(() => { workspaceLoaded.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Workspace persistence — debounced save on change (skip until loaded)
  const saveWorkspaceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!workspaceLoaded.current) return;
    if (saveWorkspaceTimer.current) clearTimeout(saveWorkspaceTimer.current);
    saveWorkspaceTimer.current = setTimeout(() => {
      invoke('save_workspace', { data: { sections, sessions } }).catch(console.error);
    }, 1000);
    return () => {
      if (saveWorkspaceTimer.current) clearTimeout(saveWorkspaceTimer.current);
    };
  }, [sections, sessions]);

  // Reload config when returning from settings
  const handleHideSettings = useCallback(() => {
    setPanelView('sessions');
    invoke<AppConfig>('load_config').then(setAppConfig).catch(console.error);
  }, []);

  // Keyboard shortcuts (⌘D = toggle grid, ⌘T = new session)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'd') { e.preventDefault(); setViewMode((m) => (m === 'focus' ? 'grid' : 'focus')); }
      if (e.metaKey && e.shiftKey && e.key === 'T') { e.preventDefault(); setShowModal(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const pushActivity = useCallback((event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    setActivityFeed(prev => [
      { ...event, id: crypto.randomUUID(), timestamp: Date.now() },
      ...prev.slice(0, 49),
    ]);
  }, []);

  const ensureSection = useCallback(
    (id: string, name: string, color: string) => {
      setSections((prev) => {
        if (prev.find((s) => s.id === id)) return prev;
        return [...prev, { id, name, collapsed: false, color }];
      });
    },
    []
  );

  const nextColor = useCallback(() => {
    const color = SECTION_COLORS[sectionColorIdx.current % SECTION_COLORS.length];
    sectionColorIdx.current++;
    return color;
  }, []);

  const handleNewSection = useCallback(() => {
    const id = crypto.randomUUID();
    setSections((prev) => [
      ...prev,
      { id, name: 'New Section', collapsed: false, color: nextColor() },
    ]);
  }, [nextColor]);

  const openModal = useCallback((sectionId?: string) => {
    setModalSectionId(sectionId);
    setShowModal(true);
  }, []);

  const handleCreateSession = useCallback(
    async (
      params: CreateSessionParams,
      newSection?: { name: string; color: string }
    ): Promise<string | undefined> => {
      let sectionId = params.section;

      if (params.section === '__new__' && newSection) {
        sectionId = crypto.randomUUID();
        setSections((prev) => [
          ...prev,
          { id: sectionId, name: newSection.name, collapsed: false, color: newSection.color },
        ]);
      } else if (modalSectionId) {
        sectionId = modalSectionId;
      }

      // Create a default section if none exists
      if (!sectionId || sectionId === '__new__') {
        sectionId = crypto.randomUUID();
        ensureSection(sectionId, 'Main', nextColor());
      }

      const provider = PROVIDER_MAP.get(params.provider_id) ?? PROVIDERS[0];

      // Memory injection: prepend retrieved context to the initial prompt if configured
      let effectivePrompt = params.initial_prompt;
      const memEntry = resolveMemoryEntry(appConfig.memory.entries, params.provider_id);
      if (appConfig.memory.enabled && memEntry?.inject_into_prompt && effectivePrompt) {
        try {
          const memCtx = await invoke<string>('memory_search', {
            query: `${params.name} ${effectivePrompt}`,
            providerId: params.provider_id,
          });
          if (memCtx.trim()) {
            effectivePrompt = `[Memory context]\n${memCtx.trim()}\n\n[Task]\n${effectivePrompt}`;
          }
        } catch {
          // Memory search failure is non-fatal
        }
      }

      const { args, keystrokePrompt } = buildCliArgs(
        provider,
        params.allow_all_tools,
        effectivePrompt,
        provider.useKeystrokeInjection ?? false,
        params.model,
      );

      // SSH: prefix CLI command with ssh -t if a remote host is selected
      let cli = provider.cli;
      let cliArgs = args;
      if (params.ssh_connection_id) {
        const conn = appConfig.ssh.connections.find((c: SshConnection) => c.id === params.ssh_connection_id);
        if (conn) {
          const sshPrefix = [
            'ssh', '-t',
            '-p', String(conn.port),
            ...(conn.key_path ? ['-i', conn.key_path] : []),
            `${conn.username}@${conn.host}`,
            cli,
          ];
          cli = sshPrefix[0];
          cliArgs = [...sshPrefix.slice(1), ...args];
        }
      }

      let effectiveCwd = params.cwd || appConfig.default_cwd || homeDir;
      let worktree: { path: string; repo_root: string } | undefined;
      if (params.worktree_branch) {
        try {
          const gitInfo = await invoke<{ root: string; branch: string } | null>('detect_git_repo', { cwd: effectiveCwd });
          if (gitInfo) {
            const wtPath = await invoke<string>('create_worktree', { repoRoot: gitInfo.root, branchName: params.worktree_branch });
            worktree = { path: wtPath, repo_root: gitInfo.root };
            effectiveCwd = wtPath;
          }
        } catch (e) {
          console.error('worktree creation failed:', e);
        }
      }

      try {
        const id = await invoke<string>('create_session', {
          name: params.name,
          providerId: params.provider_id,
          cli,
          cliArgs,
          section: sectionId,
          cwd: effectiveCwd,
          allowAllTools: params.allow_all_tools,
          keystrokePrompt: keystrokePrompt ?? null,
        });

        const newSession: SessionInfo = {
          id,
          name: params.name,
          provider_id: params.provider_id,
          model: params.model,
          section: sectionId,
          cwd: effectiveCwd,
          allow_all_tools: params.allow_all_tools,
          status: 'running',
          rows: 24,
          cols: 100,
          worktree,
        };

        setSessions((prev) => [...prev, newSession]);
        setSelectedId(id);
        setViewMode('focus');
        setShowModal(false);
        pushActivity({ sessionId: id, sessionName: params.name, kind: 'created', message: `<strong>${params.name}</strong> launched with ${provider.name}` });
        return undefined;
      } catch (e) {
        return String(e);
      }
    },
    [homeDir, modalSectionId, ensureSection, nextColor, appConfig, pushActivity]
  );

  const saveToHistory = useCallback(async (session: SessionInfo, finalStatus: string) => {
    const sectionName = sections.find(s => s.id === session.section)?.name;
    const entry: HistoryEntry = {
      id: session.id,
      name: session.name,
      provider_id: session.provider_id,
      model: session.model,
      cwd: session.cwd,
      allow_all_tools: session.allow_all_tools,
      section_name: sectionName,
      ended_at: new Date().toISOString(),
      final_status: finalStatus,
    };
    await invoke('append_history', { entry }).catch(console.error);
    if (session.worktree) {
      invoke('remove_worktree', { repoRoot: session.worktree.repo_root, worktreePath: session.worktree.path }).catch(console.error);
    }
  }, [sections]);

  const handleRemoveSession = useCallback((id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) saveToHistory(session, session.status);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, [sessions, saveToHistory]);

  const handleStatusChange = useCallback((id: string, status: SessionInfo['status']) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }, []);

  const handleMoveSession = useCallback((sessionId: string, sectionId: string) => {
    setSessions((prev) => prev.map((s) => s.id === sessionId ? { ...s, section: sectionId } : s));
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    const session = sessions.find(s => s.id === id);
    try { await invoke('kill_session', { sessionId: id }); } catch { /* already dead */ }
    if (session) {
      await saveToHistory(session, 'cancelled');
      pushActivity({ sessionId: id, sessionName: session.name, kind: 'deleted', message: `<strong>${session.name}</strong> deleted` });
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((cur) => cur === id ? null : cur);
  }, [sessions, saveToHistory, pushActivity]);

  const handleDeleteSection = useCallback((id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Stop = kill the PTY but keep the session card (status → paused, restartable)
  const handleStopSession = useCallback(async (id: string) => {
    try { await invoke('kill_session', { sessionId: id }); } catch { /* already dead */ }
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'paused' } : s));
    const session = sessions.find(s => s.id === id);
    if (session) pushActivity({ sessionId: id, sessionName: session.name, kind: 'paused', message: `<strong>${session.name}</strong> paused` });
  }, [sessions, pushActivity]);

  // Restart = kill + relaunch with the same settings
  // Pass resume=true to continue the previous conversation (uses provider resumeFlag)
  const handleRestartSession = useCallback(async (id: string, resume = false) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    try { await invoke('kill_session', { sessionId: id }); } catch { /* ok */ }

    const provider = PROVIDER_MAP.get(session.provider_id) ?? PROVIDERS[0];
    const { args, keystrokePrompt } = buildCliArgs(
      provider,
      session.allow_all_tools,
      undefined,
      provider.useKeystrokeInjection ?? false,
      session.model,
      resume,
    );
    try {
      const newId = await invoke<string>('create_session', {
        name: session.name,
        providerId: provider.id,
        cli: provider.cli,
        cliArgs: args,
        section: session.section,
        cwd: session.cwd,
        allowAllTools: session.allow_all_tools,
        keystrokePrompt: keystrokePrompt ?? null,
      });
      setSessions((prev) => prev.map((s) =>
        s.id === id ? { ...s, id: newId, status: 'running' } : s
      ));
      setSelectedId(newId);
    } catch (e) {
      console.error('restart failed:', e);
    }
  }, [sessions]);

  const handleEditSession = useCallback(async (
    updates: Partial<SessionInfo> & { restart?: boolean }
  ) => {
    const session = sessions.find((s) => s.id === editingSession?.id);
    if (!session) { setEditingSession(null); return; }

    const { restart, ...fields } = updates;

    if (restart) {
      // Kill the old session and launch a new one with updated settings
      try { await invoke('kill_session', { sessionId: session.id }); } catch { /* ok */ }
      setSessions((prev) => prev.filter((s) => s.id !== session.id));

      const provider = PROVIDER_MAP.get(fields.provider_id ?? session.provider_id) ?? PROVIDERS[0];
      const { args, keystrokePrompt } = buildCliArgs(
        provider,
        fields.allow_all_tools ?? session.allow_all_tools,
        undefined,
        provider.useKeystrokeInjection ?? false,
        fields.model,
      );

      try {
        const id = await invoke<string>('create_session', {
          name: fields.name ?? session.name,
          providerId: provider.id,
          cli: provider.cli,
          cliArgs: args,
          section: fields.section ?? session.section,
          cwd: session.cwd,
          allowAllTools: fields.allow_all_tools ?? session.allow_all_tools,
          keystrokePrompt: keystrokePrompt ?? null,
        });
        setSessions((prev) => [...prev, {
          ...session,
          ...fields,
          id,
          provider_id: provider.id,
          status: 'running',
        }]);
        setSelectedId(id);
      } catch (e) {
        console.error('restart failed:', e);
      }
    } else {
      setSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, ...fields } : s));
    }

    setEditingSession(null);
  }, [editingSession, sessions]);

  const handleChangeProviderModel = useCallback(async (sessionId: string, providerId: string, model: string | undefined) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    if (providerId === session.provider_id && model === session.model) return;

    const provider = PROVIDER_MAP.get(providerId) ?? PROVIDERS[0];
    if (session.status === 'running') {
      try { await invoke('kill_session', { sessionId }); } catch { /* ok */ }
    }

    const { args, keystrokePrompt } = buildCliArgs(provider, session.allow_all_tools, undefined, provider.useKeystrokeInjection ?? false, model);
    try {
      const newId = await invoke<string>('create_session', {
        name: session.name, providerId: provider.id, cli: provider.cli, cliArgs: args,
        section: session.section, cwd: session.cwd, allowAllTools: session.allow_all_tools,
        keystrokePrompt: keystrokePrompt ?? null,
      });
      setSessions(prev => prev.map(s => s.id === sessionId
        ? { ...s, id: newId, provider_id: providerId, model, status: 'running' }
        : s
      ));
      setSelectedId(newId);
      pushActivity({ sessionId: newId, sessionName: session.name, kind: 'resumed', message: `<strong>${session.name}</strong> switched to ${provider.name}` });
    } catch (e) {
      console.error('provider/model change failed:', e);
    }
  }, [sessions, pushActivity]);

  const handleOnboardingComplete = useCallback(async (defaultCwd: string) => {
    setShowOnboarding(false);
    const newConfig = { ...appConfig, onboarded: true, default_cwd: defaultCwd || appConfig.default_cwd };
    setAppConfig(newConfig);
    await invoke('save_config', { config: newConfig }).catch(console.error);
  }, [appConfig]);

  const handleRelaunchFromHistory = useCallback(async (entry: HistoryEntry) => {
    setPanelView('sessions');
    const sectionId = sections[0]?.id ?? crypto.randomUUID();
    if (!sections[0]) {
      setSections(prev => [...prev, { id: sectionId, name: 'Relaunched', collapsed: false, color: SECTION_COLORS[0] }]);
    }
    await handleCreateSession({
      name: entry.name,
      provider_id: entry.provider_id,
      model: entry.model,
      section: sectionId,
      cwd: entry.cwd,
      allow_all_tools: entry.allow_all_tools,
    });
  }, [sections, handleCreateSession]);

  const selectedSession = sessions.find((s) => s.id === selectedId) ?? null;
  const runningCount = sessions.filter((s) => s.status === 'running').length;

  // Sections + sessions for grid view
  const validSectionIds = new Set(sections.map((s) => s.id));
  const sectionGroups = sections.map((sec) => ({
    section: sec,
    sessions: sessions.filter((s) => s.section === sec.id),
  }));
  const orphans = sessions.filter((s) => !validSectionIds.has(s.section));

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        {/* Starbase icon — top-down space station */}
        <svg width="20" height="20" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, opacity: 0.85 }}>
          {/* Outer ring */}
          <circle cx="40" cy="40" r="36" stroke="#FF9900" strokeWidth="2.5" opacity="0.7"/>
          {/* Middle ring */}
          <circle cx="40" cy="40" r="22" stroke="#FF9900" strokeWidth="2" opacity="0.55"/>
          {/* Hub */}
          <circle cx="40" cy="40" r="9" stroke="#FF9900" strokeWidth="2"/>
          <circle cx="40" cy="40" r="4" fill="#FFCC66" opacity="0.9"/>
          {/* 6 spokes at 60° intervals */}
          <line x1="40" y1="4"  x2="40" y2="18" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          <line x1="40" y1="62" x2="40" y2="76" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          <line x1="4"  y1="40" x2="18" y2="40" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          <line x1="62" y1="40" x2="76" y2="40" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          <line x1="12" y1="12" x2="22" y2="22" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          <line x1="58" y1="58" x2="68" y2="68" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          <line x1="68" y1="12" x2="58" y2="22" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          <line x1="22" y1="58" x2="12" y2="68" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
          {/* Docking ports on outer ring */}
          <circle cx="40" cy="4"  r="2.5" fill="#FFCC66" opacity="0.8"/>
          <circle cx="40" cy="76" r="2.5" fill="#FFCC66" opacity="0.8"/>
          <circle cx="4"  cy="40" r="2.5" fill="#FFCC66" opacity="0.8"/>
          <circle cx="76" cy="40" r="2.5" fill="#FFCC66" opacity="0.8"/>
        </svg>

        <span className="app-header__name">STARBASE</span>
        <div className="app-header__sep" />
        <span className="app-header__stardate">{stardate}</span>

        <div className="app-header__right">
          <div className="app-header__stat">
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: runningCount > 0 ? 'var(--accent-green)' : 'var(--text-dim)',
              animation: runningCount > 0 ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }} />
            {runningCount} running · {sessions.length} total
          </div>

          {panelView === 'sessions' && (
            <div className="app-header__view-toggle">
              <button
                className={`view-toggle-btn${viewMode === 'focus' ? ' view-toggle-btn--active' : ''}`}
                onClick={() => setViewMode('focus')}
                title="Focus view (⌘D)"
              >
                Focus
              </button>
              <button
                className={`view-toggle-btn${viewMode === 'grid' ? ' view-toggle-btn--active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Dashboard grid (⌘D)"
              >
                Grid
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="app-body">
        <Sidebar
          sections={sections}
          sessions={sessions}
          selectedId={selectedId}
          view={panelView}
          onSelectSession={(id) => {
            const session = sessions.find((s) => s.id === id);
            setSelectedId(id);
            setViewMode('focus');
            setPanelView('sessions');
            // Auto-resume paused sessions — user clicked it, they want it running
            if (session?.status === 'paused') {
              handleRestartSession(id, true);
            }
          }}
          onNewSession={openModal}
          onNewSection={handleNewSection}
          onToggleSection={(id) =>
            setSections((prev) =>
              prev.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s))
            )
          }
          onRenameSection={(id, name) =>
            setSections((prev) =>
              prev.map((s) => (s.id === id ? { ...s, name } : s))
            )
          }
          onDeleteSection={handleDeleteSection}
          onMoveSession={handleMoveSession}
          onEditSession={(s) => setEditingSession(s)}
          onStopSession={handleStopSession}
          onRestartSession={handleRestartSession}
          onDeleteSession={handleDeleteSession}
          onShowSettings={() => setPanelView('settings')}
          onHideSettings={handleHideSettings}
          onShowHistory={() => setPanelView('history')}
        />

        <main className="main">
          {/* Settings panel */}
          {panelView === 'settings' && (
            <SettingsPanel onClose={handleHideSettings} />
          )}

          {/* History panel */}
          {panelView === 'history' && (
            <HistoryPanel
              onClose={() => setPanelView('sessions')}
              onRelaunch={handleRelaunchFromHistory}
            />
          )}

          {/* Focus view — all sessions stay mounted; only the selected one is visible.
               This preserves each terminal's xterm buffer across session switches. */}
          {panelView === 'sessions' && viewMode === 'focus' && (
            <>
              {!selectedSession && (
                <div className="empty-state" style={{ flex: 1 }}>
                  <svg width="56" height="56" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="2.5" opacity="0.12"/>
                    <circle cx="40" cy="40" r="22" stroke="currentColor" strokeWidth="2" opacity="0.12"/>
                    <circle cx="40" cy="40" r="9"  stroke="currentColor" strokeWidth="2" opacity="0.15"/>
                    <circle cx="40" cy="40" r="4"  fill="currentColor" opacity="0.15"/>
                    <line x1="40" y1="4"  x2="40" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.1"/>
                    <line x1="40" y1="62" x2="40" y2="76" stroke="currentColor" strokeWidth="1.5" opacity="0.1"/>
                    <line x1="4"  y1="40" x2="18" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.1"/>
                    <line x1="62" y1="40" x2="76" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.1"/>
                  </svg>
                  <div className="empty-state__title">No Session Selected</div>
                  <div className="empty-state__desc">
                    Launch a session from the sidebar, or switch to Grid view to see all sessions at once.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--primary btn--sm" onClick={() => openModal()}>
                      + New Session
                    </button>
                    <button className="btn btn--ghost btn--sm" onClick={() => setViewMode('grid')}>
                      Grid View
                    </button>
                  </div>
                </div>
              )}
              {sessions.map((session) => (
                <FocusView
                  key={session.id}
                  session={session}
                  isActive={session.id === selectedId}
                  onRemove={handleRemoveSession}
                  onStatusChange={handleStatusChange}
                  onEdit={(s) => setEditingSession(s)}
                  onChangeProviderModel={handleChangeProviderModel}
                />
              ))}
            </>
          )}

          {/* Grid / Dashboard view */}
          {panelView === 'sessions' && viewMode === 'grid' && (
            <div className="grid-view">
              {sessions.length === 0 && (
                <div className="empty-state" style={{ flex: 1, minHeight: 300 }}>
                  <div className="empty-state__title">No Sessions</div>
                  <div className="empty-state__desc">Launch your first session to get started.</div>
                  <button className="btn btn--primary btn--sm" onClick={() => openModal()}>
                    + New Session
                  </button>
                </div>
              )}

              {sectionGroups
                .filter((g) => g.sessions.length > 0)
                .map(({ section, sessions: ss }) => (
                  <div key={section.id}>
                    <div className="grid-section-header">
                      <div className="grid-section-header__dot" style={{ background: section.color }} />
                      <span className="grid-section-header__name">{section.name}</span>
                      <span className="grid-section-header__count">{ss.length}</span>
                      <div className="grid-section-header__line" />
                    </div>
                    <div className="grid-sessions">
                      {ss.map((s) => (
                        <SessionCard
                          key={s.id}
                          session={s}
                          onRemove={handleRemoveSession}
                          onStatusChange={handleStatusChange}
                          onClick={() => { setSelectedId(s.id); setViewMode('focus'); }}
                        />
                      ))}
                    </div>
                  </div>
                ))}

              {orphans.length > 0 && (
                <div>
                  <div className="grid-section-header">
                    <div className="grid-section-header__dot" style={{ background: 'var(--text-dim)' }} />
                    <span className="grid-section-header__name">Unsectioned</span>
                    <div className="grid-section-header__line" />
                  </div>
                  <div className="grid-sessions">
                    {orphans.map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onRemove={handleRemoveSession}
                        onStatusChange={handleStatusChange}
                        onClick={() => { setSelectedId(s.id); setViewMode('focus'); }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {activityFeed.length > 0 && (
                <div className="activity-feed">
                  <div className="activity-feed__header">Activity</div>
                  {activityFeed.map(ev => (
                    <div key={ev.id} className="activity-event">
                      <span className="activity-event__time">
                        {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span
                        className="activity-event__msg"
                        dangerouslySetInnerHTML={{ __html: ev.message }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Edit session modal */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          sections={sections}
          onSave={handleEditSession}
          onCancel={() => setEditingSession(null)}
        />
      )}

      {/* New session modal */}
      {showModal && (
        <CreateSessionModal
          sections={sections}
          defaultCwd={appConfig.default_cwd || homeDir}
          defaultSectionId={modalSectionId}
          sshConnections={appConfig.ssh.connections}
          githubIssues={githubIssues}
          profiles={appConfig.profiles}
          onConfirm={handleCreateSession}
          onCancel={() => setShowModal(false)}
        />
      )}

      {showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
}
