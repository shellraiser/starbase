import { useRef, useState } from 'react';
import { ThemeConfig, ThemePreset, BUILT_IN_THEMES, THEME_VAR_KEYS } from '../../types/integrations';

interface Props {
  config: ThemeConfig;
  onChange: (c: ThemeConfig) => void;
}

// CSS defaults (Starbase theme) — used as fallbacks when a theme omits a var
const D: Record<string, string> = {
  '--bg-app':      '#0d0d12',
  '--bg-surface':  '#131318',
  '--bg-elevated': '#1a1a22',
  '--accent':      '#FF9900',
  '--border-mid':  'rgba(255,153,0,0.28)',
  '--border-dim':  'rgba(255,255,255,0.05)',
  '--text':        '#c8c8d8',
  '--text-dim':    '#4a4a60',
  '--text-muted':  '#6a6a80',
  '--text-accent': '#FF9900',
};

function v(theme: ThemePreset, key: string): string {
  return theme.vars[key] ?? D[key] ?? '';
}

/** Mini app-chrome preview rendered with hardcoded inline colours so it's always
 *  correct regardless of which theme is currently active in the document. */
function ThemeMiniPreview({ theme }: { theme: ThemePreset }) {
  const bgApp     = v(theme, '--bg-app');
  const bgSurface = v(theme, '--bg-surface');
  const accent    = v(theme, '--accent');
  const borderMid = v(theme, '--border-mid');
  const text      = v(theme, '--text');
  const textDim   = v(theme, '--text-dim');
  const textMuted = v(theme, '--text-muted');

  return (
    <div style={{ display: 'flex', height: '100%', background: bgApp, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: 32, background: bgSurface,
        borderRight: `1px solid ${borderMid}`,
        display: 'flex', flexDirection: 'column', gap: 3, padding: '5px 4px',
      }}>
        {/* Section dot + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <div style={{ height: 2, flex: 1, borderRadius: 1, background: textDim, opacity: 0.6 }} />
        </div>
        {/* Session rows */}
        {[0.7, 0.5, 0.35].map((op, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2, paddingLeft: 2 }}>
            <div style={{ width: 3, height: 3, borderRadius: '50%', background: i === 0 ? accent : textDim, opacity: op, flexShrink: 0 }} />
            <div style={{ height: 2, flex: 1, borderRadius: 1, background: textDim, opacity: op * 0.7 }} />
          </div>
        ))}
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <div style={{
          height: 14, background: bgSurface,
          borderBottom: `1px solid ${borderMid}`,
          display: 'flex', alignItems: 'center', padding: '0 5px', gap: 4,
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent, opacity: 0.8 }} />
          <div style={{ height: 2, width: 24, borderRadius: 1, background: text, opacity: 0.5 }} />
          <div style={{ flex: 1 }} />
          <div style={{ height: 2, width: 12, borderRadius: 1, background: textDim, opacity: 0.5 }} />
        </div>
        {/* Terminal-like content */}
        <div style={{ flex: 1, padding: '4px 5px', display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'monospace' }}>
          <div style={{ height: 2, width: '75%', borderRadius: 1, background: text, opacity: 0.45 }} />
          <div style={{ height: 2, width: '55%', borderRadius: 1, background: accent, opacity: 0.55 }} />
          <div style={{ height: 2, width: '90%', borderRadius: 1, background: textMuted, opacity: 0.4 }} />
          <div style={{ height: 2, width: '40%', borderRadius: 1, background: text, opacity: 0.3 }} />
        </div>
      </div>
    </div>
  );
}

/** Immediately write theme vars to the document for a live preview.
 *  App.tsx resets these from disk when settings are closed without saving. */
function previewTheme(vars: Record<string, string>) {
  const root = document.documentElement;
  THEME_VAR_KEYS.forEach(k => root.style.removeProperty(k));
  Object.entries(vars).forEach(([k, val]) => root.style.setProperty(k, val));
}

