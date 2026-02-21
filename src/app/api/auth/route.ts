export const runtime = "nodejs";

// GET: check if auth is required
export async function GET() {
  return Response.json({ authRequired: !!process.env.TUTTO_SECRET });
}

// POST: verify token
export async function POST(req: Request) {
  const secret = process.env.TUTTO_SECRET;
  if (!secret) return Response.json({ ok: true });

  const { token } = await req.json();
  if (typeof token === "string" && token === secret) {
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Invalid token" }, { status: 401 });
}
