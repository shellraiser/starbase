import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SshConfig, SshConnection, SshAuthType } from '../../types/integrations';

interface Props {
  config: SshConfig;
  onChange: (c: SshConfig) => void;
}

const BLANK: Omit<SshConnection, 'id'> = {
  name: '',
  host: '',
  port: 22,
  username: '',
  auth_type: 'agent',
  key_path: undefined,
};

export default function SSHSettings({ config, onChange }: Props) {
  const [form, setForm] = useState<Omit<SshConnection, 'id'>>({ ...BLANK });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});

  const save = useCallback(() => {
    if (!form.name || !form.host || !form.username) return;
    if (editingId) {
      onChange({
        connections: config.connections.map((c) =>
          c.id === editingId ? { ...form, id: editingId } : c
        ),
      });
      setEditingId(null);
    } else {
      onChange({
        connections: [
          ...config.connections,
          { ...form, id: crypto.randomUUID() },
        ],
      });
    }
    setForm({ ...BLANK });
  }, [form, editingId, config, onChange]);

  const remove = useCallback((id: string) => {
    onChange({ connections: config.connections.filter((c) => c.id !== id) });
  }, [config, onChange]);

  const startEdit = useCallback((conn: SshConnection) => {
    setEditingId(conn.id);
    setForm({ name: conn.name, host: conn.host, port: conn.port, username: conn.username, auth_type: conn.auth_type, key_path: conn.key_path });
  }, []);

  const testConn = useCallback(async (conn: SshConnection) => {
    setTesting(conn.id);
    try {
      const result = await invoke<string>('ssh_test_connection', {
        host: conn.host,
        port: conn.port,
        username: conn.username,
        keyPath: conn.key_path ?? null,
      });
      setTestResult((r) => ({ ...r, [conn.id]: `✓ ${result}` }));
    } catch (e: any) {
      setTestResult((r) => ({ ...r, [conn.id]: `✗ ${e}` }));
    } finally {
      setTesting(null);
    }
  }, []);

  return (
    <div className="settings-section">
      <div className="settings-section__title">SSH Connections</div>
      <div className="settings-section__desc">
        Saved SSH connections let you launch agent sessions on remote machines.
        Sessions will be run via <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>ssh -t</code> through the configured host.
      </div>

      {/* Connection list */}
      {config.connections.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 0' }}>
          No connections saved yet.
        </div>
      )}

      {config.connections.map((conn) => (
        <div key={conn.id} className="ssh-connection-item">
          <div className="ssh-connection-item__info">
            <div className="ssh-connection-item__name">{conn.name}</div>
            <div className="ssh-connection-item__addr">
              {conn.username}@{conn.host}:{conn.port} · {conn.auth_type}
            </div>
            {testResult[conn.id] && (
              <div style={{
                fontSize: 10,
                color: testResult[conn.id].startsWith('✓') ? 'var(--accent-green)' : 'var(--accent-red)',
                marginTop: 3,
                fontFamily: 'var(--font-mono)',
              }}>
                {testResult[conn.id]}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            <button
              className="btn btn--ghost btn--xs"
              onClick={() => testConn(conn)}
              disabled={testing === conn.id}
            >
              {testing === conn.id ? '…' : 'Test'}
            </button>
            <button className="btn btn--ghost btn--xs" onClick={() => startEdit(conn)}>Edit</button>
            <button className="btn btn--danger btn--xs" onClick={() => remove(conn.id)}>Remove</button>
          </div>
        </div>
      ))}

      {/* Add / edit form */}
      <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="label" style={{ color: 'var(--text-accent)' }}>
          {editingId ? 'Edit Connection' : 'Add Connection'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="field">
            <label className="label">Name</label>
            <input className="input" placeholder="e.g. Dev Server" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Host</label>
            <input className="input" placeholder="192.168.1.10 or hostname" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Username</label>
            <input className="input" placeholder="ubuntu" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div className="field">
            <label className="label">Port</label>
            <input className="input" type="number" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
          </div>
        </div>

        <div className="field">
          <label className="label">Auth Type</label>
          <select className="select" value={form.auth_type} onChange={(e) => setForm({ ...form, auth_type: e.target.value as SshAuthType })}>
            <option value="agent">SSH Agent (recommended)</option>
            <option value="key">Private Key File</option>
            <option value="password">Password (via ssh prompt)</option>
          </select>
        </div>

        {form.auth_type === 'key' && (
          <div className="field">
            <label className="label">Private Key Path</label>
            <input className="input" placeholder="~/.ssh/id_ed25519" value={form.key_path ?? ''} onChange={(e) => setForm({ ...form, key_path: e.target.value })} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn--primary btn--sm" onClick={save} disabled={!form.name || !form.host || !form.username}>
            {editingId ? 'Update' : 'Save Connection'}
          </button>
          {editingId && (
            <button className="btn btn--ghost btn--sm" onClick={() => { setEditingId(null); setForm({ ...BLANK }); }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
