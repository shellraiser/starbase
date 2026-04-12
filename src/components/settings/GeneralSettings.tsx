import { open } from '@tauri-apps/plugin-dialog';

interface Props {
  defaultCwd: string;
  onChange: (cwd: string) => void;
}

export default function GeneralSettings({ defaultCwd, onChange }: Props) {
  const browse = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Choose default workspace' });
    if (typeof selected === 'string' && selected) onChange(selected);
  };

  return (
    <div className="settings-section">
      <div className="settings-section__title">General</div>
      <div className="settings-section__desc">
        App-wide defaults applied when launching new sessions.
      </div>

      <div className="field">
        <label className="label">Default Workspace Directory</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className="input"
            placeholder="~  (falls back to home directory)"
            value={defaultCwd}
            onChange={(e) => onChange(e.target.value)}
            style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11 }}
          />
          <button className="btn btn--ghost btn--sm" onClick={browse} title="Browse…">
            Browse
          </button>
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, display: 'block' }}>
          New sessions will open here by default. Agent profiles and per-session overrides take priority.
        </span>
      </div>
    </div>
  );
}
