import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock3, FileText, Plus, Send, X } from "lucide-react";
import { isOfficeMemberOnline, officeSessionTime, type OfficePresenceSnapshot } from "../../lib/officePresence";

interface TeamUpdateItem {
  id: string;
  authorUserId: string;
  authorName: string;
  title: string;
  description: string;
  publishedOn: string;
  createdAt: string;
}

export function useOfficePresence(userId?: string) {
  const [snapshot, setSnapshot] = useState<OfficePresenceSnapshot | null>(null);
  const [clockOffset, setClockOffset] = useState(0);
  const [error, setError] = useState(false);
  useEffect(() => {
    setSnapshot(null);
    if (!userId) return;
    let stopped = false;
    let pending = false;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (pending || stopped) return;
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 10_000);
      try {
        const response = await fetch("/api/team/presence", { method: "POST", signal: controller.signal });
        if (!response.ok) throw new Error("PRESENCE_UNAVAILABLE");
        const data = await response.json() as OfficePresenceSnapshot;
        if (!stopped) {
          setClockOffset(Date.parse(data.serverTime) - Date.now());
          setSnapshot(data);
          setError(false);
        }
      } catch {
        if (!stopped) setError(true);
      } finally { window.clearTimeout(timeout); pending = false; }
    };
    const visible = () => { if (document.visibilityState === "visible") void refresh(); };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 25_000);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [userId]);
  return { snapshot, clockOffset, error };
}

