import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MemoryConfig, MemoryEntry, MemoryProviderType, MEMORY_PROVIDERS } from '../../types/integrations';
import { PROVIDERS } from '../../types';

interface Props {
  config: MemoryConfig;
  onChange: (c: MemoryConfig) => void;
}

const BLANK_ENTRY: Omit<MemoryEntry, 'id'> = {
  name: '',
  provider: 'mempalace',
  cli_path: 'mempalace',
  cli_search_args: ['search'],
  mcp_url: '',
  inject_into_prompt: true,
  assigned_cli_ids: [],
};

const PROVIDER_TYPE_LABELS: Record<MemoryProviderType, string> = {
  mempalace: 'MemPalace',
  custom_cli: 'Custom CLI',
  mcp_server: 'MCP Server',
};

export default function MemorySettings({ config, onChange }: Props) {
  const [form, setForm] = useState<Omit<MemoryEntry, 'id'>>({ ...BLANK_ENTRY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testProviderId, setTestProviderId] = useState(PROVIDERS[0].id);
  const [testResult, setTestResult] = useState('');
  const [testing, setTesting] = useState(false);

  const saveEntry = useCallback(() => {
    if (!form.name.trim()) return;
    if (editingId) {
      onChange({
        ...config,
        entries: config.entries.map(e => e.id === editingId ? { ...form, id: editingId } : e),
      });
      setEditingId(null);
    } else {
      onChange({
        ...config,
        entries: [...config.entries, { ...form, id: crypto.randomUUID() }],
      });
    }
    setForm({ ...BLANK_ENTRY });
  }, [form, editingId, config, onChange]);

  const removeEntry = useCallback((id: string) => {
    onChange({ ...config, entries: config.entries.filter(e => e.id !== id) });
  }, [config, onChange]);

  const startEdit = useCallback((entry: MemoryEntry) => {
    setEditingId(entry.id);
    setForm({
      name: entry.name,
      provider: entry.provider,
      cli_path: entry.cli_path,
      cli_search_args: entry.cli_search_args,
      mcp_url: entry.mcp_url,
      inject_into_prompt: entry.inject_into_prompt,
      assigned_cli_ids: entry.assigned_cli_ids,
    });
  }, []);

  const toggleCliAssignment = useCallback((cliId: string) => {
    setForm(f => ({
      ...f,
      assigned_cli_ids: f.assigned_cli_ids.includes(cliId)
        ? f.assigned_cli_ids.filter(id => id !== cliId)
        : [...f.assigned_cli_ids, cliId],
    }));
  }, []);

  const runTest = async () => {
    if (!testQuery.trim()) return;
    setTesting(true);
    setTestResult('');
    try {
      const result = await invoke<string>('memory_search', {
        query: testQuery,
        providerId: testProviderId,
      });
      setTestResult(result || '(no results returned)');
    } catch (e: any) {
      setTestResult(`Error: ${e}`);
    } finally {
      setTesting(false);
    }
  };

  const isCli = form.provider === 'mempalace' || form.provider === 'custom_cli';

  return (
    <div className="settings-section">
      <div className="settings-section__title">Memory Providers</div>
      <div className="settings-section__desc">
        Configure one or more memory providers. Assign each to specific CLI agents, or leave
        unassigned to use as a fallback for any agent without an explicit entry. At session launch,
        Starbase queries the matched provider and optionally prepends the results to the initial prompt.
      </div>

      {/* Global enable */}
      <label className="toggle">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
        />
        <div style={{ flex: 1 }}>
          <div className="toggle__label">Enable memory integration</div>
          <div className="toggle__desc">Query memory providers before launching sessions</div>
        </div>
      </label>

      {/* Entry list */}
      {config.entries.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '4px 0' }}>
          No providers yet. Add one below.
        </div>
      ) : (
        config.entries.map(entry => {
          const assignedNames = entry.assigned_cli_ids.length > 0
            ? entry.assigned_cli_ids
                .map(id => PROVIDERS.find(p => p.id === id)?.name ?? id)
                .join(', ')
            : 'Default (all unassigned)';

          return (
            <div key={entry.id} className="profile-item">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="profile-item__name">{entry.name}</div>
                <div className="profile-item__meta">
                  {PROVIDER_TYPE_LABELS[entry.provider]}
                  {(entry.provider === 'mempalace' || entry.provider === 'custom_cli') && (
                    <> · <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{entry.cli_path}</code></>
                  )}
                  {entry.provider === 'mcp_server' && entry.mcp_url && (
                    <> · <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{entry.mcp_url}</code></>
                  )}
                  {' · '}{assignedNames}
                  {entry.inject_into_prompt && ' · Injects context'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button className="btn btn--ghost btn--xs" onClick={() => startEdit(entry)}>Edit</button>
                <button className="btn btn--danger btn--xs" onClick={() => removeEntry(entry.id)}>Remove</button>
              </div>
            </div>
          );
        })
      )}

      {/* Add / Edit form */}
      <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label" style={{ color: 'var(--text-accent)' }}>
          {editingId ? 'Edit Provider' : 'New Provider'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="field">
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. MemPalace — Claude"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="label">Type</label>
            <select
              className="select"
              value={form.provider}
              onChange={e => {
                const p = e.target.value as MemoryProviderType;
                setForm({
                  ...form, provider: p,
                  cli_path: p === 'mempalace' ? 'mempalace' : form.cli_path,
                  cli_search_args: p === 'mempalace' ? ['search'] : form.cli_search_args,
                });
              }}
            >
              {MEMORY_PROVIDERS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {isCli && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="field">
              <label className="label">CLI Path</label>
              <input
                className="input"
                placeholder="mempalace"
                value={form.cli_path}
                onChange={e => setForm({ ...form, cli_path: e.target.value })}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
              />
            </div>
            <div className="field">
              <label className="label">Search Arguments</label>
              <input
                className="input"
                placeholder="search"
                value={form.cli_search_args.join(' ')}
                onChange={e => setForm({ ...form, cli_search_args: e.target.value.split(/\s+/).filter(Boolean) })}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                Runs: {form.cli_path || 'cli'} {form.cli_search_args.join(' ')} &lt;query&gt;
              </span>
            </div>
          </div>
        )}

        {form.provider === 'mcp_server' && (
          <div className="field">
            <label className="label">MCP Server URL</label>
            <input
              className="input"
              placeholder="http://localhost:8080/search"
              value={form.mcp_url}
              onChange={e => setForm({ ...form, mcp_url: e.target.value })}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
            />
          </div>
        )}

        {/* CLI assignment */}
        <div className="field">
          <label className="label">Assigned CLI Agents</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <div
              className={`model-item${form.assigned_cli_ids.length === 0 ? ' model-item--selected' : ''}`}
              onClick={() => setForm({ ...form, assigned_cli_ids: [] })}
            >
              Default (all)
            </div>
            {PROVIDERS.map(p => (
              <div
                key={p.id}
                className={`model-item${form.assigned_cli_ids.includes(p.id) ? ' model-item--selected' : ''}`}
                onClick={() => toggleCliAssignment(p.id)}
              >
                {p.name}
              </div>
            ))}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, display: 'block' }}>
            "Default" is used for any agent not explicitly assigned to another provider.
          </span>
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={form.inject_into_prompt}
            onChange={e => setForm({ ...form, inject_into_prompt: e.target.checked })}
          />
          <div style={{ flex: 1 }}>
            <div className="toggle__label">Inject memory into initial prompt</div>
            <div className="toggle__desc">Prepends retrieved context to the session's starting prompt</div>
          </div>
        </label>

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={saveEntry}
            disabled={!form.name.trim()}
          >
            {editingId ? 'Update' : 'Add Provider'}
          </button>
          {editingId && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setEditingId(null); setForm({ ...BLANK_ENTRY }); }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* MemPalace setup guide */}
      {(form.provider === 'mempalace' || config.entries.some(e => e.provider === 'mempalace')) && (
        <>
          <div className="divider" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="label">MemPalace Setup</div>
            <button
              className="btn btn--ghost btn--xs"
              onClick={() => setShowSetup(s => !s)}
            >
              {showSetup ? 'Hide' : 'Show'}
            </button>
          </div>
          {showSetup && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              <div>
                <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>1. Install</div>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 3, display: 'block' }}>pip install mempalace</code>
              </div>
              <div>
                <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>2. Initialise a memory palace for your project</div>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 3, display: 'block' }}>mempalace init ~/projects/myapp</code>
              </div>
              <div>
                <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>3. Mine existing conversations or project files into memory</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 3, display: 'block' }}>mempalace mine ~/projects/myapp</code>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 3, display: 'block' }}>mempalace mine ~/chats/ --mode convos</code>
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-dim)', marginBottom: 3 }}>4. (Claude Code only) Install the native plugin for in-session access</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 3, display: 'block' }}>claude plugin marketplace add milla-jovovich/mempalace</code>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-input)', padding: '3px 8px', borderRadius: 3, display: 'block' }}>claude plugin install --scope user mempalace</code>
                </div>
              </div>
              <div style={{
                background: 'color-mix(in srgb, var(--accent) 6%, var(--bg-surface))',
                border: '1px solid var(--border-dim)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 10px',
              }}>
                <div style={{ color: 'var(--text-accent)', fontWeight: 600, marginBottom: 4 }}>CLI compatibility</div>
                <div>
                  Starbase's pre-launch context injection (<code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>mempalace search</code>) works with <strong>any CLI agent</strong>.
                  The native Claude Code plugin (step 4) adds in-session memory tools and is only useful for Claude Code sessions — assign this provider to Claude Code specifically if you want both.
                  For Gemini, Codex, and others, pre-launch injection is the full integration.
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Test section */}
      {config.entries.length > 0 && (
        <>
          <div className="divider" />
          <div className="label" style={{ color: 'var(--text-accent)' }}>Test Memory Search</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="label">Query</label>
              <input
                className="input"
                placeholder="e.g. authentication patterns"
                value={testQuery}
                onChange={e => setTestQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && runTest()}
              />
            </div>
            <div className="field" style={{ width: 160 }}>
              <label className="label">Simulate agent</label>
              <select
                className="select"
                value={testProviderId}
                onChange={e => setTestProviderId(e.target.value)}
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={runTest}
              disabled={testing || !testQuery.trim()}
              style={{ flexShrink: 0 }}
            >
              {testing ? 'Searching…' : 'Search'}
            </button>
          </div>
          {testResult && (
            <div style={{
              background: 'var(--bg-input)', border: '1px solid var(--border-dim)',
              borderRadius: 'var(--radius-sm)', padding: 10,
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--text)', whiteSpace: 'pre-wrap',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {testResult}
            </div>
          )}
        </>
      )}
    </div>
  );
}
