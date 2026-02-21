import { spawn } from "child_process";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { command, cwd } = await req.json();

  if (!command || typeof command !== "string") {
    return Response.json({ error: "Command is required" }, { status: 400 });
  }

  const workingDir = cwd || process.env.HOME || "/";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const child = spawn("bash", ["-c", command], {
        cwd: workingDir,
        env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "1" },
        shell: false,
      });

      child.stdout.on("data", (data: Buffer) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "stdout", data: data.toString() })}\n\n`)
        );
      });

      child.stderr.on("data", (data: Buffer) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "stderr", data: data.toString() })}\n\n`)
        );
      });

      child.on("close", (code) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "exit", data: String(code ?? 0) })}\n\n`)
        );
        controller.close();
      });

      child.on("error", (err) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", data: err.message })}\n\n`)
        );
        controller.close();
      });

      // Handle client disconnect
      req.signal.addEventListener("abort", () => {
        child.kill("SIGTERM");
      });
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
