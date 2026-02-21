"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, Mic, MicOff, Loader2 } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { fetchAuth } from "@/lib/fetch-auth";

interface SentMessage {
  id: string;
  text: string;
}

export default function ChatPanel() {
  const [sent, setSent] = useState<SentMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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
  }, [sent, scrollToBottom]);

  useEffect(() => {
    if (transcript && sttMode === "browser") {
      setInput(transcript);
    }
  }, [transcript, sttMode]);

  const handleMicToggle = async () => {
    if (isListening) {
      const text = await stopListening();
      if (text.trim()) sendMessage(text);
    } else {
      setInput("");
      startListening();
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText?.trim() || input.trim() || transcript.trim();
    if (!text || sending) return;
    if (isListening) stopListening();

    setInput("");
    setSending(true);
    setSent((prev) => [...prev, { id: crypto.randomUUID(), text }]);

    try {
      await fetchAuth("/api/pty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "input", data: text + "\n" }),
      });
    } catch (err) {
      console.error("Failed to send to PTY:", err);
    } finally {
      setSending(false);
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
            <p className="text-xs text-zinc-500">Envía a Claude Code</p>
          </div>
        </div>
        <button
          onClick={() => setSttMode(sttMode === "elevenlabs" ? "browser" : "elevenlabs")}
          className={`text-xs px-2 py-1 rounded-md transition-colors ${
            sttMode === "elevenlabs"
              ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
              : "bg-zinc-800 text-zinc-500 border border-zinc-700"
          }`}
        >
          {sttMode === "elevenlabs" ? "STT: EL" : "STT: Nav"}
        </button>
      </div>

      {/* Sent messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {sent.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-600/20 flex items-center justify-center">
              <Bot size={32} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-200">Hola, soy Tutto</h3>
              <p className="text-sm text-zinc-500 mt-1 max-w-sm">
                Escribe o habla y tu mensaje se envía directo a Claude Code en la terminal.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {["hazme un hello world en python", "explica este proyecto", "ejecuta los tests"].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {sent.map((msg) => (
          <div key={msg.id} className="flex items-start gap-2">
            <span className="text-violet-400 text-xs mt-1">→</span>
            <p className="text-sm text-zinc-300">{msg.text}</p>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800">
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
            <span className="text-xs text-emerald-400">Transcribiendo...</span>
          </div>
        )}

        <div className="flex items-end gap-2 bg-zinc-900 rounded-xl border border-zinc-700 focus-within:border-violet-500 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Escuchando..." : "Escribe o habla..."}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-zinc-200 placeholder-zinc-600 px-4 py-3 outline-none max-h-32"
            style={{ minHeight: "44px" }}
          />
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
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && !transcript.trim()) || sending}
            className="p-2 m-1 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
