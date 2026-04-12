import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { HistoryEntry } from '../types';
import { PROVIDER_MAP } from '../types';

interface Props {
  onClose: () => void;
  onRelaunch: (entry: HistoryEntry) => void;
}

export default function HistoryPanel({ onClose, onRelaunch }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<HistoryEntry[]>('load_history')
      .then((h) => setEntries([...h].reverse()))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const clearHistory = useCallback(async () => {
    await invoke('clear_history').catch(console.error);
    setEntries([]);
  }, []);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffH = diffMs / 3600000;
      if (diffH < 1) return `${Math.round(diffMs / 60000)}m ago`;
      if (diffH < 24) return `${Math.round(diffH)}h ago`;
      return d.toLocaleDateString();
    } catch { return iso; }
  };

  const statusColor = (s: string) => {
    if (s === 'exited' || s === 'completed') return 'var(--accent-green)';
    if (s === 'failed') return 'var(--accent-red)';
    if (s === 'paused') return 'var(--accent-blue)';
    return 'var(--text-dim)';
  };

  return (
    <div className="settings-panel animate-in">
      <div className="settings-header">
        <span className="settings-header__title">Session History</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {entries.length > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={clearHistory}>Clear</button>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onClose}>← Back</button>
        </div>
      </div>

      <div className="settings-body">
        {loading && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        )}

        {!loading && entries.length === 0 && (
          <div className="empty-state" style={{ padding: 32 }}>
            <div className="empty-state__title">No history yet</div>
            <div className="empty-state__desc">
              Sessions you dismiss or delete will appear here so you can relaunch them.
            </div>
          </div>
        )}

        {entries.map((entry) => {
          const provider = PROVIDER_MAP.get(entry.provider_id);
          const modelName = entry.model
            ? (provider?.models?.find((m) => m.id === entry.model)?.name ?? entry.model)
            : null;
          return (
            <div key={entry.id} className="history-entry">
              <div
                style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 3,
                  background: statusColor(entry.final_status),
                }}
              />
              <div className="history-entry__info">
                <div className="history-entry__name">{entry.name}</div>
                <div className="history-entry__meta">
                  {provider?.name ?? entry.provider_id}
                  {modelName && ` · ${modelName}`}
                  {entry.section_name && ` · ${entry.section_name}`}
                  {' · '}{entry.cwd.replace(/^\/Users\/[^/]+/, '~')}
                  {' · '}{formatTime(entry.ended_at)}
                </div>
              </div>
              <button
                className="btn btn--ghost btn--xs"
                onClick={() => onRelaunch(entry)}
                style={{ flexShrink: 0 }}
              >
                Relaunch
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
