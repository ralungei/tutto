"use client";

const TOKEN_KEY = "tutto_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** fetch() wrapper that injects the auth token */
export async function fetchAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  if (token) {
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    options = { ...options, headers };
  }

  const response = await fetch(url, options);

  if (response.status === 401) {
    clearAuthToken();
    window.dispatchEvent(new Event("tutto:unauthorized"));
  }

  return response;
}

/** Append auth token to a URL (for EventSource which doesn't support headers) */
export function authUrl(url: string): string {
  const token = getAuthToken();
  if (!token) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}token=${encodeURIComponent(token)}`;
}
