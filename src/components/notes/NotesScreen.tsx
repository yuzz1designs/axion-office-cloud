import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowLeft, Bell, Check, CheckSquare, Lightbulb, Lock, Plus, Search, Share2, Star, Trash2 } from "lucide-react";
import type { PersonalNote } from "../../server/personalNoteStore";
import type { NoteCategory, NoteChecklistItem, NoteVisibility } from "../../server/personalNoteCore";

const categories: Array<{ id: NoteCategory | "all"; label: string }> = [{ id: "all", label: "Todas" }, { id: "general", label: "Geral" }, { id: "idea", label: "Ideias" }, { id: "suggestion", label: "Sugestões" }, { id: "reminder", label: "Lembretes" }];
const colors = ["#00f0ff", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#ef4444"];
const label = (category: NoteCategory) => categories.find((item) => item.id === category)?.label || "Geral";
const localDateTime = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "";

export default function NotesScreen({ currentUserId, accent = "#00f0ff", onBack, compact = false }: { currentUserId: string; accent?: string; onBack?: () => void; compact?: boolean }) {
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PersonalNote | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NoteCategory | "all">("all");
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const timer = useRef<number | null>(null);
  const pendingDraft = useRef<PersonalNote | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/notes?archived=${archived}`); const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível carregar as notas.");
      const next = value.notes || []; setNotes(next);
      const requested = new URLSearchParams(window.location.search).get("note");
      const target = next.find((note: PersonalNote) => note.id === (requested || selectedId)) || next[0] || null;
      setSelectedId(target?.id || ""); setDraft(target);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível carregar as notas."); }
    finally { setLoading(false); }
  }, [archived]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refresh = (event: Event) => { if ((event as CustomEvent).detail?.table === "personal_notes") void load(); };
    window.addEventListener("axion:realtime", refresh);
    return () => window.removeEventListener("axion:realtime", refresh);
  }, [load]);
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
    const note = pendingDraft.current;
    if (note) void fetch(`/api/notes/${encodeURIComponent(note.id)}`, { method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: note.title, content: note.content, category: note.category, visibility: note.visibility, color: note.color, checklist: note.checklist, pinned: note.pinned, archived: note.archived, reminderAt: note.reminderAt, reminderCompleted: Boolean(note.reminderCompletedAt) }) });
  }, []);

  const save = async (note: PersonalNote) => {
    setSaveState("saving");
    try {
      const response = await fetch(`/api/notes/${encodeURIComponent(note.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: note.title, content: note.content, category: note.category, visibility: note.visibility, color: note.color, checklist: note.checklist, pinned: note.pinned, archived: note.archived, reminderAt: note.reminderAt, reminderCompleted: Boolean(note.reminderCompletedAt) }) });
      const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error || "Não foi possível guardar a nota.");
      if (pendingDraft.current === note) pendingDraft.current = null;
      setNotes((current) => current.map((item) => item.id === note.id ? value.note : item)); setDraft((current) => current?.id === note.id ? value.note : current); setSaveState("saved");
      if (value.note.archived !== archived) await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível guardar a nota."); setSaveState("error"); }
  };
  const change = (patch: Partial<PersonalNote>) => {
    if (!draft || draft.ownerUserId !== currentUserId) return;
    const next = { ...draft, ...patch }; pendingDraft.current = next; setDraft(next); setNotes((current) => current.map((item) => item.id === next.id ? next : item)); setSaveState("pending");
    if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void save(next), 700);
  };
  const select = (note: PersonalNote) => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; if (draft && saveState === "pending") void save(draft); } setSelectedId(note.id); setDraft(note); setSaveState("idle"); const url = new URL(window.location.href); url.searchParams.set("note", note.id); window.history.replaceState({}, "", url); };
  const create = async () => {
    try { const response = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Nova nota", color: accent, category: "general", visibility: "private", checklist: [] }) }); const value = await response.json().catch(() => ({})); if (!response.ok) throw new Error(value.error || "Não foi possível criar a nota."); setArchived(false); setNotes((current) => [value.note, ...current]); select(value.note); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar a nota."); }
  };
  const remove = async () => { if (!draft || draft.ownerUserId !== currentUserId || !window.confirm(`Apagar a nota “${draft.title || "Sem título"}”?`)) return; const response = await fetch(`/api/notes/${encodeURIComponent(draft.id)}`, { method: "DELETE" }); if (!response.ok) return setError("Não foi possível apagar a nota."); const next = notes.filter((item) => item.id !== draft.id); setNotes(next); setDraft(next[0] || null); setSelectedId(next[0]?.id || ""); };
  const addChecklist = () => change({ checklist: [...(draft?.checklist || []), { id: crypto.randomUUID(), text: "Novo item", completed: false }] });
  const updateChecklist = (id: string, patch: Partial<NoteChecklistItem>) => change({ checklist: (draft?.checklist || []).map((item) => item.id === id ? { ...item, ...patch } : item) });
  const visible = useMemo(() => notes.filter((note) => (category === "all" || note.category === category) && (!query.trim() || `${note.title} ${note.content} ${note.ownerName}`.toLocaleLowerCase("pt").includes(query.trim().toLocaleLowerCase("pt")))), [category, notes, query]);
  const editable = draft?.ownerUserId === currentUserId;

  return <section className={`mx-auto flex h-full w-full max-w-7xl flex-col ${compact ? "gap-4" : "gap-5 py-5"}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">{onBack && <button onClick={onBack} className="flex items-center gap-2 text-xs text-white/45"><ArrowLeft size={14} />Voltar</button>}<div className="mr-auto"><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Espaço pessoal</p><h1 className="mt-1 text-2xl font-semibold">Notas</h1></div><button onClick={() => void create()} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-950" style={{ backgroundColor: accent }}><Plus size={14} className="mr-1.5 inline" />Nova nota</button></div>
    <div className={`grid min-h-0 flex-1 gap-4 ${compact ? "grid-cols-1" : "lg:grid-cols-[330px_1fr]"}`}>
      <aside className="flex min-h-0 flex-col rounded-3xl border border-white/[.08] bg-white/[.025] p-3"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Pesquisar notas…" className="w-full rounded-xl border border-white/[.07] bg-black/15 py-2.5 pl-9 pr-3 text-xs text-white outline-none"/></div><div className="mt-3 flex gap-1 overflow-x-auto pb-1">{categories.map((item) => <button key={item.id} onClick={() => setCategory(item.id)} className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] ${category === item.id ? "bg-white/10 text-white" : "text-white/35"}`}>{item.label}</button>)}</div><button onClick={() => setArchived((value) => !value)} className="mt-2 flex items-center gap-2 px-2 text-[10px] text-white/35"><Archive size={12}/>{archived ? "Ver notas ativas" : "Ver arquivo"}</button><div className={`${compact ? "max-h-[36vh]" : "flex-1"} mt-3 space-y-2 overflow-auto`}>{loading ? <p className="p-5 text-center text-xs text-white/30">A carregar…</p> : visible.map((note) => <button key={note.id} onClick={() => select(note)} className={`w-full rounded-2xl border p-3 text-left ${selectedId === note.id ? "bg-white/[.07]" : "bg-black/10 hover:bg-white/[.035]"}`} style={{ borderColor: selectedId === note.id ? `${note.color}55` : "rgba(255,255,255,.06)" }}><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: note.color }}/><strong className="min-w-0 flex-1 truncate text-xs text-white/75">{note.title || "Sem título"}</strong>{note.pinned && <Star size={11} fill={note.color} style={{ color: note.color }}/>}</div><p className="mt-2 line-clamp-2 text-[10px] leading-4 text-white/30">{note.content || note.checklist[0]?.text || "Nota vazia"}</p><div className="mt-2 flex items-center justify-between text-[9px] text-white/25"><span>{label(note.category)}</span><span>{note.visibility === "team" ? <Share2 size={10}/> : <Lock size={10}/>}</span></div></button>)}{!loading && !visible.length && <p className="p-6 text-center text-xs text-white/25">Nenhuma nota encontrada.</p>}</div></aside>
      <div className="min-h-0 overflow-auto rounded-3xl border border-white/[.08] bg-[#0a0f18]/80 p-5 sm:p-7">{draft ? <div className="mx-auto max-w-3xl"><div className="flex flex-wrap items-center gap-2"><select disabled={!editable} value={draft.category} onChange={(e) => change({ category: e.target.value as NoteCategory })} className="rounded-lg border border-white/[.08] bg-[#0d131d] px-2.5 py-2 text-[10px] text-white/60 outline-none"><option value="general">Geral</option><option value="idea">Ideia</option><option value="suggestion">Sugestão</option><option value="reminder">Lembrete</option></select>{editable && <button onClick={() => change({ visibility: (draft.visibility === "private" ? "team" : "private") as NoteVisibility })} className="flex items-center gap-1.5 rounded-lg border border-white/[.08] px-2.5 py-2 text-[10px] text-white/45">{draft.visibility === "team" ? <Share2 size={12}/> : <Lock size={12}/>} {draft.visibility === "team" ? "Partilhada" : "Privada"}</button>}<button disabled={!editable} onClick={() => change({ pinned: !draft.pinned })} className="rounded-lg border border-white/[.08] p-2 text-white/40"><Star size={13} fill={draft.pinned ? draft.color : "none"} style={{ color: draft.pinned ? draft.color : undefined }}/></button><span className="ml-auto text-[9px] text-white/25">{editable ? saveState === "saving" || saveState === "pending" ? "A guardar…" : saveState === "error" ? "Erro ao guardar" : saveState === "saved" ? "Guardado" : "Gravação automática" : `Partilhada por ${draft.ownerName}`}</span></div><input disabled={!editable} maxLength={160} value={draft.title} onChange={(e) => change({ title: e.target.value })} placeholder="Título da nota" className="mt-6 w-full bg-transparent text-3xl font-semibold text-white outline-none placeholder:text-white/15"/><textarea disabled={!editable} maxLength={20000} value={draft.content} onChange={(e) => change({ content: e.target.value })} placeholder="Escreve uma ideia, sugestão ou lembrete…" className="mt-5 min-h-48 w-full resize-y bg-transparent text-sm leading-7 text-white/65 outline-none placeholder:text-white/20"/>
        <div className="mt-5 border-t border-white/[.07] pt-5"><div className="flex items-center justify-between"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/45"><CheckSquare size={13} style={{ color: draft.color }}/>Checklist</p>{editable && <button onClick={addChecklist} className="text-[10px] text-white/40 hover:text-white"><Plus size={12} className="mr-1 inline"/>Adicionar item</button>}</div><div className="mt-3 space-y-2">{draft.checklist.map((item) => <div key={item.id} className="flex items-center gap-2"><button disabled={!editable} onClick={() => updateChecklist(item.id, { completed: !item.completed })} className="grid h-5 w-5 place-items-center rounded-md border border-white/15" style={item.completed ? { backgroundColor: draft.color, color: "#050609" } : undefined}>{item.completed && <Check size={12}/>}</button><input disabled={!editable} value={item.text} onChange={(e) => updateChecklist(item.id, { text: e.target.value })} className={`min-w-0 flex-1 bg-transparent text-xs outline-none ${item.completed ? "text-white/25 line-through" : "text-white/60"}`}/>{editable && <button onClick={() => change({ checklist: draft.checklist.filter((entry) => entry.id !== item.id) })} className="text-white/20 hover:text-red-300"><Trash2 size={12}/></button>}</div>)}</div></div>
        <div className="mt-6 grid gap-4 border-t border-white/[.07] pt-5 sm:grid-cols-2"><label className="text-[9px] uppercase tracking-wider text-white/30"><Bell size={12} className="mr-1.5 inline"/>Lembrete<input disabled={!editable} type="datetime-local" value={localDateTime(draft.reminderAt)} onChange={(e) => change({ reminderAt: e.target.value ? new Date(e.target.value).toISOString() : null, reminderCompletedAt: null })} className="mt-2 block w-full rounded-xl border border-white/[.08] bg-black/15 px-3 py-2.5 text-xs text-white/60 outline-none"/></label><div><p className="text-[9px] uppercase tracking-wider text-white/30">Cor</p><div className="mt-3 flex gap-2">{colors.map((color) => <button disabled={!editable} key={color} onClick={() => change({ color })} className={`h-6 w-6 rounded-full ${draft.color === color ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[#0a0f18]" : ""}`} style={{ backgroundColor: color }}/>)}</div></div></div>{editable && <div className="mt-7 flex flex-wrap gap-2 border-t border-white/[.07] pt-5"><button onClick={() => change({ archived: !draft.archived })} className="flex items-center gap-1.5 rounded-xl border border-white/[.08] px-3 py-2 text-[10px] text-white/45"><Archive size={12}/>{draft.archived ? "Retirar do arquivo" : "Arquivar"}</button>{draft.reminderAt && !draft.reminderCompletedAt && <button onClick={() => change({ reminderCompletedAt: new Date().toISOString() })} className="flex items-center gap-1.5 rounded-xl border border-emerald-400/15 px-3 py-2 text-[10px] text-emerald-200/70"><Check size={12}/>Concluir lembrete</button>}<button onClick={() => void remove()} className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-400/15 px-3 py-2 text-[10px] text-red-300/65"><Trash2 size={12}/>Apagar</button></div>}</div> : <div className="grid h-full min-h-64 place-items-center text-center"><div><Lightbulb size={28} className="mx-auto text-white/20"/><p className="mt-3 text-sm text-white/35">Cria uma nota para começar.</p></div></div>}{error && <p className="mt-4 rounded-xl border border-red-400/15 bg-red-400/[.06] p-3 text-xs text-red-200/70">{error}</p>}</div>
    </div>
  </section>;
}
