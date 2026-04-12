import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SessionInfo, PROVIDER_MAP } from '../types';
import TerminalView from './TerminalView';

interface Props {
  session: SessionInfo;
  onRemove: (id: string) => void;
  onStatusChange: (id: string, status: SessionInfo['status']) => void;
  onClick: () => void;
}

export default function SessionCard({ session, onRemove, onStatusChange, onClick }: Props) {
  const [confirmKill, setConfirmKill] = useState(false);
  const provider = PROVIDER_MAP.get(session.provider_id);

  const handleKill = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirmKill) {
        setConfirmKill(true);
        setTimeout(() => setConfirmKill(false), 3000);
        return;
      }
      try {
        await invoke('kill_session', { sessionId: session.id });
        onRemove(session.id);
      } catch (err) {
        console.error('kill_session failed:', err);
      }
    },
    [confirmKill, session.id, onRemove]
  );

  return (
    <div
      className={`session-card${session.status === 'exited' ? ' session-card--exited' : ''}${session.status === 'failed' ? ' session-card--failed' : ''}${session.status === 'cancelled' ? ' session-card--cancelled' : ''}${session.status === 'paused' ? ' session-card--paused' : ''}`}
      onClick={onClick}
    >
      <div className="session-card__header">
        <div className={`session-card__dot session-card__dot--${session.status}`} />
        <span className="session-card__name">{session.name}</span>
        <span className="session-card__provider-badge">
          {provider?.name.split(' ')[0] ?? session.provider_id}
        </span>
        {session.allow_all_tools && (
          <span className="session-card__tools-badge">All Tools</span>
        )}
        <button
          className="session-card__close"
          onClick={handleKill}
          title={confirmKill ? 'Click again to confirm kill' : 'Kill session'}
        >
          {confirmKill ? '!' : '✕'}
        </button>
      </div>

      <div className="session-card__terminal">
        {session.status !== 'exited' ? (
          <TerminalView
            sessionId={session.id}
            onExit={() => onStatusChange(session.id, 'exited')}
          />
        ) : (
          <div
            className="empty-state"
            style={{ minHeight: 80, padding: 20, gap: 8 }}
          >
            <span className="empty-state__title" style={{ fontSize: 11 }}>
              Session Ended
            </span>
            <button
              className="btn btn--ghost btn--sm"
              onClick={(e) => { e.stopPropagation(); onRemove(session.id); }}
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
