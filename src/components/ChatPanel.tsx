"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Terminal as TerminalIcon,
  Loader2,
  Eye,
  Play,
  Mic,
  MicOff,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import AudioMessage from "./AudioMessage";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

interface ToolAction {
  id: string;
  tool: string;
  input?: Record<string, unknown>;
  result?: string;
  status: "started" | "executing" | "done";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolActions?: ToolAction[];
  hasAudio?: boolean;
}

interface ChatPanelProps {
  terminalAvailable?: boolean;
}

export default function ChatPanel({ terminalAvailable = true }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported: micSupported,
    sttMode,
    setSttMode,
    isTranscribing,
  } = useSpeechRecognition();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Update input with speech transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const handleMicToggle = async () => {
    if (isListening) {
      const text = await stopListening();
      if (text.trim()) {
        sendMessage(text);
      }
    } else {
      setInput("");
      startListening();
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const messageText = overrideText?.trim() || input.trim() || transcript.trim();
    if (!messageText || isLoading) return;

    if (isListening) {
      stopListening();
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      toolActions: [],
      hasAudio: false,
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
        body: JSON.stringify({ messages: apiMessages, terminalAvailable }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let currentText = "";
      const toolActions: ToolAction[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          let data;
          try {
            data = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

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
              toolActions.push({
                id: data.id,
                tool: data.tool,
                status: "started",
              });
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMessage.id
                    ? { ...m, toolActions: [...toolActions] }
                    : m
                )
              );
              break;

            case "tool_input": {
              const action = toolActions.find((a) => a.id === data.id);
              if (action) {
                action.input = data.input;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, toolActions: [...toolActions] }
                      : m
                  )
                );
              }
              break;
            }

            case "tool_executing": {
              const action = toolActions.find((a) => a.id === data.id);
              if (action) {
                action.status = "executing";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, toolActions: [...toolActions] }
                      : m
                  )
                );
              }
              break;
            }

            case "tool_result": {
              const action = toolActions.find((a) => a.id === data.id);
              if (action) {
                action.status = "done";
                action.result = data.result;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, toolActions: [...toolActions] }
                      : m
                  )
                );
              }
              break;
            }

            case "done":
              if (currentText.trim()) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMessage.id
                      ? { ...m, hasAudio: true }
                      : m
                  )
                );
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
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Error desconocido";
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Tutto</h2>
            <p className="text-xs text-zinc-500">
              {terminalAvailable ? "Voz + Terminal + IA" : "Voz + IA (sin terminal)"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSttMode(sttMode === "elevenlabs" ? "browser" : "elevenlabs")}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              sttMode === "elevenlabs"
                ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                : "bg-zinc-800 text-zinc-500 border border-zinc-700"
            }`}
            title={sttMode === "elevenlabs" ? "STT: ElevenLabs (Scribe)" : "STT: Browser nativo"}
          >
            {sttMode === "elevenlabs" ? "STT: EL" : "STT: Nav"}
          </button>
          <button
            onClick={() => setAutoPlayAudio(!autoPlayAudio)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${
              autoPlayAudio
                ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                : "bg-zinc-800 text-zinc-500 border border-zinc-700"
            }`}
          >
            {autoPlayAudio ? "Audio ON" : "Audio OFF"}
          </button>
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
                {terminalAvailable
                  ? "Habla conmigo por texto o por voz. Puedo ejecutar comandos, controlar Claude Code en la terminal, y responderte con audio."
                  : "Habla conmigo por texto o por voz. La terminal no esta disponible ahora, pero puedo ayudarte con preguntas, codigo, y mas."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {(terminalAvailable
                ? [
                    "Ejecuta ls -la en la terminal",
                    "Abre Claude Code en la terminal",
                    "Cual es el uso de disco?",
                  ]
                : [
                    "Explicame como funciona async/await",
                    "Ayudame a escribir un email",
                    "Que puedo cocinar con pollo?",
                  ]
              ).map((suggestion) => (
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
                message.role === "user" ? "bg-zinc-700" : "bg-violet-600"
              }`}
            >
              {message.role === "user" ? (
                <User size={14} className="text-zinc-300" />
              ) : (
                <Bot size={14} className="text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {/* Tool actions */}
              {message.toolActions && message.toolActions.length > 0 && (
                <div className="mb-2 space-y-1.5">
                  {message.toolActions.map((action) => (
                    <div
                      key={action.id}
                      className="flex items-start gap-2 text-xs p-2 rounded-lg bg-zinc-900 border border-zinc-800"
                    >
                      <div className="mt-0.5">
                        {action.tool === "send_to_terminal" ? (
                          <Play
                            size={12}
                            className={
                              action.status === "done"
                                ? "text-green-400"
                                : "text-yellow-400 animate-pulse"
                            }
                          />
                        ) : (
                          <Eye
                            size={12}
                            className={
                              action.status === "done"
                                ? "text-blue-400"
                                : "text-yellow-400 animate-pulse"
                            }
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-300">
                            {action.tool === "send_to_terminal" ? (
                              <>
                                <TerminalIcon
                                  size={10}
                                  className="inline mr-1"
                                />
                                Enviado a terminal
                              </>
                            ) : (
                              <>
                                <Eye size={10} className="inline mr-1" />
                                Leyendo terminal
                              </>
                            )}
                          </span>
                          {action.status === "executing" && (
                            <Loader2
                              size={10}
                              className="animate-spin text-yellow-400"
                            />
                          )}
                        </div>
                        {action.input &&
                          action.tool === "send_to_terminal" && (
                            <code className="block mt-1 text-violet-300 bg-zinc-800 px-2 py-0.5 rounded truncate">
                              {String(
                                (action.input as Record<string, unknown>)
                                  .text || ""
                              )
                                .replace(/\n/g, "\\n")
                                .slice(0, 100)}
                            </code>
                          )}
                        {action.result &&
                          action.tool === "read_terminal" && (
                            <pre className="mt-1 text-zinc-500 bg-zinc-800 px-2 py-1 rounded max-h-20 overflow-y-auto whitespace-pre-wrap text-[10px]">
                              {action.result}
                            </pre>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Message content */}
              {message.content && (
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
              )}

              {/* Audio player for assistant messages */}
              {message.role === "assistant" &&
                message.hasAudio &&
                autoPlayAudio &&
                message.content && (
                  <div className="mt-2">
                    <AudioMessage
                      text={message.content}
                      messageId={message.id}
                    />
                  </div>
                )}
            </div>
          </div>
        ))}

        {isLoading &&
          messages[messages.length - 1]?.content === "" &&
          (messages[messages.length - 1]?.toolActions?.length ?? 0) ===
            0 && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm pl-10">
              <Loader2 size={14} className="animate-spin" />
              Pensando...
            </div>
          )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
        {/* Recording / transcribing indicator */}
        {isListening && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400">
              Escuchando... {sttMode === "browser" && transcript && `"${transcript}"`}
            </span>
          </div>
        )}
        {isTranscribing && (
          <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Loader2 size={12} className="animate-spin text-emerald-400" />
            <span className="text-xs text-emerald-400">
              Transcribiendo con ElevenLabs...
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 bg-zinc-900 rounded-xl border border-zinc-700 focus-within:border-violet-500 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening ? "Escuchando..." : "Escribe o habla..."
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-200 placeholder-zinc-600 px-4 py-3 outline-none max-h-32"
            style={{ minHeight: "44px" }}
          />

          {/* Mic button */}
          {micSupported && (
            <button
              onClick={handleMicToggle}
              disabled={isTranscribing}
              className={`p-2 m-1 rounded-lg transition-colors ${
                isListening
                  ? "bg-red-500 text-white animate-pulse"
                  : isTranscribing
                    ? "text-emerald-400 animate-pulse bg-zinc-800"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {isTranscribing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isListening ? (
                <MicOff size={16} />
              ) : (
                <Mic size={16} />
              )}
            </button>
          )}

          {/* Send button */}
          <button
            onClick={() => sendMessage()}
            disabled={
              (!input.trim() && !transcript.trim()) || isLoading
            }
            className="p-2 m-1 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
