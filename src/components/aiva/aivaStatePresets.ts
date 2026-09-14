import type { AivaStatePreset, AivaVisualState } from "./aivaVisual.types";

export function getAivaStatePresets(accent: string): Record<AivaVisualState, AivaStatePreset> {
  return {
    idle: {
      color: accent,
      glow: 0.78,
      motion: 0.58,
      turbulence: 0.54,
      concentration: 1,
      label: "IDLE",
      description: "Presença disponível",
    },
    listening: {
      color: accent,
      glow: 1.15,
      motion: 0.32,
      turbulence: 0.62,
      concentration: 0.84,
      label: "LISTENING",
      description: "A escutar",
    },
    thinking: {
      color: accent,
      glow: 1.05,
      motion: 1.15,
      turbulence: 0.92,
      concentration: 0.95,
      label: "THINKING",
      description: "A organizar contexto",
    },
    speaking: {
      color: accent,
      glow: 1.35,
      motion: 0.85,
      turbulence: 0.84,
      concentration: 1.08,
      label: "SPEAKING",
      description: "A responder",
    },
    success: {
      color: accent,
      glow: 1.25,
      motion: 0.26,
      turbulence: 0.46,
      concentration: 0.88,
      label: "SUCCESS",
      description: "Ação concluída",
    },
    warning: {
      color: accent,
      glow: 1.05,
      motion: 0.62,
      turbulence: 0.78,
      concentration: 1.04,
      label: "WARNING",
      description: "Requer atenção",
    },
    error: {
      color: accent,
      glow: 1.2,
      motion: 1.35,
      turbulence: 1.1,
      concentration: 1.18,
      label: "ERROR",
      description: "Ligação interrompida",
    },
  };
}

export const AIVA_STATES: AivaVisualState[] = [
  "idle",
  "listening",
  "thinking",
  "speaking",
  "success",
  "warning",
  "error",
];
