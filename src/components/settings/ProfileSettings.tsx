import { useState, useCallback } from 'react';
import { AgentProfile } from '../../types/integrations';
import { PROVIDERS, PROVIDER_MAP, SECTION_COLORS } from '../../types';

interface Props {
  profiles: AgentProfile[];
  onChange: (profiles: AgentProfile[]) => void;
}

const BLANK: Omit<AgentProfile, 'id'> = {
  name: '',
  provider_id: 'claude',
  model: undefined,
  allow_all_tools: false,
  default_cwd: '',
  color: SECTION_COLORS[0],
};

export default function ProfileSettings({ profiles, onChange }: Props) {
  const [form, setForm] = useState<Omit<AgentProfile, 'id'>>({ ...BLANK });
  const [editingId, setEditingId] = useState<string | null>(null);

  const provider = PROVIDER_MAP.get(form.provider_id);

  const save = useCallback(() => {
    if (!form.name.trim()) return;
    if (editingId) {
      onChange(profiles.map((p) => p.id === editingId ? { ...form, id: editingId } : p));
      setEditingId(null);
    } else {
      onChange([...profiles, { ...form, id: crypto.randomUUID() }]);
    }
    setForm({ ...BLANK });
  }, [form, editingId, profiles, onChange]);

  const remove = useCallback((id: string) => {
    onChange(profiles.filter((p) => p.id !== id));
  }, [profiles, onChange]);

  const startEdit = useCallback((profile: AgentProfile) => {
    setEditingId(profile.id);
    setForm({
      name: profile.name,
      provider_id: profile.provider_id,
      model: profile.model,
      allow_all_tools: profile.allow_all_tools,
      default_cwd: profile.default_cwd ?? '',
      color: profile.color ?? SECTION_COLORS[0],
    });
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-section__title">Agent Profiles</div>
      <div className="settings-section__desc">
        Saved presets for quickly launching sessions. Pick a profile in the new session dialog
        to pre-fill the provider, model, and permissions — then tweak as needed.
      </div>

      {/* Profile list */}
      {profiles.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '4px 0' }}>
          No profiles yet. Create one below.
        </div>
      )}

      {profiles.map((p) => {
        const prov = PROVIDER_MAP.get(p.provider_id);
        const modelName = p.model
          ? (prov?.models?.find((m) => m.id === p.model)?.name ?? p.model)
          : 'Default model';
        return (
          <div key={p.id} className="profile-item">
            <div className="profile-item__dot" style={{ background: p.color ?? 'var(--text-dim)' }} />
            <div className="profile-item__info">
              <div className="profile-item__name">{p.name}</div>
              <div className="profile-item__meta">
                {prov?.name ?? p.provider_id} · {modelName}
                {p.allow_all_tools && ' · All Tools'}
                {p.default_cwd && ` · ${p.default_cwd}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
              <button className="btn btn--ghost btn--xs" onClick={() => startEdit(p)}>Edit</button>
              <button className="btn btn--danger btn--xs" onClick={() => remove(p.id)}>Remove</button>
            </div>
          </div>
        );
      })}

      {/* Form */}
      <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label" style={{ color: 'var(--text-accent)' }}>
          {editingId ? 'Edit Profile' : 'New Profile'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="field">
            <label className="label">Profile Name</label>
            <input
              className="input"
              placeholder="e.g. Claude Opus — No Restrictions"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label">Default Directory (optional)</label>
            <input
              className="input"
              placeholder="~/projects/myapp"
              value={form.default_cwd ?? ''}
              onChange={(e) => setForm({ ...form, default_cwd: e.target.value || undefined })}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            />
          </div>
        </div>

        <div className="field">
          <label className="label">Provider</label>
          <select
            className="select"
            value={form.provider_id}
            onChange={(e) => setForm({ ...form, provider_id: e.target.value, model: undefined })}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.cli})</option>
            ))}
          </select>
        </div>

        {provider?.models && provider.models.length > 0 && (
          <div className="field">
            <label className="label">Model</label>
            <div className="model-grid">
              <div
                className={`model-item${!form.model ? ' model-item--selected' : ''}`}
                onClick={() => setForm({ ...form, model: undefined })}
              >
                Default
              </div>
              {provider.models.map((m) => (
                <div
                  key={m.id}
                  className={`model-item${form.model === m.id ? ' model-item--selected' : ''}`}
                  onClick={() => setForm({ ...form, model: m.id })}
                >
                  {m.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label className="label">Color</label>
          <div className="color-swatches">
            {SECTION_COLORS.map((c) => (
              <div
                key={c}
                className={`color-swatch${form.color === c ? ' color-swatch--selected' : ''}`}
                style={{ background: c }}
                onClick={() => setForm({ ...form, color: c })}
              />
            ))}
          </div>
        </div>

        <label className={`toggle${form.allow_all_tools ? ' toggle--warn' : ''}`}>
          <input
            type="checkbox"
            checked={form.allow_all_tools}
            onChange={(e) => setForm({ ...form, allow_all_tools: e.target.checked })}
          />
          <div style={{ flex: 1 }}>
            <div className="toggle__label">Allow All Tools</div>
            <div className="toggle__desc">Pre-enable the auto-approve flag for this profile</div>
          </div>
        </label>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={save}
            disabled={!form.name.trim()}
          >
            {editingId ? 'Update' : 'Save Profile'}
          </button>
          {editingId && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setEditingId(null); setForm({ ...BLANK }); }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