function updateDate(value: string) {
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function OfficePresence({ presence, currentUserId, now, accent }: {
  presence: ReturnType<typeof useOfficePresence>; currentUserId?: string; now: number; accent: string;
}) {
  const serverNow = now + presence.clockOffset;
  const members = [...(presence.snapshot?.members || [])].sort((a, b) =>
    Number(isOfficeMemberOnline(b, serverNow)) - Number(isOfficeMemberOnline(a, serverNow)) || a.name.localeCompare(b.name));
  const [updates, setUpdates] = useState<TeamUpdateItem[]>([]);
  const [updatesError, setUpdatesError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selected, setSelected] = useState<TeamUpdateItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [publishing, setPublishing] = useState(false);

  const loadUpdates = useCallback(async () => {
    try {
      const response = await fetch("/api/team/updates");
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível carregar os updates.");
      setUpdates(value.updates || []);
      setUpdatesError("");
    } catch (error) {
      setUpdatesError(error instanceof Error ? error.message : "Não foi possível carregar os updates.");
    }
  }, []);

  useEffect(() => {
    void loadUpdates();
    const refresh = (event: Event) => { if ((event as CustomEvent).detail?.table === "team_updates") void loadUpdates(); };
    window.addEventListener("axion:realtime", refresh);
    return () => window.removeEventListener("axion:realtime", refresh);
  }, [loadUpdates]);

  const publish = async () => {
    setPublishing(true);
    setUpdatesError("");
    try {
      const response = await fetch("/api/team/updates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível publicar o update.");
      setUpdates((current) => [value.update, ...current.filter((item) => item.id !== value.update.id)]);
      setTitle("");
      setDescription("");
      setComposerOpen(false);
    } catch (error) {
      setUpdatesError(error instanceof Error ? error.message : "Não foi possível publicar o update.");
    } finally { setPublishing(false); }
  };

  return (
    <>
      <section aria-label="Equipa no Office" className="mb-4 w-full rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60">Equipa no Office</h2>
            <span className="text-[9px] text-white/30">Sessão atual · Offline após 2 min sem ligação</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setHistoryOpen(true)} className="rounded-lg border border-white/[.07] px-2.5 py-1.5 text-[10px] text-white/45 transition hover:bg-white/[.05] hover:text-white/75">Últimos updates</button>
            <button type="button" onClick={() => { setUpdatesError(""); setComposerOpen(true); }} className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-slate-950 transition hover:-translate-y-0.5" style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${accent}22` }}><Plus size={12} className="mr-1 inline" />Publicar update</button>
          </div>
        </div>
        {presence.error ? <p role="status" className="text-xs text-amber-300">Não foi possível atualizar a presença. A tentar novamente…</p>
          : !presence.snapshot ? <p role="status" className="text-xs text-white/40">A verificar presença…</p>
          : <ul className="flex flex-wrap gap-3">
            {members.map((member) => {
              const online = isOfficeMemberOnline(member, serverNow);
              return <li key={member.userId} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/15 px-3 py-2">
                <span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-white/20"}`} />
                <div className="min-w-0"><div className="text-xs text-white/85">{member.name}{member.userId === currentUserId ? " (tu)" : ""}</div><div className="text-[10px] text-white/45">{online ? "Online" : "Offline"}</div></div>
                {online && <span className="text-xs font-mono tabular-nums text-white/70" aria-label={`Tempo de sessão de ${member.name}`}>{officeSessionTime(member, serverNow)}</span>}
              </li>;
            })}
          </ul>}
        {updatesError && !composerOpen && <p className="mt-2 text-right text-[10px] text-amber-200/70">{updatesError}</p>}
      </section>

      <AnimatePresence>
        {composerOpen && <UpdateModal onClose={() => setComposerOpen(false)}>
          <div className="mb-6"><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Update diário</p><h2 className="mt-2 text-2xl font-semibold">Publicar progresso</h2><p className="mt-1 text-xs text-white/35">Partilha com a equipa o que avançou hoje.</p></div>
          <label className="block text-[9px] uppercase tracking-wider text-white/35">Título<input autoFocus maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Homepage aprovada" className="mt-2 w-full rounded-xl border border-white/[.09] bg-white/[.035] px-3.5 py-3 text-sm text-white outline-none focus:border-white/20" /></label>
          <label className="mt-4 block text-[9px] uppercase tracking-wider text-white/35">Descrição<textarea maxLength={2000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Resume o trabalho concluído, decisões e próximos passos…" className="mt-2 w-full resize-none rounded-xl border border-white/[.09] bg-white/[.035] px-3.5 py-3 text-sm leading-6 text-white outline-none focus:border-white/20" /></label>
          <div className="mt-2 flex justify-between text-[9px] text-white/20"><span>{updatesError}</span><span>{description.length}/2000</span></div>
          <div className="mt-6 flex justify-end gap-2"><button onClick={() => setComposerOpen(false)} className="rounded-xl border border-white/[.08] px-4 py-2.5 text-xs text-white/45">Cancelar</button><button disabled={publishing || !title.trim() || !description.trim()} onClick={publish} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-40" style={{ backgroundColor: accent }}><Send size={13} className="mr-1.5 inline" />{publishing ? "A publicar…" : "Publicar"}</button></div>
        </UpdateModal>}
        {historyOpen && <UpdateModal onClose={() => setHistoryOpen(false)} wide>
          <div className="mb-5"><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Equipa AXION</p><h2 className="mt-2 text-2xl font-semibold">Últimos updates</h2><p className="mt-1 text-xs text-white/35">Progresso publicado por Nelson, Sousa e João.</p></div>
          <div className="max-h-[58vh] space-y-2 overflow-auto pr-1">{updates.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-white/30">Ainda não existem updates publicados.</p> : updates.map((update) => <button key={update.id} onClick={() => { setHistoryOpen(false); setSelected(update); }} className="flex w-full items-start gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-4 text-left transition hover:border-white/[.14] hover:bg-white/[.045]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.035]" style={{ color: accent }}><FileText size={15} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><strong className="truncate text-sm font-medium text-white/80">{update.title}</strong><span className="text-[9px] text-white/25">{updateDate(update.createdAt)}</span></span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{update.authorName}</span><span className="mt-2 line-clamp-2 block text-xs leading-5 text-white/35">{update.description}</span></span></button>)}</div>
        </UpdateModal>}
        {selected && <UpdateModal onClose={() => setSelected(null)}>
          <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/[.08] bg-white/[.035]" style={{ color: accent }}><FileText size={18} /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.18em]" style={{ color: accent }}>{selected.authorName}</p><h2 className="mt-2 text-2xl font-semibold">{selected.title}</h2><p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/25"><Clock3 size={11} />{updateDate(selected.createdAt)}</p></div></div><div className="mt-6 whitespace-pre-wrap rounded-2xl border border-white/[.07] bg-black/15 p-5 text-sm leading-7 text-white/60">{selected.description}</div>
        </UpdateModal>}
      </AnimatePresence>
    </>
  );
}

function UpdateModal({ onClose, wide = false, children }: { onClose: () => void; wide?: boolean; children: ReactNode }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><motion.div initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} className={`relative max-h-[90vh] w-full overflow-auto rounded-[28px] border border-white/[.11] bg-[#0a0f18]/95 p-6 shadow-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}><button onClick={onClose} aria-label="Fechar" className="absolute right-5 top-5 rounded-xl border border-white/[.07] p-2 text-white/35 transition hover:bg-white/[.06] hover:text-white/70"><X size={15} /></button>{children}</motion.div></motion.div>;
}
