import { useEffect, useRef, useState } from "react";
import { containsAivaWakeWord } from "./wakeWordCore";

export type AivaWakeWordStatus = "starting" | "listening" | "paused" | "blocked" | "unsupported";

interface RecognitionAlternative { transcript: string; }
interface RecognitionResult { readonly length: number; [index: number]: RecognitionAlternative; }
interface RecognitionEvent { readonly results: { readonly length: number; [index: number]: RecognitionResult }; }
interface RecognitionErrorEvent { error: string; }
interface BrowserRecognition {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; abort(): void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
}
type RecognitionConstructor = new () => BrowserRecognition;

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  const browser = window as typeof window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return browser.SpeechRecognition || browser.webkitSpeechRecognition;
}

export function useAivaWakeWord({ enabled, paused, onWake }: { enabled: boolean; paused: boolean; onWake: () => void }) {
  const [status, setStatus] = useState<AivaWakeWordStatus>(paused ? "paused" : "starting");
  const onWakeRef = useRef(onWake);
  const lastWakeAt = useRef(0);
  useEffect(() => { onWakeRef.current = onWake; }, [onWake]);

  useEffect(() => {
    if (!enabled || paused) { setStatus("paused"); return; }
    const Constructor = getRecognitionConstructor();
    if (!Constructor) { setStatus("unsupported"); return; }
    let cancelled = false;
    let blocked = false;
    let restartTimer: number | undefined;
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-PT";
    recognition.onstart = () => { if (!cancelled) setStatus("listening"); };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        blocked = true;
        if (!cancelled) setStatus("blocked");
      }
    };
    recognition.onresult = (event) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) transcript += ` ${event.results[index][0]?.transcript || ""}`;
      const now = Date.now();
      if (containsAivaWakeWord(transcript) && now - lastWakeAt.current > 5_000) {
        lastWakeAt.current = now;
        onWakeRef.current();
      }
    };
    const start = () => {
      if (cancelled || blocked) return;
      try { recognition.start(); } catch { restartTimer = window.setTimeout(start, 750); }
    };
    recognition.onend = () => { if (!cancelled && !blocked) restartTimer = window.setTimeout(start, 500); };
    setStatus("starting");
    start();
    return () => {
      cancelled = true;
      if (restartTimer) window.clearTimeout(restartTimer);
      recognition.onend = null;
      recognition.abort();
    };
  }, [enabled, paused]);

  return status;
}
