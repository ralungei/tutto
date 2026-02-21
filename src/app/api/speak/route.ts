import { enqueueSpeech, addSpeechListener } from "@/lib/speech-queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: SSE stream - web UI listens here for speech events
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const removeListener = addSpeechListener((text) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
          );
        } catch {
          removeListener();
        }
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
          removeListener();
        }
      }, 30000);

      // Confirm connected
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`)
      );
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

// POST: MCP server or anything calls this to enqueue speech
export async function POST(req: Request) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  enqueueSpeech(text);
  return Response.json({ ok: true, queued: text });
}
