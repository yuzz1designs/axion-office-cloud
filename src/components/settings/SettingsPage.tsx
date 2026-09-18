/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, Check, ChevronRight, Globe, LayoutGrid, Palette, Undo2 } from "lucide-react";
import type { AppearanceSettings, CommandCenterConfig, LanguageRegionSettings } from "../../types/settings";
import { ACCENT_COLOR_OPTIONS, DEFAULT_APPEARANCE, DEFAULT_COMMAND_CENTER, DEFAULT_LANGUAGE_REGION } from "../../data/settingsMockData";
import PersonalAppearance from "./PersonalAppearance";
import PersonalCommandCenter from "./PersonalCommandCenter";
import PersonalLanguageRegion from "./PersonalLanguageRegion";
import { getSettingsCopy, publishSettingsActivity, sanitizeCommandCenterConfig, sanitizeLanguageRegionSettings, type ActiveSettingId } from "./settingsCore";
import { useLanguage } from "../../i18n/LanguageContext";

interface SettingsPageProps {
  initialAppearance?: AppearanceSettings;
  onAppearanceChange?: (appearance: AppearanceSettings) => void;
  initialCommandCenter?: CommandCenterConfig;
  onCommandCenterChange?: (config: CommandCenterConfig) => void;
  initialLanguageRegion?: LanguageRegionSettings;
  onLanguageRegionChange?: (settings: LanguageRegionSettings) => void;
}

