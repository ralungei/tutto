import {
  writeToPty,
  addOutputListener,
  getBufferedOutput,
  resizePty,
} from "@/lib/pty-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: SSE stream of terminal output
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const removeListener = addOutputListener((data) => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "output", data })}\n\n`
            )
          );
        } catch {
          removeListener();
        }
      });

      // Send a heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          removeListener();
        }
      }, 30000);

      // Send connected event
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected" })}\n\n`
        )
      );

      // Replay buffered output so new connections see existing terminal state
      const buffer = getBufferedOutput();
      if (buffer) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "output", data: buffer })}\n\n`
          )
        );
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// POST: Send input or resize
export async function POST(req: Request) {
  const body = await req.json();

  if (body.type === "input") {
    if (typeof body.data !== "string") {
      return Response.json({ error: "data must be a string" }, { status: 400 });
    }
    writeToPty(body.data);
    return Response.json({ ok: true });
  }

  if (body.type === "resize") {
    const cols = Number(body.cols);
    const rows = Number(body.rows);
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || rows < 1 || cols > 500 || rows > 200) {
      return Response.json({ error: "Invalid resize dimensions" }, { status: 400 });
    }
    resizePty(cols, rows);
    return Response.json({ ok: true });
  }

  if (body.type === "ping") {
    return Response.json({ ok: true, status: "connected" });
  }

  return Response.json({ error: "Unknown type" }, { status: 400 });
}
