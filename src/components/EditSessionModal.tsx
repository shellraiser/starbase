import { useState, useCallback } from 'react';
import { SessionInfo, Section, PROVIDERS, PROVIDER_MAP, Provider } from '../types';

interface Props {
  session: SessionInfo;
  sections: Section[];
  onSave: (updates: Partial<SessionInfo> & { restart?: boolean }) => void;
  onCancel: () => void;
}

export default function EditSessionModal({ session, sections, onSave, onCancel }: Props) {
  const [name, setName] = useState(session.name);
  const [providerId, setProviderId] = useState(session.provider_id);
  const [model, setModel] = useState(session.model ?? '');
  const [sectionId, setSectionId] = useState(session.section);
  const [allowAllTools, setAllowAllTools] = useState(session.allow_all_tools);

  const provider = PROVIDER_MAP.get(providerId) as Provider | undefined;
  const originalProvider = PROVIDER_MAP.get(session.provider_id);

  const providerChanged = providerId !== session.provider_id;
  const modelChanged = model !== (session.model ?? '');
  const needsRestart = (providerChanged || modelChanged) && session.status === 'running';

  const handleSave = useCallback(() => {
    const selectedModel = model || undefined;
    onSave({
      name: name.trim() || session.name,
      provider_id: providerId,
      model: selectedModel,
      section: sectionId,
      allow_all_tools: allowAllTools,
      restart: needsRestart,
    });
  }, [name, providerId, model, sectionId, allowAllTools, needsRestart, session.name, onSave]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal animate-in" style={{ width: 480 }}>
        <div className="modal__header">
          <span className="modal__title">Edit Session</span>
          <button className="modal__close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal__body">
          {/* Name */}
          <div className="field">
            <label className="label">Session Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Provider */}
          <div className="field">
            <label className="label">CLI Provider</label>
            <select
              className="select"
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                setModel('');
              }}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.cli})</option>
              ))}
            </select>
          </div>

          {/* Model (if provider has models) */}
          {provider?.models && provider.models.length > 0 && (
            <div className="field">
              <label className="label">Model</label>
              <select
                className="select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="">Default</option>
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Section */}
          {sections.length > 0 && (
            <div className="field">
              <label className="label">Section</label>
              <select
                className="select"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
              >
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

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
                Passes the provider's auto-approve flag — agent will not prompt before running tools
              </div>
            </div>
          </label>

          {/* Restart warning */}
          {needsRestart && (
            <div style={{
              padding: '9px 12px',
              background: 'color-mix(in srgb, var(--accent) 8%, var(--bg-surface))',
              border: '1px solid var(--accent-dim)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--text-muted)',
            }}>
              ⚠ Changing the {providerChanged ? 'provider' : 'model'} will{' '}
              <strong style={{ color: 'var(--text-accent)' }}>kill and restart</strong> the running session.
              {originalProvider && providerId !== session.provider_id && (
                <> {originalProvider.name} → {provider?.name}</>
              )}
            </div>
          )}
        </div>

        <div className="modal__footer">
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>Cancel</button>
          <button className="btn btn--primary btn--sm" onClick={handleSave}>
            {needsRestart ? 'Save & Restart' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
