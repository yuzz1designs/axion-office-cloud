export const AIVA_REALTIME_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export type AivaRealtimeVoice = typeof AIVA_REALTIME_VOICES[number];

export const DEFAULT_AIVA_VOICE: AivaRealtimeVoice = "coral";

export function normalizeRealtimeVoice(value: unknown): AivaRealtimeVoice {
  return AIVA_REALTIME_VOICES.includes(value as AivaRealtimeVoice)
    ? value as AivaRealtimeVoice
    : DEFAULT_AIVA_VOICE;
}
