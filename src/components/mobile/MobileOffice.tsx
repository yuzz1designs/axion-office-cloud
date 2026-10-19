import UpdateComposer from "../updates/UpdateComposer";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bell, Clock3, Eye, LogOut, Monitor, NotebookPen, Pencil, RefreshCw, Plus, Trash2 } from "lucide-react";
import type { AxionProfile } from "../../types/profile";
import type { TeamUpdateItem, TeamUpdateViewer } from "../../server/teamUpdateStore";
import AxionLogo from "../ui/AxionLogo";
import PushNotificationSettings from "../settings/PushNotificationSettings";
import NotesScreen from "../notes/NotesScreen";

function formatDate(value: string) { return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

export default function MobileOffice({ profile, accent, onSignOut }: { profile: AxionProfile; accent: string; onSignOut: () => void }) {
  const initialParams = new URLSearchParams(window.location.search);
  const [view, setView] = useState<"updates" | "detail" | "settings" | "notes">(initialParams.has("note") ? "notes" : initialParams.has("notifications") ? "settings" : "updates");
  const [updates, setUpdates] = useState<TeamUpdateItem[]>([]);
  const [selected, setSelected] = useState<TeamUpdateItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);
  const leaveNotes = (next: "updates" | "settings") => { if (view === "notes" && notesDirty && !window.confirm("Tens alterações por guardar. Queres descartá-las?")) return; setNotesDirty(false); setView(next); setSelected(null); };

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/team/updates");
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível carregar os updates.");
      const next = value.updates || [];
      setUpdates(next);
      setSelected((current) => current ? next.find((item: TeamUpdateItem) => item.id === current.id) || current : current);
      const requestedId = new URLSearchParams(window.location.search).get("update");
      if (requestedId) {
        const requested = next.find((item: TeamUpdateItem) => item.id === requestedId);
        if (requested) { setSelected(requested); setView("detail"); }
      }
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível carregar os updates."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const refresh = (event: Event) => { if (["team_updates", "team_update_reads"].includes((event as CustomEvent).detail?.table)) void load(); };
    window.addEventListener("axion:realtime", refresh);
    return () => window.removeEventListener("axion:realtime", refresh);
  }, [load]);

  const openUpdate = async (update: TeamUpdateItem) => {
    setSelected(update); setView("detail");
    const url = new URL(window.location.href); url.searchParams.set("update", update.id); url.searchParams.delete("notifications"); window.history.replaceState({}, "", url);
    if (update.authorUserId === profile.id || update.viewers.some((viewer) => viewer.userId === profile.id)) return;
    try {
      const response = await fetch(`/api/team/updates/${encodeURIComponent(update.id)}/read`, { method: "POST" });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível registar a visualização.");
      const viewer = value.viewer as TeamUpdateViewer | null;
      if (viewer) {
        const apply = (item: TeamUpdateItem) => item.id === update.id ? { ...item, viewers: [...item.viewers.filter((entry) => entry.userId !== viewer.userId), viewer], pendingViewerNames: item.pendingViewerNames.filter((name) => name !== viewer.name) } : item;
        setUpdates((current) => current.map(apply)); setSelected((current) => current ? apply(current) : current);
      }
    } catch { /* Reading remains available if the receipt cannot be stored. */ }
  };

  const back = () => { setEditing(false); setSelected(null); setView("updates"); const url = new URL(window.location.href); url.searchParams.delete("update"); url.searchParams.delete("note"); url.searchParams.delete("notifications"); window.history.replaceState({}, "", url); };
  const beginEdit = () => { if (selected) { setError(""); setEditing(true); } };
  const removeUpdate = async () => {
    if (!selected || !window.confirm(`Apagar o update “${selected.title}”? Esta ação não pode ser anulada.`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/team/updates/${encodeURIComponent(selected.id)}`, { method: "DELETE" });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível apagar o update.");
      setUpdates((current) => current.filter((item) => item.id !== selected.id)); back();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível apagar o update."); }
    finally { setSaving(false); }
  };

  return <main className="h-full overflow-y-auto bg-[#050609] text-white">
    <fieldset disabled={saving || creating || editing} className="contents"><header className="sticky top-0 z-20 border-b border-white/[.07] bg-[#050609]/90 px-4 pb-3 pt-[max(14px,env(safe-area-inset-top))] backdrop-blur-xl"><div className="flex items-center justify-between"><AxionLogo size="sm" variant="full" pulse={false} isLight={false} /><div className="flex items-center gap-2"><button onClick={() => { setView("notes"); setSelected(null); }} aria-label="Notas" className="rounded-xl border border-white/[.08] p-2.5 text-white/55"><NotebookPen size={16} /></button><button onClick={() => leaveNotes("settings")} aria-label="Definições de notificações" className="rounded-xl border border-white/[.08] p-2.5 text-white/55"><Bell size={16} /></button><button onClick={() => { if (view !== "notes" || !notesDirty || window.confirm("Tens alterações por guardar. Queres descartá-las?")) onSignOut(); }} aria-label="Terminar sessão" className="rounded-xl border border-white/[.08] p-2.5 text-white/55"><LogOut size={16} /></button></div></div></header></fieldset>
    <div className="mx-auto w-full max-w-xl px-4 pb-[max(32px,env(safe-area-inset-bottom))] pt-6">
      {creating ? <UpdateComposer accent={accent} onBusyChange={setSaving} onCancel={() => { setCreating(false); void load(); }} onSaved={(update) => { setUpdates((items) => [update, ...items.filter((item) => item.id !== update.id)]); setCreating(false); void openUpdate(update); }} />
      : view === "notes" ? <NotesScreen currentUserId={profile.id} accent={accent} onDirtyChange={setNotesDirty} onBack={back} compact />
      : view === "settings" ? <><button disabled={saving} onClick={back} className="mb-5 flex items-center gap-2 text-xs text-white/45"><ArrowLeft size={14} />Updates</button><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Definições</p><h1 className="mb-5 mt-2 text-2xl font-semibold">Notificações</h1><PushNotificationSettings accent={accent} /></>
      : view === "detail" && selected ? <><button disabled={saving} onClick={back} className="mb-5 flex items-center gap-2 text-xs text-white/45"><ArrowLeft size={14} />Todos os updates</button><article><p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{selected.authorName}</p>{editing ? <div className="mt-3"><UpdateComposer update={selected} accent={accent} onBusyChange={setSaving} onCancel={() => { setEditing(false); void load(); }} onSaved={(update) => { setSelected(update); setUpdates((items) => items.map((item) => item.id === update.id ? update : item)); setEditing(false); }} /></div> : <><h1 className="mt-2 text-2xl font-semibold leading-tight">{selected.title}</h1><p className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30"><Clock3 size={11} />{formatDate(selected.createdAt)}{selected.updatedAt && selected.updatedAt !== selected.createdAt ? " · Editado" : ""}</p>{selected.authorUserId === profile.id && <div className="mt-4 flex gap-2"><button disabled={saving} onClick={beginEdit} className="flex items-center gap-1.5 rounded-xl border border-white/[.09] px-3 py-2 text-xs text-white/55"><Pencil size={13} />Editar</button><button disabled={saving} onClick={() => void removeUpdate()} className="flex items-center gap-1.5 rounded-xl border border-red-400/15 px-3 py-2 text-xs text-red-300/70"><Trash2 size={13} />{saving ? "A apagar…" : "Apagar"}</button></div>}<p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-white/65">{selected.description}</p></>}{error && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3 text-xs text-amber-100/70">{error}</p>}{!editing && selected.media.length > 0 && <div className="mt-5 space-y-3">{selected.media.map((media) => <figure key={media.id} className="overflow-hidden rounded-2xl border border-white/[.08] bg-black/30">{media.kind === "video" ? <video src={media.url} autoPlay loop muted playsInline controls className="max-h-[65vh] w-full object-contain" /> : <img src={media.url} alt={media.name} className="max-h-[65vh] w-full object-contain" />}<figcaption className="truncate border-t border-white/[.06] px-3 py-2 text-[9px] text-white/30">{media.name}</figcaption></figure>)}</div>}<div className="mt-5 rounded-2xl border border-white/[.07] bg-white/[.025] p-4 text-[10px] text-white/35"><p className="flex items-center gap-2 font-semibold uppercase tracking-wider text-white/50"><Eye size={12} style={{ color: accent }} />{selected.viewers.length} de {selected.viewers.length + selected.pendingViewerNames.length} visualizaram</p>{selected.viewers.length > 0 && <p className="mt-2">Visto por: {selected.viewers.map((viewer) => viewer.name).join(", ")}</p>}{selected.pendingViewerNames.length > 0 && <p className="mt-1">Por visualizar: {selected.pendingViewerNames.join(", ")}</p>}</div></article></>
      : <><section className="mb-6"><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>AXION Office · Mobile</p><h1 className="mt-2 text-2xl font-semibold">Olá, {profile.name || profile.displayName}</h1><p className="mt-1 text-xs text-white/35">Acompanha e partilha os updates da equipa.</p><button onClick={() => { setCreating(true); setError(""); }} className="mt-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-950" style={{ backgroundColor: accent }}><Plus size={16} />Publicar update</button></section>{loading ? <div className="grid min-h-52 place-items-center"><RefreshCw size={18} className="animate-spin text-white/30" /></div> : error ? <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[.06] p-4 text-xs text-amber-100/70">{error}</p> : <div className="space-y-3">{updates.map((update) => <button key={update.id} onClick={() => void openUpdate(update)} className="w-full overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.025] text-left"><div className="p-4"><div className="flex items-center justify-between gap-3"><span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{update.authorName}</span><span className="text-[9px] text-white/25">{formatDate(update.createdAt)}</span></div><h2 className="mt-2 text-base font-semibold text-white/85">{update.title}</h2><p className="mt-2 line-clamp-3 text-xs leading-5 text-white/40">{update.description}</p>{update.media[0]?.url && <div className="mt-3 h-40 overflow-hidden rounded-xl bg-black/30">{update.media[0].kind === "video" ? <video src={update.media[0].url} autoPlay loop muted playsInline className="h-full w-full object-cover" /> : <img src={update.media[0].url} alt={update.media[0].name} loading="lazy" className="h-full w-full object-cover" />}</div>}</div></button>)}{!updates.length && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs text-white/30">Ainda não existem updates.</p>}</div>}<div className="mt-8 flex gap-3 rounded-2xl border border-white/[.06] bg-white/[.02] p-4"><Monitor size={16} className="shrink-0 text-white/30" /><p className="text-[10px] leading-5 text-white/30">A experiência completa do AXION Office continua disponível num computador.</p></div></>}
    </div>
  </main>;
}
