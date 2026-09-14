/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppearanceThemeMode = "dark" | "animated";
export type AccentColorToken = "axion-blue" | "electric-blue" | "violet" | "red" | "silver" | "graphite";

export interface AccentColorOption {
  id: AccentColorToken;
  name: string;
  hex: string;
  secondary: string;
  glow: string;
}

export interface AppearanceSettings {
  theme: AppearanceThemeMode;
  accentColor: AccentColorToken;
}

export interface LanguageRegionSettings {
  language: "pt" | "en";
}

export interface CommandCenterModuleItem {
  id: "today" | "meetings";
  label: string;
  category: "Core";
  visible: true;
  isCore: true;
}

export interface CommandCenterConfig {
  modules: CommandCenterModuleItem[];
  recentItemsCount: number;
}
