import { useCallback, useEffect, useRef, useState } from "react";
import type { AivaVisualState } from "./aivaVisual.types";
import type { AivaBrainId } from "../../lib/aivaBrain";
import type { AivaRealtimeVoice } from "../../lib/aivaRealtimeVoice";
import { appendAivaMessage, type AivaConversation } from "../../lib/aivaConversation";
import type { MutableRefObject } from "react";
import type { AivaToolCall, AivaToolResult } from "../../lib/aivaTools";
import { isConciseCompletionTool } from "../../lib/aivaTools";
import { advanceVoiceSilence, createVoiceSilenceState, describeVoiceCaptureError, replaceVoiceRequest, type VoiceCaptureStage } from "./voiceSilence";

interface UseAivaOptions {
  muted: boolean;
  voice: AivaRealtimeVoice;
  conversation: MutableRefObject<AivaConversation>;
  brain?: AivaBrainId;
  context?: string;
  onToolCalls?: (calls: AivaToolCall[], signal?: AbortSignal) => Promise<AivaToolResult[]>;
}

export function useAivaVisualState({ muted, voice, conversation, brain = "mark-i", context = "aiva", onToolCalls }: UseAivaOptions) {
  const [state, setState] = useState<AivaVisualState>("idle");
  const [userMessage, setUserMessage] = useState("");
  const [response, setResponse] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("");
  const requestController = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const discardRecording = useRef(false);
  const audioContext = useRef<AudioContext | null>(null);
  const silenceFrame = useRef<number | null>(null);
  const activeAudio = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrl = useRef<string | null>(null);

  const stopSilenceDetection = useCallback(() => {
    if (silenceFrame.current !== null) cancelAnimationFrame(silenceFrame.current);
    silenceFrame.current = null;
    if (audioContext.current) void audioContext.current.close();
    audioContext.current = null;
  }, []);

  const releaseMicrophone = useCallback(() => {
    stopSilenceDetection();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    mediaStream.current = null;
    recorder.current = null;
  }, [stopSilenceDetection]);

  const detectSilence = useCallback((stream: MediaStream) => {
    stopSilenceDetection();
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.2;
    context.createMediaStreamSource(stream).connect(analyser);
    audioContext.current = context;
    const samples = new Uint8Array(analyser.fftSize);
    let silenceState = createVoiceSilenceState();

    const measure = () => {
      if (recorder.current?.state !== "recording") return;
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) {
        const amplitude = (sample - 128) / 128;
        energy += amplitude * amplitude;
      }
      const rms = Math.sqrt(energy / samples.length);
      const result = advanceVoiceSilence(silenceState, rms >= 0.025, performance.now());
      silenceState = result.state;
      if (result.shouldStop) {
        recorder.current.stop();
        return;
      }
      silenceFrame.current = requestAnimationFrame(measure);
    };

    silenceFrame.current = requestAnimationFrame(measure);
  }, [stopSilenceDetection]);

  const stopPlayback = useCallback(() => {
    if (activeAudio.current) {
      activeAudio.current.pause();
      activeAudio.current.currentTime = 0;
      activeAudio.current = null;
    }
    if (activeAudioUrl.current) {
      URL.revokeObjectURL(activeAudioUrl.current);
      activeAudioUrl.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback(async (text: string, signal: AbortSignal) => {
    if (muted) return;
    setState("speaking");
    try {
      const result = await fetch("/api/aiva/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
        signal,
      });
      if (!result.ok) throw new Error("TTS_UNAVAILABLE");
      const blob = await result.blob();
      const url = URL.createObjectURL(blob);
      activeAudioUrl.current = url;
      const audio = new Audio(url);
      activeAudio.current = audio;
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error("AUDIO_PLAYBACK_FAILED"));
        audio.play().catch(reject);
      });
    } catch (error) {
      if (signal.aborted) return;
      setNotice("Voz temporariamente indisponível");
    } finally {
      stopPlayback();
    }
  }, [muted, stopPlayback, voice]);

  useEffect(() => {
    fetch("/api/aiva/status")
      .then((result) => result.json())
      .then((data: { configured?: boolean }) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));
    return () => {
      requestController.current?.abort();
      if (recorder.current?.state === "recording") recorder.current.stop();
      releaseMicrophone();
      stopPlayback();
    };
  }, [releaseMicrophone, stopPlayback]);

  useEffect(() => {
    if (!muted) return;
    stopPlayback();
    setState((current) => current === "speaking" ? "idle" : current);
  }, [muted, stopPlayback]);

  const runInteraction = useCallback(async (message: string, audible = true) => {
    const clean = message.trim();
    if (!clean) return;
    const controller = replaceVoiceRequest(requestController.current);
    requestController.current = controller;
    stopPlayback();
    setUserMessage(clean);
    setResponse("");
    setNotice("");
    setState("thinking");
    let previousResponseId: string | null = null;
    const history = conversation.current.messages.slice();
    if (history.at(-1)?.role === "user" && history.at(-1)?.content === clean) history.pop();
    appendAivaMessage(conversation.current, "user", clean);

    try {
      let payload: { message?: string; history?: typeof history; previousResponseId?: string | null; brain: AivaBrainId; context?: string; toolResults?: AivaToolResult[] } = { message: clean, history, brain, context };
      let answer = "";
      for (let turn = 0; turn < (brain === "mark-ii" ? 12 : 5); turn += 1) {
        if (controller.signal.aborted) return;
        const result = await fetch("/api/aiva/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
        const data = await result.json() as { text?: string; responseId?: string; toolCalls?: AivaToolCall[]; error?: string; code?: string };
        if (!result.ok) throw new Error(data.code || data.error || "AIVA_REQUEST_FAILED");
        previousResponseId = data.responseId ?? previousResponseId;
        const calls = Array.isArray(data.toolCalls) ? data.toolCalls : [];
        if (!calls.length) { answer = data.text?.trim() || "A ação ficou concluída."; break; }
        if (!onToolCalls) throw new Error("AIVA_ACTION_HOST_UNAVAILABLE");
        setNotice(`A executar ${calls.length === 1 ? "uma ação" : `${calls.length} ações`}`);
        const toolResults = await onToolCalls(calls, controller.signal);
        if (controller.signal.aborted) return;
        if (calls.every((call) => isConciseCompletionTool(call.name)) && toolResults.every((result) => result.ok)) {
          answer = "Feito.";
          break;
        }
        payload = { brain, context, previousResponseId, toolResults };
      }
      if (!answer) answer = "Interrompi a sequência para evitar ações repetidas. Confirme o estado antes de continuar.";
      setNotice("");
      setResponse(answer);
      appendAivaMessage(conversation.current, "assistant", answer);
      if (audible) await speak(answer, controller.signal);
      if (!controller.signal.aborted) {
        setState("success");
        window.setTimeout(() => { if (requestController.current === controller && !controller.signal.aborted) setState("idle"); }, 900);
      }
      return answer;
    } catch (error) {
      if (controller.signal.aborted) return;
      const notConfigured = error instanceof Error && error.message === "AIVA_NOT_CONFIGURED";
      setConfigured(notConfigured ? false : configured);
      setResponse(notConfigured
        ? "Estou pronta para assumir o meu papel, mas a ligação segura à OpenAI ainda não tem uma API key configurada no servidor."
        : "Não consegui estabelecer ligação ao meu núcleo de inteligência. Tente novamente dentro de instantes.");
      setNotice(notConfigured ? "Configuração necessária" : "Falha de ligação");
      setState(notConfigured ? "warning" : "error");
      if (!audible) throw error;
    }
  }, [brain, configured, context, conversation, onToolCalls, speak, stopPlayback]);

  const transcribeAndRespond = useCallback(async (audio: Blob) => {
    const controller = replaceVoiceRequest(requestController.current);
    requestController.current = controller;
    setState("thinking");
    try {
      const result = await fetch("/api/aiva/transcribe", { method: "POST", headers: { "Content-Type": audio.type || "audio/webm" }, body: audio, signal: controller.signal });
      const data = await result.json() as { text?: string; code?: string; error?: string };
      if (!result.ok) throw new Error(data.code || data.error);
      if (controller.signal.aborted) return;
      if (data.text?.trim()) await runInteraction(data.text);
      else setState("idle");
    } catch (error) {
      if (controller.signal.aborted) return;
      setNotice(error instanceof Error && error.message === "AIVA_NOT_CONFIGURED" ? "Configure a API key para ativar a voz" : "Não consegui compreender o áudio");
      setState("warning");
    }
  }, [runInteraction]);

  const startListening = useCallback(async () => {
    requestController.current?.abort();
    stopPlayback();
    let captureStage: VoiceCaptureStage = "microphone";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mediaStream.current = stream;
      recordedChunks.current = [];
      discardRecording.current = false;
      captureStage = "recorder";
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const audio = new Blob(recordedChunks.current, { type: mediaRecorder.mimeType || "audio/webm" });
        releaseMicrophone();
        if (!discardRecording.current && audio.size > 0) void transcribeAndRespond(audio);
        discardRecording.current = false;
      };
      captureStage = "analysis";
      detectSilence(stream);
      captureStage = "recording";
      mediaRecorder.start(250);
      setNotice("");
      setState("listening");
    } catch (error) {
      discardRecording.current = true;
      if (recorder.current?.state === "recording") recorder.current.stop();
      else releaseMicrophone();
      console.error("[AIVA voice]", captureStage, error);
      setNotice(describeVoiceCaptureError(captureStage, error));
      setState("warning");
    }
  }, [detectSilence, releaseMicrophone, stopPlayback, transcribeAndRespond]);

  const toggleListening = useCallback(() => {
    if (state === "listening" && recorder.current?.state === "recording") {
      recorder.current.stop();
      return;
    }
    // Barge-in: speaking is cancelled before the microphone opens.
    stopPlayback();
    void startListening();
  }, [startListening, state, stopPlayback]);

  const stop = useCallback(() => {
    requestController.current?.abort();
    stopPlayback();
    discardRecording.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    releaseMicrophone();
    setState("idle");
  }, [releaseMicrophone, stopPlayback]);

  const newSession = useCallback(() => {
    stop();
    conversation.current = { id: crypto.randomUUID(), messages: [] };
    setUserMessage("");
    setResponse("");
    setNotice("");
  }, [conversation, stop]);

  return { state, userMessage, response, configured, notice, runInteraction, toggleListening, stop, newSession };
}
