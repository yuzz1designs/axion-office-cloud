/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AccentColorOption, AppearanceSettings, CommandCenterConfig, LanguageRegionSettings } from "../types/settings";

export const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
  { id: "axion-blue", name: "AXION Blue", hex: "#00f0ff", secondary: "#0284c7", glow: "rgba(0, 240, 255, 0.4)" },
  { id: "electric-blue", name: "Electric Blue", hex: "#3b82f6", secondary: "#1d4ed8", glow: "rgba(59, 130, 246, 0.4)" },
  { id: "violet", name: "Violet", hex: "#a855f7", secondary: "#7e22ce", glow: "rgba(168, 85, 247, 0.4)" },
  { id: "red", name: "Vermelho", hex: "#ef4444", secondary: "#b91c1c", glow: "rgba(239, 68, 68, 0.4)" },
  { id: "silver", name: "Silver", hex: "#cbd5e1", secondary: "#64748b", glow: "rgba(203, 213, 225, 0.3)" },
  { id: "graphite", name: "Graphite", hex: "#64748b", secondary: "#334155", glow: "rgba(100, 116, 139, 0.3)" },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  accentColor: "axion-blue",
};

export const DEFAULT_LANGUAGE_REGION: LanguageRegionSettings = { language: "pt" };

export const DEFAULT_COMMAND_CENTER: CommandCenterConfig = {
  modules: [
    { id: "today", label: "Tasks de hoje", category: "Core", visible: true, isCore: true },
    { id: "meetings", label: "Reuniões", category: "Core", visible: true, isCore: true },
  ],
  recentItemsCount: 5,
};
