import type { CommandCenterConfig, CommandCenterModuleItem, LanguageRegionSettings } from "../../types/settings";

export const ACTIVE_SETTING_IDS = ["appearance", "language", "command-center", "aiva-desktop"] as const;
export type ActiveSettingId = typeof ACTIVE_SETTING_IDS[number];

const SETTINGS_COPY = {
  pt: {
    heading: "DEFINIÇÕES",
    intro: "Apenas controlos ligados ao funcionamento atual do AXION OFFICE.",
    backgroundTitle: "Fundo",
    backgroundDescription: "Escolha entre o canvas escuro estático e um fundo de ondas com movimento contínuo.",
    liveSwitch: "ALTERAÇÃO IMEDIATA",
    darkLabel: "Canvas escuro",
    darkDescription: "Fundo escuro, estático e minimalista",
    animatedLabel: "Fundo animado",
    animatedDescription: "Ondas fluidas em movimento contínuo",
    colorTitle: "Cor do fundo e destaques",
    colorDescription: "A cor selecionada controla as ondas animadas, as luzes da Home e os indicadores ativos da navegação.",
    activeColor: "COR ATIVA",
    activeLight: "LUZ ATIVA",
    colorTargets: "Ondas, navegação e Home",
  },
  en: {
    heading: "SETTINGS",
    intro: "Only controls connected to the current AXION OFFICE experience.",
    backgroundTitle: "Background",
    backgroundDescription: "Choose between a static dark canvas and continuously animated waves.",
    liveSwitch: "LIVE SWITCH",
    darkLabel: "Dark canvas",
    darkDescription: "A dark, static and minimal background",
    animatedLabel: "Animated background",
    animatedDescription: "Fluid waves in continuous motion",
    colorTitle: "Background and accent color",
    colorDescription: "The selected color controls animated waves, Home lighting and active navigation indicators.",
    activeColor: "ACTIVE COLOR",
    activeLight: "ACTIVE LIGHT",
    colorTargets: "Waves, navigation and Home",
  },
} as const;

export function getSettingsCopy(language: "pt" | "en") {
  return SETTINGS_COPY[language];
}

const COMMAND_MODULES: Record<"today" | "meetings", CommandCenterModuleItem> = {
  today: { id: "today", label: "Tasks de hoje", category: "Core", visible: true, isCore: true },
  meetings: { id: "meetings", label: "Reuniões", category: "Core", visible: true, isCore: true },
};

export function sanitizeCommandCenterConfig(value: unknown): CommandCenterConfig {
  const stored = value && typeof value === "object" ? value as Partial<CommandCenterConfig> : {};
  const storedModules = Array.isArray(stored.modules) ? stored.modules : [];
  const orderedIds = storedModules
    .map((item) => item?.id)
    .filter((id): id is "today" | "meetings" => id === "today" || id === "meetings");

  for (const id of ["today", "meetings"] as const) {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  }

  const requestedCount = Number(stored.recentItemsCount);
  const recentItemsCount = !Number.isFinite(requestedCount) ? 5 : requestedCount <= 3 ? 3 : requestedCount <= 5 ? 5 : 10;
  return {
    modules: orderedIds.map((id) => ({ ...COMMAND_MODULES[id] })),
    recentItemsCount,
  };
}

export function sanitizeLanguageRegionSettings(value: unknown): LanguageRegionSettings {
  const stored = value && typeof value === "object" ? value as Partial<LanguageRegionSettings> : {};
  return { language: stored.language === "en" ? "en" : "pt" };
}

export async function publishSettingsActivity(fetchImpl: typeof fetch, dispatch: () => void) {
  const response = await fetchImpl("/api/team/activity", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "settings.updated" }),
  });
  if (!response.ok) throw new Error("SETTINGS_ACTIVITY_FAILED");
  dispatch();
}
