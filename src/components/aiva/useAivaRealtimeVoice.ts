import { useCallback, useEffect, useRef, useState } from "react";
import type { AivaRealtimeVoice } from "../../lib/aivaRealtimeVoice";
import type { AivaToolCall, AivaToolResult } from "../../lib/aivaTools";
import type { AivaBrainId } from "../../lib/aivaBrain";
import { isConciseCompletionTool } from "../../lib/aivaTools";
import { createRealtimeEventState, reduceRealtimeEvent, type AivaRealtimeEventState } from "./aivaRealtimeCore";
import { isHandsFreeStopPhrase } from "./wakeWordCore";
import type { AivaConversation } from "../../lib/aivaConversation";
import type { MutableRefObject } from "react";
import { AIVA_SPEECH_RULES, realtimeReply, RECOVERABLE_REALTIME_ERRORS } from "../../lib/aivaVoicePolicy";

interface UseAivaRealtimeVoiceOptions {
  voice: AivaRealtimeVoice;
  muted: boolean;
  onUserTranscript: (text: string) => void;
  onAssistantTranscript: (text: string) => void;
  onToolCall?: (call: AivaToolCall) => Promise<AivaToolResult>;
  brain?: AivaBrainId;
  context?: string;
  onTurnComplete?: (role: "user" | "assistant", text: string) => void;
  onStopPhrase?: () => void;
  conversation?: MutableRefObject<AivaConversation>;
}

const OFF_STATE: AivaRealtimeEventState = {
  status: "off",
  userTranscript: "",
  assistantTranscript: "",
  notice: "",
};

