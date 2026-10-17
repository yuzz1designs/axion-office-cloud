import { useCallback, useEffect, useState } from "react";
import { Bell, Check, NotebookPen } from "lucide-react";
import type { PersonalNote } from "../../server/personalNoteStore";

export default function NoteReminderBanner({ accent, onOpen }: { accent: string; onOpen: (id: string) => void }) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const load = useCallback(async () => { try { const response = await fetch("/api/notes?scope=reminders"); const value = await response.json(); if (response.ok) setNotes(value.notes || []); } catch { /* Retried on the next interval. */ } }, []);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(timer); }, [load]);
  if (!notes.length) return null;
  const note = notes[0];
  const complete = async () => { const response = await fetch(`/api/notes/${encodeURIComponent(note.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reminderCompleted: true }) }); if (response.ok) setNotes((current) => current.filter((item) => item.id !== note.id)); };
  return <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[.09] bg-[#0b111a]/95 px-4 py-3 shadow-xl"><span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color: accent, backgroundColor: `${accent}12` }}><Bell size={16}/></span><div className="min-w-0 flex-1"><p className="text-[9px] uppercase tracking-[.18em]" style={{ color: accent }}>Lembrete</p><p className="truncate text-xs font-semibold text-white/75">{note.title || "Nota sem título"}</p>{notes.length > 1 && <p className="text-[9px] text-white/30">+{notes.length - 1} lembrete(s) pendente(s)</p>}</div><button onClick={() => onOpen(note.id)} className="flex items-center gap-1.5 rounded-xl border border-white/[.08] px-3 py-2 text-[10px] text-white/55"><NotebookPen size={12}/>Abrir</button><button onClick={() => void complete()} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-semibold text-slate-950" style={{ backgroundColor: accent }}><Check size={12}/>Concluído</button></div>;
}
