import type { AccentColorToken, AppearanceSettings } from "../types/settings";

const ACCENT_TOKENS: AccentColorToken[] = ["axion-blue", "electric-blue", "violet", "red", "silver", "graphite"];

export function normalizeAppearanceSettings(value: unknown): AppearanceSettings {
  const stored = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const accentColor = ACCENT_TOKENS.includes(stored.accentColor as AccentColorToken)
    ? stored.accentColor as AccentColorToken
    : "axion-blue";
  return {
    theme: stored.theme === "animated" ? "animated" : "dark",
    accentColor,
  };
}
