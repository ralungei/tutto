"use client";

import {
  useRef,
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  Terminal as TerminalIcon,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import "@xterm/xterm/css/xterm.css";

export interface TerminalPanelHandle {
  sendInput: (text: string) => void;
}

const TerminalPanel = forwardRef<TerminalPanelHandle>(function TerminalPanel(
  _,
  ref
) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Send input to the PTY via API
  const sendInput = async (data: string) => {
    try {
      await fetch("/api/pty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "input", data }),
      });
    } catch (err) {
      console.error("Failed to send input to PTY:", err);
    }
  };

  const sendResize = async (cols: number, rows: number) => {
    try {
      await fetch("/api/pty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "resize", cols, rows }),
      });
    } catch {
      // ignore resize errors
    }
  };

  useImperativeHandle(ref, () => ({ sendInput }), []);

  useEffect(() => {
    let mounted = true;

    const initTerminal = async () => {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      const { WebLinksAddon } = await import("@xterm/addon-web-links");

      if (!mounted || !termRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily:
          "'Fira Code', 'Cascadia Code', 'JetBrains Mono', monospace",
        theme: {
          background: "#09090b",
          foreground: "#e4e4e7",
          cursor: "#a78bfa",
          selectionBackground: "#7c3aed40",
          black: "#18181b",
          red: "#ef4444",
          green: "#22c55e",
          yellow: "#eab308",
          blue: "#3b82f6",
          magenta: "#a855f7",
          cyan: "#06b6d4",
          white: "#e4e4e7",
          brightBlack: "#52525b",
          brightRed: "#f87171",
          brightGreen: "#4ade80",
          brightYellow: "#facc15",
          brightBlue: "#60a5fa",
          brightMagenta: "#c084fc",
          brightCyan: "#22d3ee",
          brightWhite: "#fafafa",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      term.open(termRef.current);
      fitAddon.fit();

      xtermRef.current = term;

      // Forward all keyboard input to the PTY
      term.onData((data) => {
        sendInput(data);
      });

      // Handle resize
      term.onResize(({ cols, rows }) => {
        sendResize(cols, rows);
      });

      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });
      if (termRef.current) {
        resizeObserver.observe(termRef.current);
      }

      // Connect to PTY output via SSE
      const es = new EventSource("/api/pty");
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "output") {
            term.write(data.data);
          } else if (data.type === "connected") {
            // Send initial resize
            sendResize(term.cols, term.rows);
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        // EventSource will auto-reconnect
        console.warn("Terminal SSE connection lost, reconnecting...");
      };

      setIsReady(true);

      return () => {
        resizeObserver.disconnect();
      };
    };

    initTerminal();

    return () => {
      mounted = false;
      eventSourceRef.current?.close();
      xtermRef.current?.dispose();
    };
  }, []);

  return (
    <div
      className={`flex flex-col h-full bg-[#09090b] ${isMaximized ? "fixed inset-0 z-50" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-violet-400" />
          <span className="text-xs font-medium text-zinc-400">Terminal</span>
          <span className="text-xs text-zinc-600">PTY persistente</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => {
              if (xtermRef.current) {
                xtermRef.current.clear();
              }
            }}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Terminal */}
      <div
        ref={termRef}
        className="flex-1 px-2 py-1"
        style={{ display: isReady ? "block" : "none" }}
      />
      {!isReady && (
        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
          Conectando a la terminal...
        </div>
      )}
    </div>
  );
});

export default TerminalPanel;
