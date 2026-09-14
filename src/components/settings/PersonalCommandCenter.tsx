import { ArrowDown, ArrowUp } from "lucide-react";
import type { CommandCenterConfig } from "../../types/settings";
import { useLanguage } from "../../i18n/LanguageContext";
import { SettingsRow, SettingsSection, SettingsSegmentedControl } from "./SettingsControls";
import { sanitizeCommandCenterConfig } from "./settingsCore";

interface Props {
  settings: CommandCenterConfig;
  onChange: (updated: CommandCenterConfig) => void;
}

export default function PersonalCommandCenter({ settings, onChange }: Props) {
  const { language } = useLanguage();
  const isPortuguese = language === "pt";
  const cleaned = sanitizeCommandCenterConfig(settings);

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= cleaned.modules.length) return;
    const modules = [...cleaned.modules];
    [modules[index], modules[target]] = [modules[target], modules[index]];
    onChange({ ...cleaned, modules });
  };

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection title={isPortuguese ? "Ordem do painel" : "Dashboard order"} description={isPortuguese ? "Define a ordem dos dois blocos ativos à direita do Command Center." : "Sets the order of the two active blocks on the right of the Command Center."}>
        <div className="flex flex-col gap-2">
          {cleaned.modules.map((module, index) => (
            <div key={module.id} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5">
              <span className="text-sm font-medium text-white">{module.id === "today" ? (isPortuguese ? "Tasks de hoje" : "Today's tasks") : (isPortuguese ? "Reuniões" : "Meetings")}</span>
              <span className="flex gap-1">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={isPortuguese ? "Mover para cima" : "Move up"} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-20"><ArrowUp size={14} /></button>
                <button type="button" disabled={index === cleaned.modules.length - 1} onClick={() => move(index, 1)} aria-label={isPortuguese ? "Mover para baixo" : "Move down"} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-20"><ArrowDown size={14} /></button>
              </span>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title={isPortuguese ? "Quantidade de informação" : "Information amount"} description={isPortuguese ? "Limita as tasks e atividades recentes apresentadas no painel." : "Limits tasks and recent activity shown on the dashboard."}>
        <SettingsRow label={isPortuguese ? "Itens apresentados" : "Visible items"}>
          <SettingsSegmentedControl<"3" | "5" | "10">
            value={String(cleaned.recentItemsCount) as "3" | "5" | "10"}
            onChange={(value) => onChange({ ...cleaned, recentItemsCount: Number(value) })}
            options={[{ value: "3", label: "3" }, { value: "5", label: "5" }, { value: "10", label: "10" }]}
          />
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
