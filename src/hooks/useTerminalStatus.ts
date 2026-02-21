"use client";

import { useState, useEffect, useCallback } from "react";

export type TerminalStatus = "connected" | "disconnected" | "checking";

export function useTerminalStatus() {
  const [status, setStatus] = useState<TerminalStatus>("checking");

  const checkConnection = useCallback(async () => {
    try {
      const response = await fetch("/api/pty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ping" }),
        signal: AbortSignal.timeout(3000),
      });
      setStatus(response.ok ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  }, []);

  useEffect(() => {
    checkConnection();
    // Check every 10 seconds
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, [checkConnection]);

  return { status, checkConnection };
}
