import { useState, useCallback, useRef } from 'react';
import { Section, SessionInfo, PROVIDER_MAP } from '../types';
import ContextMenu, { MenuItem } from './ContextMenu';

interface Props {
  sections: Section[];
  sessions: SessionInfo[];
  selectedId: string | null;
  view: 'sessions' | 'settings' | 'history';
  onSelectSession: (id: string) => void;
  onNewSession: (sectionId?: string) => void;
  onNewSection: () => void;
  onToggleSection: (id: string) => void;
  onRenameSection: (id: string, name: string) => void;
  onDeleteSection: (id: string) => void;
  onMoveSession: (sessionId: string, sectionId: string) => void;
  onEditSession: (session: SessionInfo) => void;
  onStopSession: (id: string) => void;
  onRestartSession: (id: string, resume?: boolean) => void;
  onDeleteSession: (id: string) => void;
  onShowSettings: () => void;
  onHideSettings: () => void;
  onShowHistory: () => void;
}

interface CtxState { x: number; y: number; type: 'session' | 'section'; id: string; }

export default function Sidebar({
  sections, sessions, selectedId, view,
  onSelectSession, onNewSession, onNewSection,
  onToggleSection, onRenameSection, onDeleteSection,
  onMoveSession, onEditSession, onStopSession, onRestartSession, onDeleteSession,
  onShowSettings, onHideSettings, onShowHistory,
}: Props) {
  const ungrouped = sessions.filter((s) => !sections.find((sec) => sec.id === s.section));
  const running = sessions.filter((s) => s.status === 'running').length;
  const needsAttention = sessions.filter((s) => s.status === 'failed' || s.status === 'paused').length;

  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = useState<string | null>(null);
  const [renamingSection, setRenamingSection] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const openCtx = useCallback((e: React.MouseEvent, type: 'session' | 'section', id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, type, id });
  }, []);

  const startRenameSection = useCallback((id: string) => {
    setRenamingSection(id);
    setTimeout(() => renameInputRef.current?.select(), 0);
  }, []);

  const commitRename = useCallback((id: string, value: string) => {
    if (value.trim()) onRenameSection(id, value.trim());
    setRenamingSection(null);
  }, [onRenameSection]);

  const ctxItems = useCallback((): MenuItem[] => {
    if (!ctx) return [];

    if (ctx.type === 'session') {
      const session = sessions.find((s) => s.id === ctx.id);
      if (!session) return [];
      const isRunning = session.status === 'running';
      const isPaused  = session.status === 'paused';
      return [
        { label: 'Edit…', icon: '✎', onClick: () => onEditSession(session) },
        { separator: true },
        ...(isRunning ? [
          { label: 'Stop',    icon: '◼', onClick: () => onStopSession(ctx.id) },
          { label: 'Restart', icon: '↺', onClick: () => onRestartSession(ctx.id) },
        ] : isPaused ? [
          { label: 'Resume',  icon: '▶', onClick: () => onRestartSession(ctx.id, true) },
        ] : [
          { label: 'Relaunch', icon: '↺', onClick: () => onRestartSession(ctx.id) },
        ]),
        { separator: true },
        { label: 'Move to…', icon: '⤴', disabled: true },
        ...sections.map((sec) => ({
          label: `  ${sec.name}`,
          disabled: sec.id === session.section,
          onClick: () => onMoveSession(ctx.id, sec.id),
        })),
        { separator: true },
        { label: 'Delete Session', icon: '✕', danger: true, onClick: () => onDeleteSession(ctx.id) },
      ];
    }

    const sec = sections.find((s) => s.id === ctx.id);
    return [
      { label: 'Rename', icon: '✎', onClick: () => startRenameSection(ctx.id) },
      { label: 'New Session Here', icon: '+', onClick: () => onNewSession(ctx.id) },
      { separator: true },
      {
        label: sec?.collapsed ? 'Expand' : 'Collapse',
        icon: sec?.collapsed ? '▶' : '▾',
        onClick: () => onToggleSection(ctx.id),
      },
      { separator: true },
      { label: 'Delete Section', icon: '✕', danger: true, onClick: () => onDeleteSection(ctx.id) },
    ];
  }, [ctx, sessions, sections, onEditSession, onMoveSession, onStopSession, onRestartSession, onDeleteSession, onNewSession, onToggleSection, startRenameSection]);

  const handleDragStart = useCallback((e: React.DragEvent, sessionId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(sessionId);
  }, []);
  const handleDragEnd = useCallback(() => { setDraggingId(null); setDragOverSection(null); }, []);
  const handleDragOver = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(sectionId);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, sectionId: string) => {
    e.preventDefault();
    if (draggingId) onMoveSession(draggingId, sectionId);
    setDraggingId(null);
    setDragOverSection(null);
  }, [draggingId, onMoveSession]);

  return (
    <aside className="sidebar">
      <div className="sidebar__actions">
        <button
          className="btn btn--accent-ghost btn--sm"
          style={{ flex: 1 }}
          onClick={() => onNewSession()}
          disabled={view === 'settings' || view === 'history'}
        >
          + Session
        </button>
        <button
          className="btn btn--ghost btn--sm"
          onClick={onNewSection}
          title="New section"
          disabled={view === 'settings' || view === 'history'}
        >
          ⊞
        </button>
      </div>

      <div className="sidebar__scroll">
        {sections.length === 0 && sessions.length === 0 && view === 'sessions' && (
          <div className="sidebar-empty">No sessions yet</div>
        )}

        {sections.map((sec) => {
          const ss = sessions.filter((s) => s.section === sec.id);
          const isOver = dragOverSection === sec.id;
          return (
            <div
              key={sec.id}
              onDragOver={(e) => handleDragOver(e, sec.id)}
              onDragLeave={() => setDragOverSection(null)}
              onDrop={(e) => handleDrop(e, sec.id)}
              className={isOver ? 'sidebar-drop-target' : ''}
            >
              <div
                className="sidebar-section-header"
                style={{ marginTop: 8 }}
                onContextMenu={(e) => openCtx(e, 'section', sec.id)}
              >
                <div className="sidebar-section-header__dot" style={{ background: sec.color }} />
                {renamingSection === sec.id ? (
                  <input
                    ref={renameInputRef}
                    className="sidebar-section-rename-input"
                    defaultValue={sec.name}
                    autoFocus
                    onBlur={(e) => commitRename(sec.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(sec.id, e.currentTarget.value);
                      if (e.key === 'Escape') setRenamingSection(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="sidebar-section-header__name"
                    onClick={() => onToggleSection(sec.id)}
                    onDoubleClick={() => startRenameSection(sec.id)}
                    title="Click to collapse · Double-click to rename · Right-click for options"
                  >
                    {sec.collapsed ? '▶' : '▾'} {sec.name}
                  </span>
                )}
                <span className="sidebar-section-header__count">{ss.length}</span>
                <button
                  className="btn btn--icon"
                  style={{ padding: '1px 4px', fontSize: 11 }}
                  onClick={(e) => { e.stopPropagation(); onNewSession(sec.id); }}
                  title="Add session"
                >
                  +
                </button>
              </div>

              {!sec.collapsed && (
                <>
                  {ss.length === 0 && (
                    <div className="sidebar-empty" style={{ paddingLeft: 20 }}>Empty</div>
                  )}
                  {ss.map((s) => (
                    <SessionRow
                      key={s.id}
                      session={s}
                      selected={s.id === selectedId}
                      dragging={s.id === draggingId}
                      onClick={() => onSelectSession(s.id)}
                      onContextMenu={(e) => openCtx(e, 'session', s.id)}
                      onDragStart={(e) => handleDragStart(e, s.id)}
                      onDragEnd={handleDragEnd}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}

        {ungrouped.length > 0 && (
          <div
            onDragOver={(e) => handleDragOver(e, '__ungrouped__')}
            onDragLeave={() => setDragOverSection(null)}
            onDrop={(e) => { e.preventDefault(); }}
          >
            <div className="sidebar-section-header" style={{ marginTop: 8 }}>
              <div className="sidebar-section-header__dot" style={{ background: 'var(--text-dim)' }} />
              <span className="sidebar-section-header__name" style={{ cursor: 'default' }}>Unsectioned</span>
              <span className="sidebar-section-header__count">{ungrouped.length}</span>
            </div>
            {ungrouped.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                selected={s.id === selectedId}
                dragging={s.id === draggingId}
                onClick={() => onSelectSession(s.id)}
                onContextMenu={(e) => openCtx(e, 'session', s.id)}
                onDragStart={(e) => handleDragStart(e, s.id)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}
      </div>

      <div className="sidebar__nav">
        <div
          className={`sidebar-nav-item${view === 'history' ? ' sidebar-nav-item--active' : ''}`}
          onClick={view === 'history' ? onHideSettings : onShowHistory}
        >
          <span className="sidebar-nav-item__icon">◷</span>
          History
        </div>
        <div
          className={`sidebar-nav-item${view === 'settings' ? ' sidebar-nav-item--active' : ''}`}
          onClick={view === 'settings' ? onHideSettings : onShowSettings}
        >
          <span className="sidebar-nav-item__icon">⚙</span>
          Settings
          {needsAttention > 0 && view !== 'settings' && (
            <span className="attention-badge" style={{ marginLeft: 'auto' }}>{needsAttention}</span>
          )}
        </div>
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__version">
          {running > 0 ? `${running} running · ` : ''}Starbase v0.1.0
        </div>
      </div>

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          items={ctxItems()}
          onClose={() => setCtx(null)}
        />
      )}
    </aside>
  );
}

function SessionRow({
  session, selected, dragging, onClick, onContextMenu, onDragStart, onDragEnd,
}: {
  session: SessionInfo;
  selected: boolean;
  dragging: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const provider = PROVIDER_MAP.get(session.provider_id);
  const modelShort = session.model
    ? (provider?.models?.find((m) => m.id === session.model)?.name ?? session.model.split('-').slice(-2).join(' '))
    : null;

  return (
    <div
      className={`sidebar-session-row${selected ? ' sidebar-session-row--selected' : ''}${dragging ? ' sidebar-session-row--dragging' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={`sidebar-session-row__dot sidebar-session-row__dot--${session.status}`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="sidebar-session-row__name">{session.name}</div>
        {modelShort && <div className="sidebar-session-row__model">{modelShort}</div>}
        {session.worktree && (
          <div style={{ marginTop: 1 }}>
            <span className="worktree-badge">worktree</span>
          </div>
        )}
      </div>
      <span className="sidebar-session-row__provider">
        {provider?.name.split(' ')[0] ?? session.provider_id}
      </span>
    </div>
  );
}
