"use client";

import { useRef, useCallback, useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import TerminalPanel, { TerminalPanelHandle } from "@/components/TerminalPanel";
import { Bot, Terminal, PanelLeftClose, PanelLeft } from "lucide-react";

export default function Home() {
  const terminalRef = useRef<TerminalPanelHandle>(null);
  const [activePanel, setActivePanel] = useState<"chat" | "terminal">("chat");
  const [showBoth, setShowBoth] = useState(true);

  const handleRunCommand = useCallback((command: string, cwd?: string) => {
    terminalRef.current?.executeCommand(command, cwd);
    // Switch to show terminal on mobile
    setActivePanel("terminal");
  }, []);

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">T</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-200">Tutto</h1>
          <span className="text-xs text-zinc-600 hidden sm:inline">|</span>
          <span className="text-xs text-zinc-500 hidden sm:inline">
            Tu asistente para todo
          </span>
        </div>

        {/* Mobile panel switcher */}
        <div className="flex items-center gap-1 md:hidden">
          <button
            onClick={() => setActivePanel("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activePanel === "chat"
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Bot size={14} />
            Chat
          </button>
          <button
            onClick={() => setActivePanel("terminal")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activePanel === "terminal"
                ? "bg-violet-600 text-white"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal size={14} />
            Terminal
          </button>
        </div>

        {/* Desktop toggle */}
        <button
          onClick={() => setShowBoth(!showBoth)}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          {showBoth ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
          {showBoth ? "Solo chat" : "Mostrar terminal"}
        </button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div
          className={`${
            showBoth ? "md:w-1/2" : "md:w-full"
          } ${activePanel === "chat" ? "w-full" : "hidden md:block"} border-r border-zinc-800`}
        >
          <ChatPanel onRunCommand={handleRunCommand} />
        </div>

        {/* Terminal panel */}
        {showBoth && (
          <div
            className={`md:w-1/2 ${
              activePanel === "terminal" ? "w-full" : "hidden md:block"
            }`}
          >
            <TerminalPanel ref={terminalRef} />
          </div>
        )}
      </div>
    </div>
  );
}
