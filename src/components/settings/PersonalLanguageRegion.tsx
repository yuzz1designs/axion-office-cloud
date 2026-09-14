import type { LanguageRegionSettings } from "../../types/settings";
import { useLanguage } from "../../i18n/LanguageContext";
import { SettingsRow, SettingsSection, SettingsSegmentedControl } from "./SettingsControls";

interface Props {
  settings: LanguageRegionSettings;
  onChange: (updated: LanguageRegionSettings) => void;
}

export default function PersonalLanguageRegion({ settings, onChange }: Props) {
  const { language } = useLanguage();
  const isPortuguese = language === "pt";
  return (
    <SettingsSection title={isPortuguese ? "Idioma da interface" : "Interface language"} description={isPortuguese ? "Define o idioma utilizado no AXION OFFICE." : "Sets the language used across AXION OFFICE."}>
      <SettingsRow label={isPortuguese ? "Idioma" : "Language"} description={isPortuguese ? "A alteração é aplicada imediatamente." : "The change is applied immediately."}>
        <SettingsSegmentedControl<"pt" | "en">
          id="lang-select"
          value={settings.language}
          onChange={(next) => onChange({ language: next })}
          options={[{ value: "pt", label: "Português (PT)" }, { value: "en", label: "English (US)" }]}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