export function useAivaRealtimeVoice({ voice, muted, onUserTranscript, onAssistantTranscript, onToolCall, brain = "mark-i", context = "overview", onTurnComplete, onStopPhrase, conversation }: UseAivaRealtimeVoiceOptions) {
  const [eventState, setEventState] = useState<AivaRealtimeEventState>(OFF_STATE);
  const stateRef = useRef<AivaRealtimeEventState>(OFF_STATE);
  const peer = useRef<RTCPeerConnection | null>(null);
  const channel = useRef<RTCDataChannel | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const remoteAudio = useRef<HTMLAudioElement | null>(null);
  const sessionVersion = useRef(0);
  const transcriptCallbacks = useRef({ onUserTranscript, onAssistantTranscript });
  const toolCallback = useRef(onToolCall);
  const completeCallback = useRef(onTurnComplete);
  completeCallback.current = onTurnComplete;
  const stopPhraseCallback = useRef(onStopPhrase);
  stopPhraseCallback.current = onStopPhrase;
  const pendingTools = useRef(0);
  const completedTools = useRef<Array<{ name: string; ok: boolean }>>([]);
  const seenCalls = useRef(new Set<string>());
  const [executing, setExecuting] = useState(false);
  const configurationQueue = useRef<Promise<void>>(Promise.resolve());
  const configAck = useRef<{ instructions: string; resolve: () => void; reject: (error: Error) => void } | null>(null);
  const responseInFlight = useRef(false);
  const sessionInstructions = useRef(AIVA_SPEECH_RULES);
  const pendingReply = useRef<Record<string, unknown> | null>(null);
  const flushReply = useCallback(() => {
    if (pendingTools.current === 0 && !responseInFlight.current && pendingReply.current && channel.current?.readyState === "open") {
      responseInFlight.current = true;
      channel.current.send(JSON.stringify(pendingReply.current)); pendingReply.current = null;
    }
  }, []);
  const updateConfiguration = useCallback((nextBrain: AivaBrainId, nextContext: string) => {
    const version = sessionVersion.current;
    const update = configurationQueue.current.catch(() => undefined).then(async () => {
      const response = await fetch(`/api/aiva/realtime/config?brain=${nextBrain}&context=${encodeURIComponent(nextContext)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível atualizar o cérebro.");
      if (version !== sessionVersion.current) throw new Error("Sessão encerrada.");
      if (channel.current?.readyState !== "open") return;
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => { configAck.current = null; reject(new Error("O canal de voz não confirmou a troca de cérebro.")); }, 8000);
        configAck.current = { instructions: data.instructions, resolve: () => { clearTimeout(timer); sessionInstructions.current = data.instructions; configAck.current = null; resolve(); }, reject: error => { clearTimeout(timer); configAck.current = null; reject(error); } };
        channel.current!.send(JSON.stringify({ type: "session.update", session: { type: "realtime", instructions: data.instructions, tools: data.tools } }));
      });
    });
    configurationQueue.current = update;
    return update;
  }, []);

  useEffect(() => {
    transcriptCallbacks.current = { onUserTranscript, onAssistantTranscript };
  }, [onAssistantTranscript, onUserTranscript]);

  useEffect(() => { toolCallback.current = onToolCall; }, [onToolCall]);

  const updateState = useCallback((next: AivaRealtimeEventState) => {
    const previous = stateRef.current;
    stateRef.current = next;
    setEventState(next);
    if (next.userTranscript !== previous.userTranscript) transcriptCallbacks.current.onUserTranscript(next.userTranscript);
    if (next.assistantTranscript !== previous.assistantTranscript) transcriptCallbacks.current.onAssistantTranscript(next.assistantTranscript);
  }, []);

  const disposeResources = useCallback(() => {
    if (channel.current) {
      channel.current.onmessage = null;
      channel.current.onopen = null;
      channel.current.onerror = null;
      if (channel.current.readyState !== "closed") channel.current.close();
      channel.current = null;
    }
    if (peer.current) {
      peer.current.ontrack = null;
      peer.current.onconnectionstatechange = null;
      peer.current.close();
      peer.current = null;
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (remoteAudio.current) {
      remoteAudio.current.pause();
      remoteAudio.current.srcObject = null;
      remoteAudio.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionVersion.current += 1;
    disposeResources();
    updateState(OFF_STATE);
    pendingTools.current = 0;
    completedTools.current = []; seenCalls.current.clear();
    setExecuting(false);
    pendingReply.current = null; responseInFlight.current = false;
    configAck.current?.reject(new Error("Sessão encerrada."));
  }, [disposeResources, updateState]);

  const fail = useCallback((notice: string, version: number) => {
    if (version !== sessionVersion.current) return;
    disposeResources();
    configAck.current?.reject(new Error(notice));
    pendingTools.current = 0; setExecuting(false);
    updateState({ ...stateRef.current, status: "error", notice });
  }, [disposeResources, updateState]);

  const start = useCallback(async (selectedVoice: AivaRealtimeVoice = voice, selectedBrain: AivaBrainId = brain, initialPrompt = "") => {
    stop();
    const version = ++sessionVersion.current;
    updateState(createRealtimeEventState());

    try {
      const microphone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (version !== sessionVersion.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = microphone;

      const connection = new RTCPeerConnection();
      peer.current = connection;
      const audio = new Audio();
      audio.autoplay = true;
      audio.muted = muted;
      remoteAudio.current = audio;
      connection.ontrack = (event) => {
        audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
        void audio.play().catch(() => fail("A aplicação bloqueou a reprodução de áudio.", version));
      };
      connection.onconnectionstatechange = () => {
        if (version !== sessionVersion.current) return;
        if (connection.connectionState === "failed") fail("A ligação de voz foi interrompida.", version);
      };
      for (const track of microphone.getAudioTracks()) connection.addTrack(track, microphone);

      const dataChannel = connection.createDataChannel("oai-events");
      channel.current = dataChannel;
      dataChannel.onopen = () => {
        void updateConfiguration(selectedBrain, context).then(() => {
          if (!initialPrompt || version !== sessionVersion.current || dataChannel.readyState !== "open") return;
          dataChannel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text: initialPrompt }] } }));
          pendingReply.current = realtimeReply(sessionInstructions.current, "greeting"); flushReply();
        }).catch(() => fail("Não foi possível configurar a sessão.", version));
        for (const item of conversation?.current.messages || []) dataChannel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "message", role: item.role, content: [{ type: item.role === "user" ? "input_text" : "output_text", text: item.content }] } }));
      };
      dataChannel.onmessage = (message) => {
        if (version !== sessionVersion.current) return;
        try {
          const event = JSON.parse(String(message.data)) as Record<string, unknown>;
          if (event.type === "error" && RECOVERABLE_REALTIME_ERRORS.has((event.error as { code?: string })?.code || "")) return;
          if (event.type === "session.updated" && (event.session as { instructions?: string })?.instructions === configAck.current?.instructions) configAck.current?.resolve();
          if (event.type === "response.created") responseInFlight.current = true;
          if (event.type === "response.done" || event.type === "response.cancelled") { responseInFlight.current = false; flushReply(); }
          if (event.type === "conversation.item.input_audio_transcription.completed" && isHandsFreeStopPhrase(String(event.transcript || ""))) {
            stopPhraseCallback.current?.();
            stop();
            return;
          }
          if (event.type === "conversation.item.input_audio_transcription.completed") completeCallback.current?.("user", String(event.transcript || ""));
          if (event.type === "response.output_audio_transcript.done") completeCallback.current?.("assistant", String(event.transcript || ""));
          if (event.type === "response.function_call_arguments.done" && toolCallback.current) {
            const call: AivaToolCall = {
              id: String(event.call_id || ""),
              name: String(event.name || ""),
              arguments: JSON.parse(String(event.arguments || "{}")) as Record<string, unknown>,
            };
            if (seenCalls.current.has(call.id)) return;
            seenCalls.current.add(call.id);
            if (pendingTools.current === 0) completedTools.current = [];
            pendingTools.current += 1;
            setExecuting(true);
            void toolCallback.current(call).catch(error => ({ callId: call.id, ok: false, output: { error: error instanceof Error ? error.message : "Ação falhou." } })).then((result) => {
              if (version !== sessionVersion.current || dataChannel.readyState !== "open") return;
              dataChannel.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: result.callId, output: JSON.stringify({ ok: result.ok, ...result.output }) } }));
              pendingTools.current -= 1;
              completedTools.current.push({ name: call.name, ok: result.ok });
              if (pendingTools.current === 0) {
                setExecuting(false);
                const concise = completedTools.current.every(item => item.ok && isConciseCompletionTool(item.name));
                pendingReply.current = realtimeReply(sessionInstructions.current, concise ? "done" : "answer");
                flushReply();
              }
            });
          }
          const next = reduceRealtimeEvent(stateRef.current, event);
          updateState(next);
          if (next.status === "error") disposeResources();
        } catch {
          // Eventos futuros ou inválidos não devem interromper áudio válido.
        }
      };
      dataChannel.onerror = () => fail("O canal de voz Realtime falhou.", version);

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      if (!offer.sdp) throw new Error("SDP_EMPTY");
      const response = await fetch(`/api/aiva/realtime/session?voice=${encodeURIComponent(selectedVoice)}&brain=${encodeURIComponent(selectedBrain)}`, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error || "REALTIME_SESSION_FAILED");
      }
      const answerSdp = await response.text();
      if (version !== sessionVersion.current) return false;
      await connection.setRemoteDescription({ type: "answer", sdp: answerSdp });
      return true;
    } catch (error) {
      const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
      const message = error instanceof Error ? error.message : "";
      fail(
        name === "NotAllowedError"
          ? "Microfone bloqueado nas permissões da aplicação ou do macOS."
          : message && message !== "REALTIME_SESSION_FAILED" && message !== "SDP_EMPTY"
            ? message
            : "Não foi possível ligar o modo Hands Free.",
        version,
      );
      return false;
    }
  }, [brain, context, conversation, disposeResources, fail, flushReply, muted, stop, updateState, voice, updateConfiguration]);

  useEffect(() => {
    if (remoteAudio.current) remoteAudio.current.muted = muted;
  }, [muted]);

  useEffect(() => () => {
    sessionVersion.current += 1;
    disposeResources();
  }, [disposeResources]);

  return {
    status: eventState.status,
    active: eventState.status !== "off" && eventState.status !== "error",
    notice: eventState.notice,
    start,
    stop,
    executing,
    updateConfiguration,
  };
}
