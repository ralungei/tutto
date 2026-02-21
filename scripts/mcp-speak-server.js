#!/usr/bin/env node
// MCP Server: "speak" tool for Claude Code
// Allows Claude Code to speak aloud to the user via Tutto's TTS system
//
// Protocol: JSON-RPC 2.0 over stdio (MCP standard)

const TUTTO_URL = process.env.TUTTO_URL || "http://localhost:3000";

const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

function send(response) {
  const json = JSON.stringify(response);
  process.stdout.write(`${json}\n`);
}

function handleRequest(msg) {
  const { id, method, params } = msg;

  switch (method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: {
            name: "tutto-speak",
            version: "1.0.0",
          },
        },
      });
      break;

    case "notifications/initialized":
      // No response needed for notifications
      break;

    case "tools/list":
      send({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "speak",
              description:
                "Habla en voz alta al usuario a través de Tutto. " +
                "Usa frases cortas y naturales como si hablaras en persona. " +
                "El texto se convierte a audio y se reproduce en el dispositivo del usuario (ej: su iPhone). " +
                "Ideal para notificar progreso, resultados, o responder preguntas. " +
                "IMPORTANTE: sé breve (1-2 frases) a menos que el usuario pida algo extenso.",
              inputSchema: {
                type: "object",
                properties: {
                  text: {
                    type: "string",
                    description:
                      "Lo que quieres decir al usuario. Usa lenguaje hablado natural, no escrito. " +
                      "Ejemplo: 'Listo, ya instalé las dependencias' en vez de 'Las dependencias han sido instaladas correctamente.'",
                  },
                },
                required: ["text"],
              },
            },
          ],
        },
      });
      break;

    case "tools/call": {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName !== "speak") {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              { type: "text", text: `Unknown tool: ${toolName}` },
            ],
            isError: true,
          },
        });
        return;
      }

      const text = args.text;
      if (!text) {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: "Error: text is required" }],
            isError: true,
          },
        });
        return;
      }

      // Send to Tutto's speak endpoint
      fetch(`${TUTTO_URL}/api/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then((res) => res.json())
        .then(() => {
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Dicho al usuario: "${text}"`,
                },
              ],
            },
          });
        })
        .catch((err) => {
          send({
            jsonrpc: "2.0",
            id,
            result: {
              content: [
                {
                  type: "text",
                  text: `Error enviando audio: ${err.message}. Asegúrate de que Tutto esté corriendo en ${TUTTO_URL}`,
                },
              ],
            },
          });
        });
      break;
    }

    default:
      if (id !== undefined) {
        send({
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        });
      }
  }
}

// Read JSON-RPC messages from stdin (one per line)
rl.on("line", (line) => {
  try {
    const msg = JSON.parse(line.trim());
    handleRequest(msg);
  } catch {
    // Ignore malformed input
  }
});
