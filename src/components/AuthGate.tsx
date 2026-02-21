"use client";

import { useState, useEffect, useCallback } from "react";
import { Bot, Lock, Loader2 } from "lucide-react";
import { setAuthToken, clearAuthToken, getAuthToken } from "@/lib/fetch-auth";

type AuthState = "checking" | "authenticated" | "login";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>("checking");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      // Is auth even required?
      const res = await fetch("/api/auth");
      const data = await res.json();

      if (!data.authRequired) {
        setState("authenticated");
        return;
      }

      // Auth required — do we have a stored token?
      const stored = getAuthToken();
      if (stored) {
        const verify = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: stored }),
        });
        if (verify.ok) {
          setState("authenticated");
          return;
        }
        clearAuthToken();
      }

      setState("login");
    } catch {
      // Network error = probably local, allow through
      setState("authenticated");
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Listen for 401 events from fetchAuth
  useEffect(() => {
    const onUnauthorized = () => setState("login");
    window.addEventListener("tutto:unauthorized", onUnauthorized);
    return () => window.removeEventListener("tutto:unauthorized", onUnauthorized);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });

      if (res.ok) {
        setAuthToken(token.trim());
        setState("authenticated");
      } else {
        setError("Token incorrecto");
      }
    } catch {
      setError("Error de conexion");
    } finally {
      setLoading(false);
    }
  };

  if (state === "checking") {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 size={24} className="animate-spin text-violet-400" />
      </div>
    );
  }

  if (state === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-xs space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/20 flex items-center justify-center">
            <Bot size={28} className="text-violet-400" />
          </div>
          <h1 className="text-lg font-semibold text-zinc-100">Tutto</h1>
          <p className="text-xs text-zinc-500 text-center">
            Introduce el token de acceso
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <div className="relative">
            <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Token secreto"
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={!token.trim() || loading}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin mx-auto" />
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
