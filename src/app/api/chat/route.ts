import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Eres "Tutto", un asistente personal inteligente que ayuda con todo. Tu nombre viene del italiano "tutto" que significa "todo".

Capacidades:
- Puedes ejecutar comandos de terminal usando la herramienta "run_command"
- Puedes responder preguntas sobre cualquier tema
- Puedes ayudar con programación, administración de sistemas, productividad, etc.

Reglas:
- Responde en el mismo idioma que el usuario
- Cuando el usuario pida ejecutar algo en la terminal, usa la herramienta run_command
- Sé conciso pero útil
- Si un comando podría ser peligroso (rm -rf, formato de disco, etc.), advierte al usuario antes de ejecutarlo
- Formatea tu respuesta con Markdown cuando sea apropiado`;

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "run_command",
    description:
      "Execute a command in the user's terminal. Use this when the user asks you to run something, check files, install packages, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The bash command to execute",
        },
        cwd: {
          type: "string",
          description: "Working directory for the command (optional)",
        },
      },
      required: ["command"],
    },
  },
];

export async function POST(req: Request) {
  const { messages } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured. Set it in your .env.local file." },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicMessages = messages.map(
          (m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })
        );

        const response = await client.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools,
          messages: anthropicMessages,
          stream: true,
        });

        for await (const event of response) {
          if (event.type === "content_block_start") {
            if (event.content_block.type === "text") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "text_start" })}\n\n`
                )
              );
            } else if (event.content_block.type === "tool_use") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool_start",
                    tool: event.content_block.name,
                    id: event.content_block.id,
                  })}\n\n`
                )
              );
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "text_delta",
                    text: event.delta.text,
                  })}\n\n`
                )
              );
            } else if (event.delta.type === "input_json_delta") {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "tool_delta",
                    json: event.delta.partial_json,
                  })}\n\n`
                )
              );
            }
          } else if (event.type === "content_block_stop") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "block_stop" })}\n\n`
              )
            );
          } else if (event.type === "message_stop") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done" })}\n\n`
              )
            );
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: message })}\n\n`
          )
        );
      } finally {
        controller.close();
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
