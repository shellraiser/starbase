import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { PROVIDERS } from '../types';

interface Props {
  onComplete: (defaultCwd: string) => void;
}

export default function OnboardingModal({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [detectedClis, setDetectedClis] = useState<Record<string, boolean>>({});
  const [detecting, setDetecting] = useState(false);
  const [defaultCwd, setDefaultCwd] = useState('');

  useEffect(() => {
    if (step === 1) {
      setDetecting(true);
      Promise.all(
        PROVIDERS.map(async (p) => {
          const found = await invoke<boolean>('check_cli', { cli: p.cli }).catch(() => false);
          return [p.id, found] as [string, boolean];
        })
      ).then((results) => {
        setDetectedClis(Object.fromEntries(results));
        setDetecting(false);
      });
    }
  }, [step]);

  const browse = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Choose default workspace' });
    if (typeof selected === 'string' && selected) setDefaultCwd(selected);
  };

  const installedCount = Object.values(detectedClis).filter(Boolean).length;

  return (
    <div className="overlay">
      <div className="onboarding-modal animate-in">
        {/* Step dots */}
        <div className="onboarding-steps">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`onboarding-step-dot${i === step ? ' onboarding-step-dot--active' : i < step ? ' onboarding-step-dot--done' : ''}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="onboarding-body">
            <svg width="40" height="40" viewBox="0 0 80 80" fill="none" style={{ opacity: 0.8 }}>
              <circle cx="40" cy="40" r="36" stroke="#FF9900" strokeWidth="2.5" opacity="0.7"/>
              <circle cx="40" cy="40" r="22" stroke="#FF9900" strokeWidth="2" opacity="0.55"/>
              <circle cx="40" cy="40" r="9"  stroke="#FF9900" strokeWidth="2"/>
              <circle cx="40" cy="40" r="4"  fill="#FFCC66" opacity="0.9"/>
              <line x1="40" y1="4"  x2="40" y2="18" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
              <line x1="40" y1="62" x2="40" y2="76" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
              <line x1="4"  y1="40" x2="18" y2="40" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
              <line x1="62" y1="40" x2="76" y2="40" stroke="#FF9900" strokeWidth="1.5" opacity="0.65"/>
            </svg>
            <div className="onboarding-title">Welcome to Starbase</div>
            <div className="onboarding-desc">
              Starbase lets you run multiple AI coding agents simultaneously — Claude Code, Gemini, Codex, and 17 more — each in its own terminal session, organised into sections.
              <br/><br/>
              Let's take 30 seconds to get you set up.
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-body">
            <div className="onboarding-title">Detecting installed CLIs</div>
            <div className="onboarding-desc">
              {detecting
                ? 'Scanning your PATH…'
                : `Found ${installedCount} of ${PROVIDERS.length} supported CLIs. You can install more anytime.`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
              {PROVIDERS.map((p) => {
                const found = detectedClis[p.id];
                return (
                  <div key={p.id} className="cli-detect-row">
                    <div
                      className="cli-detect-row__dot"
                      style={{ background: detecting ? 'var(--text-dim)' : found ? 'var(--accent-green)' : 'var(--border-mid)' }}
                    />
                    <span className="cli-detect-row__name">{p.name}</span>
                    <span className="cli-detect-row__status">
                      {detecting ? '…' : found ? 'installed' : 'not found'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-body">
            <div className="onboarding-title">Default workspace</div>
            <div className="onboarding-desc">
              Choose the directory new sessions open in by default. You can override this per-session or per-profile at any time in Settings.
            </div>
            <div className="field">
              <label className="label">Default directory</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  placeholder="~ (home directory)"
                  value={defaultCwd}
                  onChange={(e) => setDefaultCwd(e.target.value)}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11 }}
                />
                <button className="btn btn--ghost btn--sm" onClick={browse}>Browse</button>
              </div>
            </div>
          </div>
        )}

        <div className="onboarding-footer">
          {step > 0 && (
            <button className="btn btn--ghost btn--sm" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          {step < 2 ? (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && detecting}
            >
              {step === 1 && detecting ? 'Scanning…' : 'Next'}
            </button>
          ) : (
            <button className="btn btn--primary btn--sm" onClick={() => onComplete(defaultCwd)}>
              Launch Starbase
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
