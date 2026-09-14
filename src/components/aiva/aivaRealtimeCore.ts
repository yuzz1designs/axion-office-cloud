import type { AivaRealtimeVoice } from "../../lib/aivaRealtimeVoice";
import type { AivaVisualState } from "./aivaVisual.types";
import { RECOVERABLE_REALTIME_ERRORS } from "../../lib/aivaVoicePolicy";

export type AivaRealtimeStatus = "off" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export interface AivaRealtimeEventState {
  status: AivaRealtimeStatus;
  userTranscript: string;
  assistantTranscript: string;
  notice: string;
}

export function createRealtimeEventState(): AivaRealtimeEventState {
  return { status: "connecting", userTranscript: "", assistantTranscript: "", notice: "" };
}

export function reduceRealtimeEvent(state: AivaRealtimeEventState, event: Record<string, unknown>): AivaRealtimeEventState {
  switch (event.type) {
    case "session.created":
    case "session.updated":
      return state.status === "connecting" ? { ...state, status: "listening", notice: "" } : state;
    case "input_audio_buffer.speech_started":
    case "response.cancelled":
      return { ...state, status: "listening", notice: "" };
    case "response.done": {
      const response = event.response as { status?: string } | undefined;
      if (response?.status === "failed") return { ...state, status: "listening", notice: "Não consegui responder a este pedido. O microfone continua ativo." };
      return state.status === "speaking" ? state : { ...state, status: "listening", notice: "" };
    }
    case "output_audio_buffer.stopped":
    case "output_audio_buffer.cleared":
      return { ...state, status: "listening" };
    case "output_audio_buffer.started":
      return { ...state, status: "speaking", notice: "" };
    case "input_audio_buffer.speech_stopped":
    case "response.created":
      return { ...state, status: "thinking", assistantTranscript: "", notice: "" };
    case "response.output_audio.delta":
      return { ...state, status: "speaking", notice: "" };
    case "conversation.item.input_audio_transcription.completed":
      return { ...state, userTranscript: String(event.transcript || "").trim() };
    case "response.output_audio_transcript.delta":
      return { ...state, assistantTranscript: `${state.assistantTranscript}${String(event.delta || "")}` };
    case "response.output_audio_transcript.done":
      return { ...state, assistantTranscript: String(event.transcript || state.assistantTranscript).trim() };
    case "error": {
      const code = (event.error as { code?: string })?.code || "";
      if (RECOVERABLE_REALTIME_ERRORS.has(code)) return state;
      const detail = event.error && typeof event.error === "object" && "message" in event.error
        ? String(event.error.message)
        : "Ligação Realtime interrompida";
      return { ...state, status: "error", notice: detail };
    }
    default:
      return state;
  }
}

export function mapRealtimeStatusToVisualState(status: AivaRealtimeStatus): AivaVisualState {
  if (status === "connecting" || status === "thinking") return "thinking";
  if (status === "listening") return "listening";
  if (status === "speaking") return "speaking";
  if (status === "error") return "error";
  return "idle";
}

export function shouldRestartRealtimeSession(input: {
  active: boolean;
  previousVoice: AivaRealtimeVoice;
  nextVoice: AivaRealtimeVoice;
}) {
  return input.active && input.previousVoice !== input.nextVoice;
}
