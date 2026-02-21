"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, Loader2 } from "lucide-react";

interface AudioMessageProps {
  text: string;
  messageId: string;
}

export default function AudioMessage({ text, messageId }: AudioMessageProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (audioBlobUrl.current) {
        URL.revokeObjectURL(audioBlobUrl.current);
      }
    };
  }, []);

  const loadAndPlay = async () => {
    // If we already have the audio, just play/pause
    if (audioRef.current && audioBlobUrl.current) {
      if (status === "playing") {
        audioRef.current.pause();
        setStatus("paused");
      } else {
        audioRef.current.play();
        setStatus("playing");
      }
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("TTS error:", error);
        setStatus("error");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      audioBlobUrl.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration);
      };

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      };

      audio.onended = () => {
        setStatus("paused");
        setProgress(0);
      };

      audio.onerror = () => {
        setStatus("error");
      };

      await audio.play();
      setStatus("playing");
    } catch {
      setStatus("error");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const currentTime = audioRef.current?.currentTime || 0;

  return (
    <div
      key={messageId}
      className="flex items-center gap-3 px-3 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 max-w-xs"
    >
      <button
        onClick={loadAndPlay}
        disabled={status === "loading"}
        className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center flex-shrink-0 hover:bg-violet-500 transition-colors disabled:opacity-50"
      >
        {status === "loading" ? (
          <Loader2 size={14} className="text-white animate-spin" />
        ) : status === "playing" ? (
          <Pause size={14} className="text-white" />
        ) : (
          <Play size={14} className="text-white ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Waveform-like progress bar */}
        <div className="flex items-center gap-[2px] h-6">
          {Array.from({ length: 30 }).map((_, i) => {
            const barProgress = (i / 30) * 100;
            const isActive = barProgress <= progress;
            // Generate pseudo-random heights for waveform look
            const height = 4 + Math.abs(Math.sin(i * 0.7 + messageId.charCodeAt(0))) * 16;
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-colors ${
                  isActive ? "bg-violet-400" : "bg-zinc-600"
                }`}
                style={{ height: `${height}px` }}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-zinc-500">
            {status === "playing" || status === "paused"
              ? formatTime(currentTime)
              : status === "loading"
                ? "cargando..."
                : status === "error"
                  ? "error"
                  : ""}
          </span>
          {duration > 0 && (
            <span className="text-[10px] text-zinc-500">
              {formatTime(duration)}
            </span>
          )}
        </div>
      </div>

      <Volume2 size={12} className="text-zinc-500 flex-shrink-0" />
    </div>
  );
}
