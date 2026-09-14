import type { MutableRefObject } from "react";

export type AivaVisualState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "success"
  | "warning"
  | "error";

export type AudioLevelRef = MutableRefObject<number>;

export interface AivaStatePreset {
  color: string;
  glow: number;
  motion: number;
  turbulence: number;
  concentration: number;
  label: string;
  description: string;
}

