"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import { fetchAuth, authUrl } from "@/lib/fetch-auth";

export function SpeechListener() {
  const [speaking, setSpeaking] = useState(false);
  const [lastText, setLastText] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(authUrl("/api/speak"));

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected" || !data.text) return;

        setLastText(data.text);
        setSpeaking(true);

        // Fetch TTS audio
        const response = await fetchAuth("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: data.text }),
        });

        if (!response.ok) {
          console.error("TTS error:", response.status);
          setSpeaking(false);
          return;
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        // Stop previous audio if playing
        if (audioRef.current) {
          audioRef.current.pause();
          URL.revokeObjectURL(audioRef.current.src);
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setSpeaking(false);
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      } catch (err) {
        console.error("Speech listener error:", err);
        setSpeaking(false);
      }
    };

    eventSource.onerror = () => {
      // Will auto-reconnect
    };

    return () => {
      eventSource.close();
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (!speaking && !lastText) return null;

  return (
    <div
      className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-full shadow-lg transition-all duration-300 ${
        speaking
          ? "bg-violet-600 text-white scale-100 opacity-100"
          : "bg-zinc-800 text-zinc-400 scale-95 opacity-0 pointer-events-none"
      }`}
    >
      <Volume2 size={16} className={speaking ? "animate-pulse" : ""} />
      <span className="text-sm max-w-[250px] truncate">{lastText}</span>
    </div>
  );
}
