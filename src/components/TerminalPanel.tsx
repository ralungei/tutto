"use client";

import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { Terminal as TerminalIcon, X, Maximize2, Minimize2 } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

export interface TerminalPanelHandle {
  executeCommand: (command: string, cwd?: string) => void;
}

const TerminalPanel = forwardRef<TerminalPanelHandle>(function TerminalPanel(_, ref) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [cwd, setCwd] = useState("~");
  const inputBufferRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(-1);

  const writePrompt = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.write(`\r\n\x1b[36mtutto\x1b[0m:\x1b[33m${cwd}\x1b[0m$ `);
    }
  }, [cwd]);

  const executeCommand = useCallback(
    async (command: string, cmdCwd?: string) => {
      const term = xtermRef.current;
      if (!term || isRunning) return;

      setIsRunning(true);
      const workingDir = cmdCwd || cwd === "~" ? process.env.HOME || "/" : cwd;

      // Show the command being executed
      term.write(`\r\n\x1b[90m$ ${command}\x1b[0m\r\n`);

      historyRef.current.push(command);
      historyIndexRef.current = -1;

      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command, cwd: workingDir }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          term.write(`\x1b[31mError: ${response.statusText}\x1b[0m\r\n`);
          setIsRunning(false);
          writePrompt();
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const events = chunk.split("\n\n");

          for (const event of events) {
            if (!event.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(event.slice(6));

              switch (data.type) {
                case "stdout":
                  // Replace newlines with \r\n for proper xterm rendering
                  term.write(data.data.replace(/\n/g, "\r\n"));
                  break;
                case "stderr":
                  term.write(`\x1b[31m${data.data.replace(/\n/g, "\r\n")}\x1b[0m`);
                  break;
                case "exit":
                  if (data.data !== "0") {
                    term.write(`\r\n\x1b[31m[exit code: ${data.data}]\x1b[0m`);
                  }
                  break;
                case "error":
                  term.write(`\r\n\x1b[31mError: ${data.data}\x1b[0m`);
                  break;
              }
            } catch {
              // skip malformed events
            }
          }
        }

        // Try to update cwd after command
        if (command.startsWith("cd ")) {
          const newDir = command.slice(3).trim();
          if (newDir === "~" || newDir === "") {
            setCwd("~");
          } else if (newDir.startsWith("/")) {
            setCwd(newDir);
          } else {
            setCwd((prev) => (prev === "~" ? `~/${newDir}` : `${prev}/${newDir}`));
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          term.write("\r\n\x1b[33m[cancelled]\x1b[0m");
        } else {
          const msg = error instanceof Error ? error.message : "Unknown error";
          term.write(`\r\n\x1b[31mError: ${msg}\x1b[0m`);
        }
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        writePrompt();
      }
    },
    [cwd, isRunning, writePrompt]
  );

  useImperativeHandle(ref, () => ({ executeCommand }), [executeCommand]);

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
        fontFamily: "var(--font-geist-mono), 'Fira Code', 'Cascadia Code', monospace",
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

      // Welcome message
      term.write("\x1b[1;35m  Tutto Terminal\x1b[0m\r\n");
      term.write("\x1b[90m  Escribe comandos o pide ayuda al chat\x1b[0m\r\n");
      term.write(`\r\n\x1b[36mtutto\x1b[0m:\x1b[33m~\x1b[0m$ `);

      // Handle user input
      term.onData((data) => {
        if (!xtermRef.current) return;

        switch (data) {
          case "\r": // Enter
            {
              const cmd = inputBufferRef.current.trim();
              inputBufferRef.current = "";
              if (cmd) {
                // Don't write prompt here, executeCommand handles it
                executeCommand(cmd);
              } else {
                term.write(`\r\n\x1b[36mtutto\x1b[0m:\x1b[33m~\x1b[0m$ `);
              }
            }
            break;
          case "\x7f": // Backspace
            if (inputBufferRef.current.length > 0) {
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              term.write("\b \b");
            }
            break;
          case "\x03": // Ctrl+C
            if (abortRef.current) {
              abortRef.current.abort();
            } else {
              inputBufferRef.current = "";
              term.write("^C");
              term.write(`\r\n\x1b[36mtutto\x1b[0m:\x1b[33m~\x1b[0m$ `);
            }
            break;
          case "\x1b[A": // Up arrow
            if (historyRef.current.length > 0) {
              if (historyIndexRef.current === -1) {
                historyIndexRef.current = historyRef.current.length - 1;
              } else if (historyIndexRef.current > 0) {
                historyIndexRef.current--;
              }
              // Clear current input
              while (inputBufferRef.current.length > 0) {
                term.write("\b \b");
                inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              }
              const cmd = historyRef.current[historyIndexRef.current];
              inputBufferRef.current = cmd;
              term.write(cmd);
            }
            break;
          case "\x1b[B": // Down arrow
            if (historyIndexRef.current !== -1) {
              while (inputBufferRef.current.length > 0) {
                term.write("\b \b");
                inputBufferRef.current = inputBufferRef.current.slice(0, -1);
              }
              if (historyIndexRef.current < historyRef.current.length - 1) {
                historyIndexRef.current++;
                const cmd = historyRef.current[historyIndexRef.current];
                inputBufferRef.current = cmd;
                term.write(cmd);
              } else {
                historyIndexRef.current = -1;
              }
            }
            break;
          default:
            if (data >= " " && !data.startsWith("\x1b")) {
              inputBufferRef.current += data;
              term.write(data);
            }
            break;
        }
      });

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
      });
      if (termRef.current) {
        resizeObserver.observe(termRef.current);
      }

      setIsReady(true);

      return () => {
        resizeObserver.disconnect();
        term.dispose();
      };
    };

    initTerminal();

    return () => {
      mounted = false;
      xtermRef.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`flex flex-col h-full bg-[#09090b] ${isMaximized ? "fixed inset-0 z-50" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-violet-400" />
          <span className="text-xs font-medium text-zinc-400">Terminal</span>
          {isRunning && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
              ejecutando...
            </span>
          )}
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
                writePrompt();
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
          Cargando terminal...
        </div>
      )}
    </div>
  );
});

export default TerminalPanel;
