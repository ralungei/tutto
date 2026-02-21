"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Terminal as TerminalIcon, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  commands?: { command: string; cwd?: string }[];
}

interface ChatPanelProps {
  onRunCommand: (command: string, cwd?: string) => void;
}

export default function ChatPanel({ onRunCommand }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      commands: [],
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let currentText = "";
      let toolJson = "";
      let currentToolId = "";
      const commands: { command: string; cwd?: string }[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          switch (data.type) {
            case "text_delta":
              currentText += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: currentText }
                    : m
                )
              );
              break;
            case "tool_start":
              toolJson = "";
              currentToolId = data.id;
              break;
            case "tool_delta":
              toolJson += data.json;
              break;
            case "block_stop":
              if (currentToolId && toolJson) {
                try {
                  const toolInput = JSON.parse(toolJson);
                  if (toolInput.command) {
                    commands.push({
                      command: toolInput.command,
                      cwd: toolInput.cwd,
                    });
                    currentText += `\n\n> **Comando:** \`${toolInput.command}\`\n`;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id
                          ? { ...m, content: currentText, commands: [...commands] }
                          : m
                      )
                    );
                  }
                } catch {
                  // partial JSON, ignore
                }
                currentToolId = "";
                toolJson = "";
              }
              break;
            case "error":
              currentText += `\n\n**Error:** ${data.error}`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, content: currentText }
                    : m
                )
              );
              break;
          }
        }
      }

      // Auto-execute commands from AI
      for (const cmd of commands) {
        onRunCommand(cmd.command, cmd.cwd);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Error desconocido";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessage.id
            ? { ...m, content: `Error: ${errorMsg}` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Bot size={18} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Tutto</h2>
          <p className="text-xs text-zinc-500">Tu asistente para todo</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center">
              <Bot size={32} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">
                Hola, soy Tutto
              </h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                Tu asistente personal. Puedo ejecutar comandos en la terminal,
                responder preguntas, y ayudarte con lo que necesites.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {[
                "Muestra los archivos del directorio actual",
                "Cual es mi IP?",
                "Instala las dependencias del proyecto",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="flex gap-3">
            <div
              className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center ${
                message.role === "user"
                  ? "bg-zinc-700"
                  : "bg-violet-600"
              }`}
            >
              {message.role === "user" ? (
                <User size={14} className="text-zinc-300" />
              ) : (
                <Bot size={14} className="text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm leading-relaxed ${
                  message.role === "user"
                    ? "text-zinc-300"
                    : "text-zinc-200"
                }`}
              >
                {message.role === "assistant" ? (
                  <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700 prose-code:text-violet-300">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
              </div>
              {message.commands && message.commands.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.commands.map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => onRunCommand(cmd.command, cmd.cwd)}
                      className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-violet-300 hover:bg-zinc-700 transition-colors"
                    >
                      <TerminalIcon size={12} />
                      Re-ejecutar: {cmd.command}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.content === "" && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm pl-10">
            <Loader2 size={14} className="animate-spin" />
            Pensando...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-end gap-2 bg-zinc-900 rounded-xl border border-zinc-700 focus-within:border-violet-500 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje o pide ejecutar un comando..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-200 placeholder-zinc-600 px-4 py-3 outline-none max-h-32"
            style={{ minHeight: "44px" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2 m-1 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
