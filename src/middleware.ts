import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Track failed auth attempts per IP for rate limiting
const failedAttempts = new Map<string, number[]>();

function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const max = 10;

  const attempts = (failedAttempts.get(ip) || []).filter((t) => now - t < window);
  failedAttempts.set(ip, attempts);
  return attempts.length >= max;
}

function recordFailure(ip: string) {
  const attempts = failedAttempts.get(ip) || [];
  attempts.push(Date.now());
  failedAttempts.set(ip, attempts);
}

// Timing-safe string comparison
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function middleware(request: NextRequest) {
  const secret = process.env.TUTTO_SECRET;

  // No secret = no auth (local mode)
  if (!secret) return NextResponse.next();

  // Auth endpoint is public (it's the login endpoint)
  if (request.nextUrl.pathname === "/api/auth") return NextResponse.next();

  const ip = getClientIp(request);

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Check Authorization header or query param (SSE doesn't support headers)
  const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
  const queryToken = request.nextUrl.searchParams.get("token");
  const token = bearer || queryToken;

  if (token && safeCompare(token, secret)) {
    return NextResponse.next();
  }

  recordFailure(ip);
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: "/api/:path*",
};
