import Anthropic from "@anthropic-ai/sdk";
import {
  writeToPty,
  getRecentOutputClean,
} from "@/lib/pty-manager";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `Eres "Tutto", un asistente personal inteligente. Tu nombre viene del italiano "tutto" = "todo".

Tienes acceso a una terminal real persistente (PTY) del usuario. Puedes:
1. Enviar texto/comandos a la terminal con "send_to_terminal"
2. Leer lo que hay en la terminal con "read_terminal"

FLUJO para ejecutar comandos:
1. Usa send_to_terminal para enviar el comando (incluye \\n al final para presionar Enter)
2. Espera un momento con read_terminal (usa delay_ms) para ver el resultado
3. Lee el output y responde al usuario

FLUJO para interactuar con Claude Code u otros programas interactivos:
1. Puedes lanzar "claude" en la terminal con send_to_terminal
2. Enviar prompts/texto al programa interactivo
3. Leer sus respuestas con read_terminal
4. Continuar la conversación

Reglas:
- Responde en el mismo idioma del usuario
- Siempre incluye \\n al final del texto en send_to_terminal para presionar Enter
- Si un comando es peligroso (rm -rf, etc.), advierte antes de ejecutar
- Usa read_terminal con delay_ms para dar tiempo a que el comando termine
- Formatea respuestas con Markdown
- Sé conciso pero útil`;

const tools: Anthropic.Messages.Tool[] = [
  {
    name: "send_to_terminal",
    description:
      "Send text or a command to the persistent terminal (PTY). The text is written directly to the terminal input, as if the user typed it. Include \\n at the end to press Enter.",
    input_schema: {
      type: "object" as const,
      properties: {
        text: {
          type: "string",
          description:
            'The text to send to the terminal. Include \\n to press Enter. Example: "ls -la\\n"',
        },
      },
      required: ["text"],
    },
  },
  {
    name: "read_terminal",
    description:
      "Read the recent output from the terminal. Use this to see command results, read what a program (like Claude Code) has written, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        max_chars: {
          type: "number",
          description:
            "Maximum characters to read from the terminal buffer. Default: 5000",
        },
        delay_ms: {
          type: "number",
          description:
            "Wait this many milliseconds before reading (useful to let a command finish). Default: 0. Max: 10000.",
        },
      },
    },
  },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "send_to_terminal": {
      const text = input.text as string;
      writeToPty(text);
      return `Sent to terminal: ${text.replace(/\n/g, "\\n").slice(0, 200)}`;
    }
    case "read_terminal": {
      const maxChars = Math.min((input.max_chars as number) || 5000, 15000);
      const delayMs = Math.min((input.delay_ms as number) || 0, 10000);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
      const output = getRecentOutputClean(maxChars);
      return output || "(terminal is empty)";
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

export async function POST(req: Request) {
  const { messages, terminalAvailable = true } = await req.json();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "ANTHROPIC_API_KEY not configured. Set it in your .env.local file.",
      },
      { status: 500 }
    );
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const SYSTEM_PROMPT_OFFLINE = `Eres "Tutto", un asistente personal inteligente. Tu nombre viene del italiano "tutto" = "todo".

Actualmente NO tienes acceso a la terminal del usuario (está desconectada o inaccesible).
Puedes ayudar con:
- Responder preguntas sobre cualquier tema
- Programación, explicaciones, brainstorming
- Cualquier cosa que no requiera ejecutar comandos

Si el usuario pide ejecutar algo en la terminal, dile que la terminal no está disponible ahora mismo y que necesita conectarse desde su Mac.

Reglas:
- Responde en el mismo idioma del usuario
- Formatea respuestas con Markdown
- Sé conciso pero útil`;

  const activeSystemPrompt = terminalAvailable ? SYSTEM_PROMPT : SYSTEM_PROMPT_OFFLINE;
  const activeTools = terminalAvailable ? tools : [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Build Anthropic-format messages
        let currentMessages: Anthropic.Messages.MessageParam[] = messages.map(
          (m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })
        );

        // Tool-use loop: Claude may use tools multiple times
        const MAX_TOOL_ROUNDS = 10;
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: activeSystemPrompt,
            ...(activeTools.length > 0 ? { tools: activeTools } : {}),
            messages: currentMessages,
            stream: true,
          });

          let stopReason: string | null = null;
          // Use a flexible type since we rebuild content blocks from streaming
          const contentBlocks: (
            | { type: "text"; text: string }
            | { type: "tool_use"; id: string; name: string; input: unknown }
          )[] = [];
          let currentTextBlock = "";
          let currentToolName = "";
          let currentToolId = "";
          let currentToolJson = "";

          for await (const event of response) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                currentTextBlock = "";
              } else if (event.content_block.type === "tool_use") {
                currentToolName = event.content_block.name;
                currentToolId = event.content_block.id;
                currentToolJson = "";
                // Notify client about tool use
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool_start",
                      tool: currentToolName,
                      id: currentToolId,
                    })}\n\n`
                  )
                );
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                currentTextBlock += event.delta.text;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "text_delta",
                      text: event.delta.text,
                    })}\n\n`
                  )
                );
              } else if (event.delta.type === "input_json_delta") {
                currentToolJson += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentTextBlock) {
                contentBlocks.push({
                  type: "text",
                  text: currentTextBlock,
                });
                currentTextBlock = "";
              }
              if (currentToolId) {
                let parsedInput = {};
                try {
                  parsedInput = JSON.parse(currentToolJson || "{}");
                } catch {
                  parsedInput = {};
                }
                contentBlocks.push({
                  type: "tool_use",
                  id: currentToolId,
                  name: currentToolName,
                  input: parsedInput,
                });

                // Notify client about tool input
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "tool_input",
                      tool: currentToolName,
                      id: currentToolId,
                      input: parsedInput,
                    })}\n\n`
                  )
                );

                currentToolId = "";
                currentToolName = "";
                currentToolJson = "";
              }
            } else if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason;
            }
          }

          // If no tool use, we're done
          if (stopReason !== "tool_use") {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "done" })}\n\n`
              )
            );
            break;
          }

          // Execute tools and continue conversation
          const toolBlocks = contentBlocks.filter(
            (b): b is { type: "tool_use"; id: string; name: string; input: unknown } =>
              b.type === "tool_use"
          );

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const toolBlock of toolBlocks) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_executing",
                  tool: toolBlock.name,
                  id: toolBlock.id,
                })}\n\n`
              )
            );

            const result = await executeTool(
              toolBlock.name,
              toolBlock.input as Record<string, unknown>
            );

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolBlock.id,
              content: result,
            });

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_result",
                  tool: toolBlock.name,
                  id: toolBlock.id,
                  result:
                    result.length > 200
                      ? result.slice(0, 200) + "..."
                      : result,
                })}\n\n`
              )
            );
          }

          // Add assistant message and tool results for next round
          currentMessages = [
            ...currentMessages,
            {
              role: "assistant" as const,
              content: contentBlocks as Anthropic.Messages.ContentBlockParam[],
            },
            { role: "user" as const, content: toolResults },
          ];
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
