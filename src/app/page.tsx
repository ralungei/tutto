"use client";

import { useState } from "react";
import ChatPanel from "@/components/ChatPanel";
import TerminalPanel from "@/components/TerminalPanel";
import { useTerminalStatus } from "@/hooks/useTerminalStatus";
import {
  Bot,
  Terminal,
  PanelLeftClose,
  PanelLeft,
  Wifi,
  WifiOff,
} from "lucide-react";

export default function Home() {
  const [activePanel, setActivePanel] = useState<"chat" | "terminal">("chat");
  const [showBoth, setShowBoth] = useState(true);
  const { status: terminalStatus } = useTerminalStatus();

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">T</span>
          </div>
          <h1 className="text-sm font-semibold text-zinc-200">Tutto</h1>

          {/* Terminal status indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
              terminalStatus === "connected"
                ? "bg-green-500/10 text-green-400"
                : terminalStatus === "disconnected"
                  ? "bg-red-500/10 text-red-400"
                  : "bg-yellow-500/10 text-yellow-400"
            }`}
          >
            {terminalStatus === "connected" ? (
              <Wifi size={10} />
            ) : (
              <WifiOff size={10} />
            )}
            {terminalStatus === "connected"
              ? "Terminal"
              : terminalStatus === "disconnected"
                ? "Sin terminal"
                : "..."}
          </div>
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
          {terminalStatus === "connected" && (
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
          )}
        </div>

        {/* Desktop toggle */}
        {terminalStatus === "connected" && (
          <button
            onClick={() => setShowBoth(!showBoth)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            {showBoth ? (
              <PanelLeftClose size={14} />
            ) : (
              <PanelLeft size={14} />
            )}
            {showBoth ? "Solo chat" : "Mostrar terminal"}
          </button>
        )}
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div
          className={`${
            showBoth && terminalStatus === "connected"
              ? "md:w-1/2"
              : "md:w-full"
          } ${activePanel === "chat" ? "w-full" : "hidden md:block"} border-r border-zinc-800`}
        >
          <ChatPanel />
        </div>

        {/* Terminal panel - only show when connected */}
        {showBoth && terminalStatus === "connected" && (
          <div
            className={`md:w-1/2 ${
              activePanel === "terminal" ? "w-full" : "hidden md:block"
            }`}
          >
            <TerminalPanel />
          </div>
        )}
      </div>
    </div>
  );
}
