"use client";

import { useState, useRef, useCallback } from "react";

export type SttMode = "elevenlabs" | "browser";

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => Promise<string>;
  isSupported: boolean;
  sttMode: SttMode;
  setSttMode: (mode: SttMode) => void;
  isTranscribing: boolean;
}

// ── Web Speech API types ──
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: { transcript: string; confidence: number };
      isFinal: boolean;
    };
    length: number;
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

// ── Hook ──
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [sttMode, setSttMode] = useState<SttMode>("elevenlabs");

  // Refs for ElevenLabs mode
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const resolveStopRef = useRef<((text: string) => void) | null>(null);

  // Refs for browser mode
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const browserTranscriptRef = useRef("");

  const hasBrowserStt =
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const hasMediaRecorder =
    typeof window !== "undefined" && !!window.MediaRecorder;

  const isSupported =
    sttMode === "elevenlabs" ? hasMediaRecorder : hasBrowserStt;

  // ── ElevenLabs: start recording ──
  const startElevenLabs = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks so the browser mic indicator goes away
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setIsListening(false);
          resolveStopRef.current?.("");
          resolveStopRef.current = null;
          return;
        }

        setIsTranscribing(true);
        try {
          const form = new FormData();
          form.append("file", blob, "audio.webm");

          const res = await fetch("/api/stt", { method: "POST", body: form });
          const data = await res.json();
          const text = data.text || "";
          setTranscript(text);
          resolveStopRef.current?.(text);
        } catch {
          resolveStopRef.current?.("");
        } finally {
          setIsTranscribing(false);
          setIsListening(false);
          resolveStopRef.current = null;
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect chunks every 250ms
      setIsListening(true);
      setTranscript("");
    } catch {
      setIsListening(false);
    }
  }, []);

  // ── ElevenLabs: stop recording ──
  const stopElevenLabs = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      resolveStopRef.current = resolve;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current = null;
      } else {
        resolve("");
        setIsListening(false);
      }
    });
  }, []);

  // ── Browser: start ──
  const startBrowser = useCallback(() => {
    if (!hasBrowserStt) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "es-ES";

    browserTranscriptRef.current = "";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const full = final + interim;
      browserTranscriptRef.current = full;
      setTranscript(full);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript("");
  }, [hasBrowserStt]);

  // ── Browser: stop ──
  const stopBrowser = useCallback((): Promise<string> => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    return Promise.resolve(browserTranscriptRef.current);
  }, []);

  // ── Public API ──
  const startListening = useCallback(() => {
    if (sttMode === "elevenlabs") {
      startElevenLabs();
    } else {
      startBrowser();
    }
  }, [sttMode, startElevenLabs, startBrowser]);

  const stopListening = useCallback((): Promise<string> => {
    if (sttMode === "elevenlabs") {
      return stopElevenLabs();
    } else {
      return stopBrowser();
    }
  }, [sttMode, stopElevenLabs, stopBrowser]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    sttMode,
    setSttMode,
    isTranscribing,
  };
}
