import { CalendarDays, FolderKanban, Sparkles } from "lucide-react";

const ACTIONS = [
  { label: "O que é importante hoje?", icon: Sparkles },
  { label: "Abrir o meu calendário", icon: CalendarDays },
  { label: "Verificar projetos atuais", icon: FolderKanban },
];

export default function AivaQuickActions({ onSelect }: { onSelect: (message: string) => void }) {
  return <div className="flex max-w-full flex-wrap justify-center gap-2" aria-label="Ações rápidas">{ACTIONS.map(({ label, icon: Icon }) => <button key={label} type="button" onClick={() => onSelect(label)} className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3.5 py-2 text-[11px] text-white/55 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white/90"><Icon size={13} />{label}</button>)}</div>;
}

