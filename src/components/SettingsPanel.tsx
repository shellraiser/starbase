import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppConfig, DEFAULT_APP_CONFIG } from '../types/integrations';
import GitHubSettings from './settings/GitHubSettings';
import SSHSettings from './settings/SSHSettings';
import MemorySettings from './settings/MemorySettings';
import ThemeSettings from './settings/ThemeSettings';
import ProfileSettings from './settings/ProfileSettings';
import GeneralSettings from './settings/GeneralSettings';

type Tab = 'general' | 'memory' | 'profiles' | 'theme' | 'github' | 'ssh';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'general',  label: 'General',  icon: '⊙' },
  { id: 'memory',   label: 'Memory',   icon: '⊛' },
  { id: 'profiles', label: 'Profiles', icon: '◫' },
  { id: 'theme',    label: 'Theme',    icon: '◐' },
  { id: 'github',   label: 'GitHub',   icon: '◈' },
  { id: 'ssh',      label: 'SSH',      icon: '⟡' },
];

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [config, setConfig] = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<AppConfig>('load_config').then(setConfig).catch(console.error);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await invoke('save_config', { config });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error('save_config failed:', e);
    } finally {
      setSaving(false);
    }
  }, [config]);

  return (
    <div className="settings-panel animate-in">
      <div className="settings-header">
        <span className="settings-header__title">Settings</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {saved && (
            <span style={{ fontSize: 11, color: 'var(--accent-green)', alignSelf: 'center' }}>
              Saved ✓
            </span>
          )}
          <button className="btn btn--primary btn--sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={onClose}>
            ← Back
          </button>
        </div>
      </div>

      <div className="settings-tabs">
        {TABS.map((t) => (
          <div
            key={t.id}
            className={`settings-tab${tab === t.id ? ' settings-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span>{t.icon}</span>
            {t.label}
          </div>
        ))}
      </div>

      <div className="settings-body">
        {tab === 'general' && (
          <GeneralSettings
            defaultCwd={config.default_cwd ?? ''}
            onChange={(default_cwd) => setConfig({ ...config, default_cwd })}
          />
        )}
        {tab === 'theme' && (
          <ThemeSettings
            config={config.theme}
            onChange={(theme) => setConfig({ ...config, theme })}
          />
        )}
        {tab === 'profiles' && (
          <ProfileSettings
            profiles={config.profiles}
            onChange={(profiles) => setConfig({ ...config, profiles })}
          />
        )}
        {tab === 'github' && (
          <GitHubSettings
            config={config.github}
            onChange={(github) => setConfig({ ...config, github })}
          />
        )}
        {tab === 'ssh' && (
          <SSHSettings
            config={config.ssh}
            onChange={(ssh) => setConfig({ ...config, ssh })}
          />
        )}
        {tab === 'memory' && (
          <MemorySettings
            config={config.memory}
            onChange={(memory) => setConfig({ ...config, memory })}
          />
        )}
      </div>
    </div>
  );
}
