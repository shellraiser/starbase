import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { PROVIDERS, Provider, Section, CreateSessionParams, SECTION_COLORS, PROVIDER_MAP } from '../types';
import { SshConnection, GitHubIssue, AgentProfile } from '../types/integrations';

interface Props {
  sections: Section[];
  defaultCwd: string;
  defaultSectionId?: string;
  sshConnections: SshConnection[];
  githubIssues?: GitHubIssue[];
  profiles?: AgentProfile[];
  onConfirm: (params: CreateSessionParams, newSection?: { name: string; color: string }) => Promise<string | undefined>;
  onCancel: () => void;
}

export default function CreateSessionModal({
  sections,
  defaultCwd,
  defaultSectionId,
  sshConnections,
  githubIssues = [],
  profiles = [],
  onConfirm,
  onCancel,
}: Props) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<Provider>(PROVIDERS[0]);
  const [sectionMode, setSectionMode] = useState<'existing' | 'new'>(
    sections.length > 0 ? 'existing' : 'new'
  );
  const [selectedSection, setSelectedSection] = useState(
    defaultSectionId ?? sections[0]?.id ?? ''
  );
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColor, setNewSectionColor] = useState(SECTION_COLORS[0]);
  const [cwd, setCwd] = useState(defaultCwd);
  const [allowAllTools, setAllowAllTools] = useState(false);
  const [initialPrompt, setInitialPrompt] = useState('');
  const [detectedClis, setDetectedClis] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [model, setModel] = useState<string>('');
  const [sshConnectionId, setSshConnectionId] = useState<string>('');
  const [attachedIssue, setAttachedIssue] = useState<GitHubIssue | null>(null);
  const [issueSearch, setIssueSearch] = useState('');
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [gitRepo, setGitRepo] = useState<{ root: string; branch: string } | null>(null);
  const [useWorktree, setUseWorktree] = useState(false);
  const [worktreeBranch, setWorktreeBranch] = useState('');

  const applyProfile = useCallback((profile: AgentProfile) => {
    const p = PROVIDER_MAP.get(profile.provider_id) ?? PROVIDERS[0];
    setProvider(p);
    setModel(profile.model ?? '');
    setAllowAllTools(profile.allow_all_tools);
    if (profile.default_cwd) setCwd(profile.default_cwd);
    setActiveProfileId(profile.id);
  }, []);

  // Detect git repo when cwd changes
  useEffect(() => {
    setGitRepo(null);
    setUseWorktree(false);
    if (!cwd) return;
    const timer = setTimeout(() => {
      invoke<{ root: string; branch: string } | null>('detect_git_repo', { cwd })
        .then(setGitRepo)
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [cwd]);

  // Detect which CLIs are installed
  useEffect(() => {
    const detect = async () => {
      const results = await Promise.all(
        PROVIDERS.map(async (p) => {
          const found = await invoke<boolean>('check_cli', { cli: p.cli }).catch(() => false);
          return found ? p.id : null;
        })
      );
      setDetectedClis(new Set(results.filter(Boolean) as string[]));
    };
    detect();
  }, []);

  const filteredProviders = PROVIDERS.filter(
    (p) =>
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.cli.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredIssues = githubIssues.filter(
    (i) =>
      !issueSearch ||
      i.title.toLowerCase().includes(issueSearch.toLowerCase()) ||
      String(i.number).includes(issueSearch) ||
      i.repo.toLowerCase().includes(issueSearch.toLowerCase())
  );

  const handleSubmit = useCallback(async () => {
    setLaunchError(null);
    const sessionName = name.trim() || `${provider.name} ${Date.now().toString().slice(-4)}`;

    let sectionId = sectionMode === 'existing' ? selectedSection : '__new__';
    if (defaultSectionId) sectionId = defaultSectionId;

    // Prepend issue context to the initial prompt if one is attached
    let prompt = initialPrompt.trim();
    if (attachedIssue) {
      const issueCtx = [
        `GitHub Issue #${attachedIssue.number}: ${attachedIssue.title}`,
        attachedIssue.body ? attachedIssue.body.trim() : '',
      ].filter(Boolean).join('\n\n');
      prompt = prompt ? `${issueCtx}\n\n${prompt}` : issueCtx;
    }

    const params: CreateSessionParams = {
      name: sessionName,
      provider_id: provider.id,
      model: model || undefined,
      section: sectionId,
      cwd: cwd || defaultCwd,
      allow_all_tools: allowAllTools,
      initial_prompt: prompt || undefined,
      ssh_connection_id: sshConnectionId || undefined,
      worktree_branch: useWorktree && worktreeBranch.trim() ? worktreeBranch.trim() : undefined,
    };

    setLaunching(true);
    let error: string | undefined;
    if (sectionMode === 'new' && !defaultSectionId) {
      error = await onConfirm(params, {
        name: newSectionName.trim() || 'New Section',
        color: newSectionColor,
      });
    } else {
      error = await onConfirm(params);
    }
    setLaunching(false);
    if (error) setLaunchError(error);
  }, [
    name, provider, model, sectionMode, selectedSection, defaultSectionId,
    newSectionName, newSectionColor, cwd, allowAllTools, initialPrompt,
    defaultCwd, onConfirm, sshConnectionId, attachedIssue, useWorktree, worktreeBranch,
  ]);

  const selectedSshConn = sshConnections.find((c) => c.id === sshConnectionId);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal animate-in">
        <div className="modal__header">
          <span className="modal__title">New Session</span>
          <button className="modal__close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal__body">
          {/* Profile quick-pick */}
          {profiles.length > 0 && (
            <div className="field">
              <label className="label">Profile</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <div
                  className={`model-item${!activeProfileId ? ' model-item--selected' : ''}`}
                  onClick={() => setActiveProfileId(null)}
                >
                  Custom
                </div>
                {profiles.map((prof) => (
                  <div
                    key={prof.id}
                    className={`model-item${activeProfileId === prof.id ? ' model-item--selected' : ''}`}
                    onClick={() => applyProfile(prof)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    {prof.color && (
                      <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: prof.color, flexShrink: 0, display: 'inline-block',
                      }} />
                    )}
                    {prof.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session name */}
          <div className="field">
            <label className="label">Session Name</label>
            <input
              className="input"
              placeholder={`e.g. ${provider.name} — Auth Module`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          {/* Provider */}
          <div className="field">
            <label className="label">CLI Provider</label>
            <input
              className="input"
              placeholder="Search providers…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ marginBottom: 6 }}
            />
            <div
              className="provider-grid"
              style={{ maxHeight: 200, overflowY: 'auto', gap: 4 }}
            >
              {filteredProviders.map((p) => {
                const installed = detectedClis.has(p.id);
                return (
                  <div
                    key={p.id}
                    className={`provider-item${provider.id === p.id ? ' provider-item--selected' : ''}`}
                    onClick={() => { setProvider(p); setModel(''); }}
                  >
                    <div
                      className="provider-item__dot"
                      style={{ background: installed ? 'var(--accent-green)' : 'var(--text-dim)' }}
                      title={installed ? 'Detected on PATH' : 'Not found on PATH'}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="provider-item__name">{p.name}</div>
                      <div className="provider-item__cli">{p.cli}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {!detectedClis.has(provider.id) && (
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
                ⚠ {provider.cli} not found on PATH.
                {provider.installCommand && (
                  <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 4 }}>
                    Install: {provider.installCommand}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Model selector — shown only when provider has defined models */}
          {provider.models && provider.models.length > 0 && (
            <div className="field">
              <label className="label">Model</label>
              <div className="model-grid">
                <div
                  className={`model-item${!model ? ' model-item--selected' : ''}`}
                  onClick={() => setModel('')}
                >
                  Default
                </div>
                {provider.models.map((m) => (
                  <div
                    key={m.id}
                    className={`model-item${model === m.id ? ' model-item--selected' : ''}`}
                    onClick={() => setModel(m.id)}
                  >
                    {m.name}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section */}
          {!defaultSectionId && (
            <div className="field">
              <label className="label">Section</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                {sections.length > 0 && (
                  <button
                    className={`btn btn--sm ${sectionMode === 'existing' ? 'btn--accent-ghost' : 'btn--ghost'}`}
                    onClick={() => setSectionMode('existing')}
                  >
                    Existing
                  </button>
                )}
                <button
                  className={`btn btn--sm ${sectionMode === 'new' ? 'btn--accent-ghost' : 'btn--ghost'}`}
                  onClick={() => setSectionMode('new')}
                >
                  New Section
                </button>
              </div>

              {sectionMode === 'existing' && sections.length > 0 && (
                <select
                  className="select"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                >
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}

              {sectionMode === 'new' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Section name"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                  />
                  <div>
                    <div className="label" style={{ marginBottom: 6 }}>Color</div>
                    <div className="color-swatches">
                      {SECTION_COLORS.map((c) => (
                        <div
                          key={c}
                          className={`color-swatch${newSectionColor === c ? ' color-swatch--selected' : ''}`}
                          style={{ background: c }}
                          onClick={() => setNewSectionColor(c)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Working directory */}
          <div className="field">
            <label className="label">Working Directory</label>
            <input
              className="input"
              value={cwd}
              onChange={(e) => setCwd(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            />
          </div>

          {/* Git worktree */}
          {gitRepo && (
            <div className="field">
              <label className="toggle" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useWorktree}
                  onChange={(e) => {
                    setUseWorktree(e.target.checked);
                    if (e.target.checked && !worktreeBranch) {
                      const slug = name.trim().toLowerCase().replace(/\s+/g, '-') || 'starbase';
                      setWorktreeBranch(`${slug}-${Date.now().toString().slice(-4)}`);
                    }
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div className="toggle__label">
                    Create isolated git worktree
                    <span className="worktree-badge" style={{ marginLeft: 8 }}>git</span>
                  </div>
                  <div className="toggle__desc">
                    Agent works on a separate branch from <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{gitRepo.branch}</code> without touching your main working tree
                  </div>
                </div>
              </label>
              {useWorktree && (
                <input
                  className="input"
                  placeholder="branch-name"
                  value={worktreeBranch}
                  onChange={(e) => setWorktreeBranch(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, marginTop: 4 }}
                />
              )}
            </div>
          )}

          {/* Remote host (SSH) */}
          {sshConnections.length > 0 && (
            <div className="field">
              <label className="label">Remote Host (optional)</label>
              <select
                className="select"
                value={sshConnectionId}
                onChange={(e) => setSshConnectionId(e.target.value)}
              >
                <option value="">Local machine</option>
                {sshConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.username}@{c.host}:{c.port}
                  </option>
                ))}
              </select>
              {selectedSshConn && (
                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, display: 'block' }}>
                  Session will run via ssh -t on {selectedSshConn.host}
                </span>
              )}
            </div>
          )}

          {/* GitHub issue context */}
          {githubIssues.length > 0 && (
            <div className="field">
              <label className="label">Attach GitHub Issue as Context (optional)</label>
              {attachedIssue ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-input)', border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-sm)', padding: '6px 10px',
                }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-accent)' }}>
                    #{attachedIssue.number}
                  </span>
                  <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {attachedIssue.title}
                  </span>
                  <button
                    className="btn btn--ghost btn--xs"
                    onClick={() => setAttachedIssue(null)}
                    style={{ flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="input"
                    placeholder="Search issues…"
                    value={issueSearch}
                    onChange={(e) => setIssueSearch(e.target.value)}
                    style={{ marginBottom: 4 }}
                  />
                  <div className="issue-list" style={{ maxHeight: 140, overflowY: 'auto' }}>
                    {filteredIssues.slice(0, 20).map((iss) => (
                      <div
                        key={`${iss.repo}#${iss.number}`}
                        className="issue-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setAttachedIssue(iss); setIssueSearch(''); }}
                      >
                        <span className="issue-item__key">#{iss.number}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="issue-item__title">{iss.title}</div>
                          <div className="issue-item__meta">{iss.repo} · {iss.state}</div>
                        </div>
                      </div>
                    ))}
                    {filteredIssues.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '6px 0' }}>
                        No matching issues
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Initial prompt */}
          <div className="field">
            <label className="label">Initial Prompt (optional)</label>
            <input
              className="input"
              placeholder="e.g. Help me refactor the auth module"
              value={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
            />
          </div>

          {/* Allow all tools */}
          <label className={`toggle${allowAllTools ? ' toggle--warn' : ''}`}>
            <input
              type="checkbox"
              checked={allowAllTools}
              onChange={(e) => setAllowAllTools(e.target.checked)}
            />
            <div style={{ flex: 1 }}>
              <div className="toggle__label">Allow All Tools</div>
              <div className="toggle__desc">
                Passes the provider's auto-approve flag — agent will not prompt
                before running tools
              </div>
            </div>
          </label>
        </div>

        {launchError && (
          <div style={{
            margin: '0 20px 12px',
            padding: '10px 12px',
            background: 'color-mix(in srgb, var(--accent-red) 10%, var(--bg-surface))',
            border: '1px solid color-mix(in srgb, var(--accent-red) 40%, transparent)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
          }}>
            <div style={{ color: 'var(--accent-red)', fontWeight: 600, marginBottom: 4 }}>
              Failed to launch — {provider.cli} not found
            </div>
            <div style={{ color: 'var(--text-muted)', marginBottom: provider.installCommand ? 8 : 0 }}>
              {launchError}
            </div>
            {provider.installCommand && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                <code style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-dim)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  color: 'var(--text)',
                  userSelect: 'all',
                }}>
                  {provider.installCommand}
                </code>
                <button
                  className="btn btn--ghost btn--xs"
                  onClick={() => navigator.clipboard.writeText(provider.installCommand!)}
                  title="Copy install command"
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        )}

        <div className="modal__footer">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleSubmit}
            disabled={launching}
          >
            {launching ? 'Launching…' : 'Launch'}
          </button>
        </div>
      </div>
    </div>
  );
}
