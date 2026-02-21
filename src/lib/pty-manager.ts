import * as pty from "node-pty";

interface PtyManager {
  process: pty.IPty;
  outputBuffer: string[];
  listeners: Set<(data: string) => void>;
}

// Survive Next.js hot reloads in dev mode
const globalForPty = globalThis as unknown as { ptyManager?: PtyManager };

function getManager(): PtyManager {
  if (!globalForPty.ptyManager) {
    const shell = process.env.SHELL || "bash";
    const proc = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 120,
      rows: 30,
      cwd: process.env.HOME || "/",
      env: process.env as Record<string, string>,
    });

    const manager: PtyManager = {
      process: proc,
      outputBuffer: [],
      listeners: new Set(),
    };

    proc.onData((data) => {
      manager.outputBuffer.push(data);
      // Keep buffer manageable
      if (manager.outputBuffer.length > 2000) {
        manager.outputBuffer = manager.outputBuffer.slice(-1000);
      }
      for (const cb of manager.listeners) {
        try {
          cb(data);
        } catch {
          // Listener might be dead
          manager.listeners.delete(cb);
        }
      }
    });

    proc.onExit(() => {
      // Respawn if the shell exits
      globalForPty.ptyManager = undefined;
    });

    globalForPty.ptyManager = manager;
  }
  return globalForPty.ptyManager;
}

export function writeToPty(data: string) {
  getManager().process.write(data);
}

export function getRecentOutput(maxChars: number = 8000): string {
  const buffer = getManager().outputBuffer;
  let result = "";
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (result.length + buffer[i].length > maxChars) break;
    result = buffer[i] + result;
  }
  return result;
}

// Strip ANSI escape codes for clean text reading
export function getRecentOutputClean(maxChars: number = 8000): string {
  const raw = getRecentOutput(maxChars);
  // Remove ANSI escape sequences
  return raw.replace(
    // eslint-disable-next-line no-control-regex
    /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\[\?[0-9;]*[a-zA-Z]/g,
    ""
  );
}

export function addOutputListener(cb: (data: string) => void): () => void {
  const manager = getManager();
  manager.listeners.add(cb);
  return () => {
    manager.listeners.delete(cb);
  };
}

export function resizePty(cols: number, rows: number) {
  getManager().process.resize(cols, rows);
}
