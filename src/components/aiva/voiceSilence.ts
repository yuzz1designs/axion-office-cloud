export const VOICE_SILENCE_MS = 3_000;

export interface VoiceSilenceState {
  heardSpeech: boolean;
  silenceStartedAt: number | null;
}

export type VoiceCaptureStage = "microphone" | "recorder" | "analysis" | "recording";

export function describeVoiceCaptureError(stage: VoiceCaptureStage, error: unknown): string {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "Erro desconhecido";
  if (stage === "microphone") {
    return name === "NotAllowedError"
      ? "Microfone bloqueado nas permissões da aplicação ou do macOS"
      : `Não foi possível aceder ao microfone (${name})`;
  }
  if (stage === "recorder") return `Microfone autorizado · gravador indisponível (${name})`;
  if (stage === "analysis") return `Microfone autorizado · análise de silêncio indisponível (${name})`;
  return `Microfone autorizado · não foi possível iniciar a gravação (${name})`;
}

export function createVoiceSilenceState(): VoiceSilenceState {
  return { heardSpeech: false, silenceStartedAt: null };
}

export function replaceVoiceRequest(previous: AbortController | null): AbortController {
  previous?.abort();
  return new AbortController();
}

export function advanceVoiceSilence(
  state: VoiceSilenceState,
  voiceActive: boolean,
  now: number,
): { state: VoiceSilenceState; shouldStop: boolean } {
  if (voiceActive) {
    return { state: { heardSpeech: true, silenceStartedAt: null }, shouldStop: false };
  }
  if (!state.heardSpeech) return { state, shouldStop: false };

  const silenceStartedAt = state.silenceStartedAt ?? now;
  return {
    state: { heardSpeech: true, silenceStartedAt },
    shouldStop: now - silenceStartedAt >= VOICE_SILENCE_MS,
  };
}
