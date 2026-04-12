import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { GitHubConfig, GitHubIssue } from '../../types/integrations';

interface Props {
  config: GitHubConfig;
  onChange: (c: GitHubConfig) => void;
}

export default function GitHubSettings({ config, onChange }: Props) {
  const [repo, setRepo] = useState('');
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ghCliAuth, setGhCliAuth] = useState<boolean | null>(null);

  const checkGhCli = useCallback(async () => {
    const ok = await invoke<boolean>('github_check_auth').catch(() => false);
    setGhCliAuth(ok);
  }, []);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke<GitHubIssue[]>('github_fetch_issues', {
        token: config.token,
        repo: repo.trim() || null,
      });
      setIssues(result);
    } catch (e: any) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [config.token, repo]);

  return (
    <div className="settings-section">
      <div className="settings-section__title">GitHub</div>
      <div className="settings-section__desc">
        Connect to GitHub to browse issues and pull requests. Starbase uses the{' '}
        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>gh</code> CLI when
        available, or a Personal Access Token as fallback.
      </div>

      {/* gh CLI status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="label">gh CLI</span>
        {ghCliAuth === null ? (
          <button className="btn btn--ghost btn--xs" onClick={checkGhCli}>Check</button>
        ) : (
          <span className={`integration-status integration-status--${ghCliAuth ? 'ok' : 'err'}`}>
            {ghCliAuth ? '✓ Authenticated' : '✗ Not authenticated'}
          </span>
        )}
      </div>

      {/* PAT fallback */}
      <div className="field">
        <label className="label">Personal Access Token (fallback)</label>
        <input
          className="input"
          type="password"
          placeholder="ghp_..."
          value={config.token}
          onChange={(e) => onChange({ ...config, token: e.target.value })}
        />
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          Scopes required: repo, read:user. Only used if gh CLI is unavailable.
        </span>
      </div>

      <label className="toggle">
        <input type="checkbox" checked={config.enabled} onChange={(e) => onChange({ ...config, enabled: e.target.checked })} />
        <div style={{ flex: 1 }}>
          <div className="toggle__label">Enable GitHub integration</div>
        </div>
      </label>

      {/* Issue browser */}
      {config.enabled && (
        <>
          <div className="divider" />
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1 }}>
              <label className="label">Repository (optional — owner/repo)</label>
              <input className="input" placeholder="e.g. anthropics/claude-code" value={repo} onChange={(e) => setRepo(e.target.value)} />
            </div>
            <button className="btn btn--ghost btn--sm" onClick={fetchIssues} disabled={loading}>
              {loading ? 'Loading…' : 'Fetch Issues'}
            </button>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--accent-red)' }}>{error}</div>}
          {issues.length > 0 && (
            <div className="issue-list">
              {issues.map((iss) => (
                <div key={iss.number} className="issue-item">
                  <span className="issue-item__key">#{iss.number}</span>
                  <div style={{ flex: 1 }}>
                    <div className="issue-item__title">{iss.title}</div>
                    <div className="issue-item__meta">
                      {iss.repo && <span>{iss.repo} · </span>}
                      {iss.labels.slice(0, 3).join(', ')}
                    </div>
                  </div>
                  <span className={`badge badge--${iss.state === 'open' ? 'green' : 'dim'}`}>
                    {iss.state}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
