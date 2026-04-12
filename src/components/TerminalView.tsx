import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

export interface TerminalHandle {
  clear: () => void;
  fit: () => void;
}

interface Props {
  sessionId: string;
  onExit?: () => void;
}

const TerminalView = forwardRef<TerminalHandle, Props>(function TerminalView(
  { sessionId, onExit },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useImperativeHandle(ref, () => ({
    clear: () => termRef.current?.clear(),
    fit: () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      fitAddonRef.current?.fit();
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#FF9900',
        cursor: '#FF9900',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(255, 153, 0, 0.3)',
        black: '#000000',
        red: '#CC3333',
        green: '#66CC66',
        yellow: '#FFCC66',
        blue: '#6699CC',
        magenta: '#CC99FF',
        cyan: '#66CCCC',
        white: '#FFCC99',
        brightBlack: '#444444',
        brightRed: '#FF3333',
        brightGreen: '#99FF99',
        brightYellow: '#FFFF66',
        brightBlue: '#99CCFF',
        brightMagenta: '#FF99FF',
        brightCyan: '#99FFFF',
        brightWhite: '#FFFFFF',
      },
      fontFamily: '"Share Tech Mono", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.onData((data) => {
      const encoder = new TextEncoder();
      const bytes = Array.from(encoder.encode(data));
      invoke('send_input', { sessionId, data: bytes }).catch(console.error);
    });

    const unlistenOutput = listen<{ id: string; data: string }>(
      `session_output_${sessionId}`,
      (event) => {
        const base64 = event.payload.data;
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        term.write(bytes);
      }
    );

    const unlistenExit = listen<{ id: string }>(
      `session_exit_${sessionId}`,
      () => {
        term.writeln('\r\n\x1b[33m── session ended ──\x1b[0m');
        onExit?.();
      }
    );

    const doFit = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      if (width === 0 || height === 0) return; // hidden via display:none — skip
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        invoke('resize_terminal', {
          sessionId,
          rows: dims.rows,
          cols: dims.cols,
        }).catch(console.error);
      }
    };

    const observer = new ResizeObserver(doFit);
    observer.observe(containerRef.current);

    return () => {
      unlistenOutput.then((fn) => fn());
      unlistenExit.then((fn) => fn());
      observer.disconnect();
      term.dispose();
    };
  }, [sessionId]);

  return (
    <div className="terminal-wrapper">
      <div ref={containerRef} className="terminal-container" style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

export default TerminalView;