export default function ThemeSettings({ config, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState('');

  const customVarCount = Object.keys(config.custom).length;

  const applyPreset = (id: string) => {
    const preset = BUILT_IN_THEMES.find(t => t.id === id);
    previewTheme(preset?.vars ?? {});
    onChange({ ...config, preset: id, custom: {} });
  };

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const raw = parsed.variables ?? parsed.vars ?? parsed;
        const filtered: Record<string, string> = {};
        for (const key of Object.keys(raw)) {
          if (key.startsWith('--')) filtered[key] = String(raw[key]);
        }
        previewTheme(filtered);
        onChange({ preset: 'custom', custom: filtered });
        setPasteError('');
      } catch {
        setPasteError('Invalid JSON theme file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteApply = () => {
    try {
      const parsed = JSON.parse(pasteValue);
      const raw = parsed.variables ?? parsed.vars ?? parsed;
      const filtered: Record<string, string> = {};
      for (const key of Object.keys(raw)) {
        if (key.startsWith('--')) filtered[key] = String(raw[key]);
      }
      previewTheme(filtered);
      onChange({ preset: 'custom', custom: filtered });
      setPasteError('');
      setPasteValue('');
    } catch {
      setPasteError('Invalid JSON. Expected an object with CSS variable keys (e.g. "--accent").');
    }
  };

  const exportCurrent = () => {
    const preset = BUILT_IN_THEMES.find(t => t.id === config.preset);
    const vars = { ...(preset?.vars ?? {}), ...config.custom };
    const json = JSON.stringify({ name: preset?.name ?? 'Custom', variables: vars }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'starbase-theme.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="settings-section">
      <div className="settings-section__title">Theme</div>
      <div className="settings-section__desc">
        Choose a built-in colour scheme or load your own. Clicking a theme previews it
        instantly — hit Save to make it permanent.
      </div>

      {/* Built-in presets */}
      <div className="label">Built-in Themes</div>
      <div className="theme-card-grid">
        {BUILT_IN_THEMES.map((t) => {
          const active = config.preset === t.id && customVarCount === 0;
          const accent = v(t, '--accent');
          return (
            <div
              key={t.id}
              className={`theme-card${active ? ' theme-card--active' : ''}`}
              style={{ borderColor: active ? accent : undefined }}
              onClick={() => applyPreset(t.id)}
              title={t.name}
            >
              <div className="theme-card__preview">
                <ThemeMiniPreview theme={t} />
              </div>
              <div className="theme-card__label" style={{ background: v(t, '--bg-elevated') }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
                <span style={{ color: v(t, '--text'), fontSize: 11, fontWeight: 500, flex: 1 }}>{t.name}</span>
                {active && <span style={{ color: accent, fontSize: 10 }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="divider" />

      {/* Custom theme */}
      <div className="label" style={{ color: 'var(--text-accent)' }}>Custom Theme</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn--ghost btn--sm" onClick={() => fileInputRef.current?.click()}>
          Load from file…
        </button>
        <button className="btn btn--ghost btn--sm" onClick={exportCurrent}>
          Export current
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.starbase-theme"
          style={{ display: 'none' }}
          onChange={handleFileLoad}
        />
      </div>

      <div className="field">
        <label className="label">Paste theme JSON</label>
        <textarea
          className="textarea"
          rows={6}
          placeholder={'{\n  "variables": {\n    "--accent": "#FF00FF",\n    "--bg-app": "#110011"\n  }\n}'}
          value={pasteValue}
          onChange={(e) => setPasteValue(e.target.value)}
          style={{ fontSize: 11 }}
        />
        {pasteError && (
          <span style={{ fontSize: 11, color: 'var(--accent-red)' }}>{pasteError}</span>
        )}
        <button
          className="btn btn--ghost btn--sm"
          onClick={handlePasteApply}
          disabled={!pasteValue.trim()}
          style={{ alignSelf: 'flex-start' }}
        >
          Apply
        </button>
      </div>

      {customVarCount > 0 && (
        <div style={{
          padding: '8px 10px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-dim)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          Custom theme active — {customVarCount} variable{customVarCount !== 1 ? 's' : ''} overridden.{' '}
          <span
            style={{ color: 'var(--text-accent)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => { previewTheme({}); onChange({ ...config, preset: 'starbase', custom: {} }); }}
          >
            Reset to default
          </span>
        </div>
      )}

      <div className="divider" />

      <div className="label">Available Variables</div>
      <div style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)',
        lineHeight: 1.8,
        maxHeight: 160,
        overflowY: 'auto',
      }}>
        {THEME_VAR_KEYS.map(k => <div key={k}>{k}</div>)}
      </div>
    </div>
  );
}
