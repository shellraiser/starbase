import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SessionInfo, PROVIDER_MAP, PROVIDERS, SkillInfo } from '../types';
import TerminalView, { TerminalHandle } from './TerminalView';

interface Props {
  session: SessionInfo;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: SessionInfo['status']) => void;
  onEdit: (session: SessionInfo) => void;
  onChangeProviderModel: (sessionId: string, providerId: string, model: string | undefined) => void;
  isActive?: boolean;
}

type Tab = 'terminal' | 'info';

export default function FocusView({ session, onRemove, onStatusChange, onEdit, onChangeProviderModel, isActive = true }: Props) {
  const [tab, setTabState] = useState<Tab>('terminal');
  const [confirmKill, setConfirmKill] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [pickerProvider, setPickerProvider] = useState(session.provider_id);
  const [pickerModel, setPickerModel] = useState(session.model ?? '');
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const terminalRef = useRef<TerminalHandle>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const provider = PROVIDER_MAP.get(session.provider_id);
  const cwdDisplay = session.cwd.replace(/^\/Users\/[^/]+/, '~');
  const modelLabel = session.model
    ? (provider?.models?.find((m) => m.id === session.model)?.name ?? session.model)
    : null;

  const setTab = useCallback((next: Tab) => {
    setTabState(next);
    if (next === 'terminal') requestAnimationFrame(() => terminalRef.current?.fit());
  }, []);

  // Load skills when switching to info tab
  useEffect(() => {
    if (tab !== 'info' || skills.length > 0) return;
    invoke<SkillInfo[]>('discover_skills', { cwd: session.cwd })
      .then(setSkills)
      .catch(() => {});
  }, [tab, session.cwd, skills.length]);

  // Re-fit terminal when this session becomes visible after being hidden
  useEffect(() => {
    if (isActive) requestAnimationFrame(() => terminalRef.current?.fit());
  }, [isActive]);

  // Close model picker on outside click
  useEffect(() => {
    if (!showModelPicker) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelPicker]);

  const handleKill = useCallback(async () => {
    if (!confirmKill) {
      setConfirmKill(true);
      setTimeout(() => setConfirmKill(false), 3000);
      return;
    }
    try {
      await invoke('kill_session', { sessionId: session.id });
      onStatusChange(session.id, 'cancelled');
    } catch (err) {
      console.error('kill_session failed:', err);
    }
  }, [confirmKill, session.id, onStatusChange]);

  const handleClear = useCallback(() => { terminalRef.current?.clear(); }, []);

  const applyProviderModel = useCallback(() => {
    setShowModelPicker(false);
    onChangeProviderModel(session.id, pickerProvider, pickerModel || undefined);
  }, [session.id, pickerProvider, pickerModel, onChangeProviderModel]);

  const pickerProviderObj = PROVIDER_MAP.get(pickerProvider);

  const isRunning = session.status === 'running';
  const isPaused  = session.status === 'paused';
  const isDone    = !isRunning && !isPaused;

  return (
    <div className="focus-view animate-in" style={isActive ? undefined : { display: 'none' }}>
      <div className="focus-header">
        <div className={`focus-header__status-dot focus-header__status-dot--${session.status}`} />
        <span className="focus-header__name">{session.name}</span>

        {/* Clickable provider/model — opens inline picker */}
        <div style={{ position: 'relative' }} ref={popoverRef}>
          <button
            className="focus-header__provider-btn"
            onClick={() => {
              setPickerProvider(session.provider_id);
              setPickerModel(session.model ?? '');
              setShowModelPicker((v) => !v);
            }}
            title="Click to change provider / model"
          >
            {provider?.name ?? session.provider_id}
            {modelLabel && <span className="focus-header__model">{modelLabel}</span>}
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>▾</span>
          </button>

          {showModelPicker && (
            <div className="model-popover">
              <div className="field">
                <label className="label">Provider</label>
                <select
                  className="select"
                  value={pickerProvider}
                  onChange={(e) => { setPickerProvider(e.target.value); setPickerModel(''); }}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {pickerProviderObj?.models && pickerProviderObj.models.length > 0 && (
                <div className="field">
                  <label className="label">Model</label>
                  <div className="model-grid">
                    <div
                      className={`model-item${!pickerModel ? ' model-item--selected' : ''}`}
                      onClick={() => setPickerModel('')}
                    >
                      Default
                    </div>
                    {pickerProviderObj.models.map((m) => (
                      <div
                        key={m.id}
                        className={`model-item${pickerModel === m.id ? ' model-item--selected' : ''}`}
                        onClick={() => setPickerModel(m.id)}
                      >
                        {m.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {isRunning && (pickerProvider !== session.provider_id || pickerModel !== (session.model ?? '')) && (
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  Changing provider or model will restart the session.
                </div>
              )}

              <button className="btn btn--primary btn--sm" onClick={applyProviderModel}>
                Apply
              </button>
            </div>
          )}
        </div>

        {session.allow_all_tools && (
          <span className="focus-header__badge focus-header__badge--warn">All Tools</span>
        )}
        {session.worktree && (
          <span className="worktree-badge">worktree</span>
        )}
        <span className="focus-header__cwd">{cwdDisplay}</span>

        <div className="focus-header__right">
          {tab === 'terminal' && isRunning && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={handleClear}
              title="Clear terminal display"
              style={{ padding: '4px 8px', fontSize: 14 }}
            >
              🧹
            </button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={() => onEdit(session)} title="Edit session">
            Edit
          </button>
          {isRunning && (
            <button
              className={`btn btn--sm ${confirmKill ? 'btn--danger' : 'btn--ghost'}`}
              onClick={handleKill}
              title={confirmKill ? 'Click again to confirm' : 'Kill session'}
            >
              {confirmKill ? 'Confirm Kill' : 'Kill'}
            </button>
          )}
        </div>
      </div>

      <div className="focus-tabs">
        <div className={`focus-tab${tab === 'terminal' ? ' focus-tab--active' : ''}`} onClick={() => setTab('terminal')}>Terminal</div>
        <div className={`focus-tab${tab === 'info' ? ' focus-tab--active' : ''}`} onClick={() => setTab('info')}>Info</div>
      </div>

      {/* Terminal — always mounted */}
      <div className="focus-body" style={{ display: tab === 'terminal' ? 'flex' : 'none' }}>
        {!isDone ? (
          <TerminalView
            ref={terminalRef}
            sessionId={session.id}
            onExit={() => onStatusChange(session.id, 'exited')}
          />
        ) : session.status === 'paused' ? (
          <div className="empty-state" style={{ height: '100%' }}>
            <div className="resuming-spinner" />
            <span className="empty-state__title">Resuming…</span>
            <span className="empty-state__desc">Loading your previous conversation</span>
          </div>
        ) : (
          <div className="empty-state" style={{ height: '100%' }}>
            <span className="empty-state__title">
              {session.status === 'failed' ? 'Session Failed' :
               session.status === 'cancelled' ? 'Session Cancelled' : 'Session Ended'}
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => onRemove(session.id)}>Dismiss</button>
          </div>
        )}
      </div>

      {tab === 'info' && (
        <div className="info-panel">
          <div className="info-group">
            <div className="info-group__label">Session</div>
            <div className="info-row"><span className="info-row__key">Name</span><span className="info-row__value">{session.name}</span></div>
            <div className="info-row"><span className="info-row__key">ID</span><span className="info-row__value" style={{ fontSize: 10, opacity: 0.6 }}>{session.id}</span></div>
            <div className="info-row">
              <span className="info-row__key">Status</span>
              <span className="info-row__value" style={{ textTransform: 'capitalize' }}>{session.status}</span>
            </div>
          </div>

          <div className="info-group">
            <div className="info-group__label">Provider</div>
            <div className="info-row"><span className="info-row__key">Name</span><span className="info-row__value">{provider?.name ?? session.provider_id}</span></div>
            <div className="info-row"><span className="info-row__key">CLI</span><span className="info-row__value">{provider?.cli ?? '—'}</span></div>
            {session.model && (
              <div className="info-row"><span className="info-row__key">Model</span><span className="info-row__value">{modelLabel ?? session.model}</span></div>
            )}
            {provider?.docUrl && (
              <div className="info-row"><span className="info-row__key">Docs</span><span className="info-row__value" style={{ fontSize: 10 }}>{provider.docUrl}</span></div>
            )}
          </div>

          <div className="info-group">
            <div className="info-group__label">Environment</div>
            <div className="info-row"><span className="info-row__key">Directory</span><span className="info-row__value">{session.cwd}</span></div>
            {session.worktree && (
              <div className="info-row">
                <span className="info-row__key">Worktree</span>
                <span className="info-row__value" style={{ fontSize: 10 }}>{session.worktree.path}</span>
              </div>
            )}
            <div className="info-row">
              <span className="info-row__key">All Tools</span>
              <span className="info-row__value" style={{ color: session.allow_all_tools ? 'var(--accent-red)' : 'var(--text-dim)' }}>
                {session.allow_all_tools ? 'Yes — skip-permissions active' : 'No'}
              </span>
            </div>
            <div className="info-row"><span className="info-row__key">Terminal</span><span className="info-row__value">{session.cols} × {session.rows}</span></div>
          </div>

          {skills.length > 0 && (
            <div className="info-group">
              <div className="info-group__label">Skills ({skills.length})</div>
              <div>
                {skills.map((sk) => (
                  <div key={sk.path} className="skill-item">
                    <span className={`skill-item__scope skill-item__scope--${sk.scope}`}>{sk.scope}</span>
                    <div>
                      <div className="skill-item__name">{sk.name}</div>
                      {sk.description && <div className="skill-item__desc">{sk.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {provider?.installCommand && (
            <div className="info-group">
              <div className="info-group__label">Install</div>
              <div className="info-row"><span className="info-row__key">Command</span><span className="info-row__value" style={{ fontSize: 11 }}>{provider.installCommand}</span></div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button className="btn btn--ghost btn--sm" onClick={() => onEdit(session)}>Edit Session</button>
            <button className="btn btn--ghost btn--sm" onClick={handleClear}>🧹 Clear</button>
            {isRunning && (
              <button className={`btn btn--sm ${confirmKill ? 'btn--danger' : 'btn--ghost'}`} onClick={handleKill}>
                {confirmKill ? 'Confirm Kill' : 'Kill Session'}
              </button>
            )}
            {!isRunning && (
              <button className="btn btn--ghost btn--sm" onClick={() => onRemove(session.id)}>Dismiss</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
