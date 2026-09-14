/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Moon, 
  Waves,
  Check, 
} from "lucide-react";
import { 
  AppearanceSettings, 
  AccentColorToken, 
  AppearanceThemeMode,
} from "../../types/settings";
import { ACCENT_COLOR_OPTIONS } from "../../data/settingsMockData";
import { useLanguage } from "../../i18n/LanguageContext";
import { getSettingsCopy } from "./settingsCore";
import { 
  SettingsSection, 
  SettingsColorPicker, 
} from "./SettingsControls";

interface PersonalAppearanceProps {
  settings: AppearanceSettings;
  onChange: (updated: AppearanceSettings) => void;
  allowedTokens?: AccentColorToken[];
}

export default function PersonalAppearance({
  settings,
  onChange,
  allowedTokens
}: PersonalAppearanceProps) {
  const { language } = useLanguage();
  const copy = getSettingsCopy(language);
  const currentAccent = ACCENT_COLOR_OPTIONS.find((c) => c.id === settings.accentColor) || ACCENT_COLOR_OPTIONS[0];

  const updateField = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. THEME & LIVE PREVIEW HERO */}
      <SettingsSection
        id="section-theme"
        title={copy.backgroundTitle}
        description={copy.backgroundDescription}
        badge={copy.liveSwitch}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: "dark" as AppearanceThemeMode, label: copy.darkLabel, desc: copy.darkDescription, icon: Moon },
            { id: "animated" as AppearanceThemeMode, label: copy.animatedLabel, desc: copy.animatedDescription, icon: Waves },
          ].map((themeOpt) => {
            const isSelected = settings.theme === themeOpt.id;
            const Icon = themeOpt.icon;

            return (
              <button
                key={themeOpt.id}
                type="button"
                onClick={() => updateField("theme", themeOpt.id)}
                className={`relative p-4 rounded-2xl border text-left transition-all duration-300 cursor-pointer flex flex-col gap-3 group ${
                  isSelected
                    ? "bg-white/[0.08] border-white/30 shadow-xl"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15"
                }`}
              >
                {/* Mini Preview Card */}
                <div className="w-full h-20 rounded-xl p-2.5 flex flex-col justify-between border transition-all bg-[#080d16] border-white/10 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: currentAccent.hex }}
                      />
                      <span className="text-[9px] font-mono tracking-wider font-semibold opacity-80 uppercase">
                        AXION
                      </span>
                    </div>
                    <span className="text-[8px] font-mono opacity-50">v4.2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-6 h-6 rounded-md bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
                      {themeOpt.id === "animated" && <span className="absolute inset-x-0 bottom-0 h-3 rounded-[50%] opacity-50 animate-pulse" style={{ backgroundColor: currentAccent.hex }} />}
                      <Icon size={12} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <div className="w-14 h-1.5 rounded-full bg-white/20" />
                      <div className="w-8 h-1 rounded-full bg-white/10" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-xs font-semibold text-white tracking-wide font-sans">
                      {themeOpt.label}
                    </div>
                    <div className="text-[11px] text-white/40 font-sans">
                      {themeOpt.desc}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: currentAccent.hex }}
                    >
                      <Check size={10} className="text-[#050609] stroke-[3]" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      {/* 2. ACCENT COLOR TOKENS */}
      <SettingsSection
        id="section-accent"
        title={copy.colorTitle}
        description={copy.colorDescription}
        badge={copy.activeColor}
      >
        <SettingsColorPicker
          options={ACCENT_COLOR_OPTIONS}
          value={settings.accentColor}
          onChange={(token) => updateField("accentColor", token)}
          allowedTokens={allowedTokens}
        />

        {/* Live Swatch Feedback Bar */}
        <div className="mt-2 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-white/40 font-mono text-[11px]">{copy.activeLight}:</span>
            <span className="font-semibold text-white tracking-wide font-sans">
              {currentAccent.name}
            </span>
            <span className="font-mono text-[11px] text-white/50 bg-white/5 px-2 py-0.5 rounded-md">
              {currentAccent.hex}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: currentAccent.hex }}
            />
            <span className="text-[11px] font-mono text-white/60">{copy.colorTargets}</span>
          </div>
        </div>
      </SettingsSection>

    </div>
  );
}