export default function SettingsPage({
  initialAppearance = DEFAULT_APPEARANCE,
  onAppearanceChange,
  initialCommandCenter = DEFAULT_COMMAND_CENTER,
  onCommandCenterChange,
  initialLanguageRegion = DEFAULT_LANGUAGE_REGION,
  onLanguageRegionChange,
}: SettingsPageProps) {
  const { language } = useLanguage();
  const isPortuguese = language === "pt";
  const copy = getSettingsCopy(language);
  const initialLanguage = sanitizeLanguageRegionSettings(initialLanguageRegion);
  const initialCommand = sanitizeCommandCenterConfig(initialCommandCenter);
  const [activeCategory, setActiveCategory] = useState<ActiveSettingId>("appearance");
  const [appearance, setAppearance] = useState(initialAppearance);
  const [languageRegion, setLanguageRegion] = useState(initialLanguage);
  const [commandCenter, setCommandCenter] = useState(initialCommand);
  const [savedAppearance, setSavedAppearance] = useState(initialAppearance);
  const [savedLanguageRegion, setSavedLanguageRegion] = useState(initialLanguage);
  const [savedCommandCenter, setSavedCommandCenter] = useState(initialCommand);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  const currentAccent = ACCENT_COLOR_OPTIONS.find((item) => item.id === appearance.accentColor) ?? ACCENT_COLOR_OPTIONS[0];
  const hasUnsavedChanges = JSON.stringify({ appearance, languageRegion, commandCenter }) !==
    JSON.stringify({ appearance: savedAppearance, languageRegion: savedLanguageRegion, commandCenter: savedCommandCenter });

  const navigation = [
    { id: "appearance" as const, label: isPortuguese ? "Aspeto" : "Appearance", description: isPortuguese ? "Fundo e cor do dashboard" : "Dashboard background and color", icon: Palette },
    { id: "language" as const, label: isPortuguese ? "Idioma" : "Language", description: isPortuguese ? "Idioma da interface" : "Interface language", icon: Globe },
    { id: "command-center" as const, label: "Command Center", description: isPortuguese ? "Ordem e quantidade de informação" : "Information order and amount", icon: LayoutGrid },
  ];

  const notify = (message: string) => {
    setSavedNotification(message);
    window.setTimeout(() => setSavedNotification(null), 2500);
  };

  const save = async () => {
    try {
      await publishSettingsActivity(fetch, () => window.dispatchEvent(new CustomEvent("axion:realtime", { detail: { table: "audit_logs" } })));
      setSavedAppearance(appearance);
      setSavedLanguageRegion(languageRegion);
      setSavedCommandCenter(commandCenter);
      try {
        localStorage.setItem("axion_office_appearance", JSON.stringify(appearance));
        localStorage.setItem("axion_office_language", JSON.stringify(languageRegion));
        localStorage.setItem("axion_office_command", JSON.stringify(commandCenter));
      } catch {
        // The live settings still apply when browser storage is unavailable.
      }
      onAppearanceChange?.(appearance);
      onLanguageRegionChange?.(languageRegion);
      onCommandCenterChange?.(commandCenter);
      notify(isPortuguese ? "Preferências guardadas." : "Preferences saved.");
    } catch {
      notify(isPortuguese ? "Não foi possível registar a alteração." : "The change could not be recorded.");
    }
  };

  const discard = () => {
    setAppearance(savedAppearance);
    setLanguageRegion(savedLanguageRegion);
    setCommandCenter(savedCommandCenter);
    onAppearanceChange?.(savedAppearance);
    onLanguageRegionChange?.(savedLanguageRegion);
    onCommandCenterChange?.(savedCommandCenter);
  };

  const content = activeCategory === "appearance" ? (
    <PersonalAppearance settings={appearance} onChange={(next) => { setAppearance(next); onAppearanceChange?.(next); }} />
  ) : activeCategory === "language" ? (
    <PersonalLanguageRegion settings={languageRegion} onChange={(next) => { setLanguageRegion(next); onLanguageRegionChange?.(next); }} />
  ) : activeCategory === "command-center" ? (
    <PersonalCommandCenter settings={commandCenter} onChange={setCommandCenter} />
  ) : null;

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 py-4 pb-28">
      <AnimatePresence>
        {savedNotification && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: currentAccent.hex, color: "#050609", boxShadow: `0 0 25px ${currentAccent.glow}` }}>
            <Check size={14} className="stroke-[3]" />{savedNotification}
          </motion.div>
        )}
      </AnimatePresence>

      <header className="rounded-3xl border border-white/[0.08] bg-[#0d121c]/80 p-6 shadow-2xl backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{copy.heading}, <span className="font-normal text-white/70">AXION CORE CONFIG</span></h1>
        <p className="mt-1 max-w-xl text-xs text-white/50 md:text-sm">{copy.intro}</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <nav className="flex flex-col gap-1 rounded-3xl border border-white/[0.08] bg-[#0d121c]/70 p-4 shadow-xl backdrop-blur-xl lg:sticky lg:top-6 lg:col-span-4" aria-label={isPortuguese ? "Definições" : "Settings"}>
          {navigation.map((item) => {
            const selected = item.id === activeCategory;
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" onClick={() => setActiveCategory(item.id)} className={`group flex items-center justify-between rounded-2xl border px-3.5 py-3 text-left transition-all ${selected ? "border-white/20 bg-white/[0.1] text-white" : "border-transparent text-white/60 hover:bg-white/[0.04] hover:text-white"}`}>
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: selected ? currentAccent.hex : "rgba(255,255,255,.05)", color: selected ? "#050609" : "rgba(255,255,255,.6)" }}><Icon size={15} /></span>
                  <span className="flex flex-col"><span className="text-xs font-medium">{item.label}</span><span className="text-[10px] text-white/35">{item.description}</span></span>
                </span>
                <ChevronRight size={14} style={{ color: selected ? currentAccent.hex : undefined }} className={selected ? "translate-x-0.5" : "text-white/20"} />
              </button>
            );
          })}
        </nav>

        <main className="lg:col-span-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeCategory} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>{content}</motion.div>
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div initial={{ opacity: 0, y: 32, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 32, scale: 0.96 }} className="fixed bottom-6 left-1/2 z-50 flex w-[92%] max-w-xl -translate-x-1/2 items-center justify-between gap-4 rounded-3xl border border-white/20 bg-[#0b101c]/95 px-5 py-3.5 shadow-2xl backdrop-blur-2xl">
            <span className="flex items-center gap-3 text-xs font-semibold text-white"><AlertCircle size={17} style={{ color: currentAccent.hex }} />{isPortuguese ? "Alterações por guardar" : "Unsaved changes"}</span>
            <span className="flex gap-2">
              <button type="button" onClick={discard} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"><Undo2 size={13} />{isPortuguese ? "Descartar" : "Discard"}</button>
              <button type="button" onClick={save} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold" style={{ backgroundColor: currentAccent.hex, color: "#050609", boxShadow: `0 0 18px ${currentAccent.glow}` }}><Check size={13} />{isPortuguese ? "Guardar" : "Save"}</button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
