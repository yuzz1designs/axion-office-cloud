import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Clock3, Eye, FileImage, FileText, Film, ImagePlus, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { isOfficeMemberOnline, officeSessionTime, type OfficePresenceSnapshot } from "../../lib/officePresence";
import type { TeamUpdateItem, TeamUpdateMedia, TeamUpdateViewer } from "../../server/teamUpdateStore";

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
    let timer: number | undefined;
    let heartbeatWorker: Worker | undefined;
    let heartbeatWorkerUrl: string | undefined;
    try {
      heartbeatWorkerUrl = URL.createObjectURL(new Blob([
        "setInterval(() => postMessage('heartbeat'), 25000);",
      ], { type: "application/javascript" }));
      heartbeatWorker = new Worker(heartbeatWorkerUrl);
      heartbeatWorker.onmessage = () => void refresh();
    } catch {
      timer = window.setInterval(() => void refresh(), 25_000);
    }
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== undefined) window.clearInterval(timer);
      heartbeatWorker?.terminate();
      if (heartbeatWorkerUrl) URL.revokeObjectURL(heartbeatWorkerUrl);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
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
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<TeamUpdateItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [requestedUpdateHandled, setRequestedUpdateHandled] = useState(false);

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
    const refresh = (event: Event) => { if (["team_updates", "team_update_reads"].includes((event as CustomEvent).detail?.table)) void loadUpdates(); };
    window.addEventListener("axion:realtime", refresh);
    return () => window.removeEventListener("axion:realtime", refresh);
  }, [loadUpdates]);

  const publish = async () => {
    setPublishing(true);
    setUpdatesError("");
    try {
      const response = await fetch(editingUpdate ? `/api/team/updates/${encodeURIComponent(editingUpdate.id)}` : "/api/team/updates", { method: editingUpdate ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || (editingUpdate ? "Não foi possível editar o update." : "Não foi possível publicar o update."));
      if (editingUpdate) {
        const edited = { ...editingUpdate, ...value.update } as TeamUpdateItem;
        setUpdates((current) => current.map((item) => item.id === edited.id ? edited : item));
        setEditingUpdate(null);
        setTitle("");
        setDescription("");
        setComposerOpen(false);
        window.dispatchEvent(new CustomEvent("axion:realtime", { detail: { table: "team_updates" } }));
        return;
      }
      const media: TeamUpdateMedia[] = [];
      const failed: string[] = [];
      for (const file of mediaFiles) {
        try {
          const mediaResponse = await fetch(`/api/team/updates/${encodeURIComponent(value.update.id)}/media`, { method: "POST", headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) }, body: file });
          const mediaValue = await mediaResponse.json().catch(() => ({}));
          if (!mediaResponse.ok) throw new Error(mediaValue.error || "Não foi possível enviar o anexo.");
          media.push(mediaValue.media);
        } catch { failed.push(file.name); }
      }
      const published = { ...value.update, media };
      setUpdates((current) => [published, ...current.filter((item) => item.id !== published.id)]);
      setTitle("");
      setDescription("");
      setMediaFiles([]);
      setComposerOpen(false);
      await loadUpdates();
      if (failed.length) setUpdatesError(`Update publicado, mas não foi possível anexar: ${failed.join(", ")}.`);
    } catch (error) {
      setUpdatesError(error instanceof Error ? error.message : "Não foi possível publicar o update.");
    } finally { setPublishing(false); }
  };

  const beginCreate = () => {
    setEditingUpdate(null); setTitle(""); setDescription(""); setMediaFiles([]); setUpdatesError(""); setComposerOpen(true);
  };

  const beginEdit = (update: TeamUpdateItem) => {
    setEditingUpdate(update); setTitle(update.title); setDescription(update.description); setMediaFiles([]); setUpdatesError(""); setSelected(null); setComposerOpen(true);
  };

  const removeUpdate = async (update: TeamUpdateItem) => {
    if (!window.confirm(`Apagar o update “${update.title}”? Esta ação não pode ser anulada.`)) return;
    setDeleting(true); setUpdatesError("");
    try {
      const response = await fetch(`/api/team/updates/${encodeURIComponent(update.id)}`, { method: "DELETE" });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível apagar o update.");
      setUpdates((current) => current.filter((item) => item.id !== update.id));
      setSelected(null);
      const url = new URL(window.location.href); url.searchParams.delete("update"); window.history.replaceState({}, "", url);
      window.dispatchEvent(new CustomEvent("axion:realtime", { detail: { table: "team_updates" } }));
    } catch (error) { setUpdatesError(error instanceof Error ? error.message : "Não foi possível apagar o update."); }
    finally { setDeleting(false); }
  };

  const selectMedia = (files: FileList | null) => {
    if (!files?.length) return;
    const accepted = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif", "video/mp4", "video/webm", "video/quicktime"]);
    const incoming = Array.from(files);
    const invalid = incoming.find((file) => !accepted.has(file.type));
    const tooLarge = incoming.find((file) => file.size > 50 * 1024 * 1024);
    if (invalid) return setUpdatesError(`${invalid.name}: formato não suportado.`);
    if (tooLarge) return setUpdatesError(`${tooLarge.name}: o limite é 50 MB por ficheiro.`);
    const combined = [...mediaFiles, ...incoming].filter((file, index, all) => all.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size && candidate.lastModified === file.lastModified) === index);
    if (combined.length > 4) return setUpdatesError("Cada update pode ter no máximo quatro anexos.");
    setMediaFiles(combined);
    setUpdatesError("");
  };

  const openUpdate = async (update: TeamUpdateItem) => {
    setHistoryOpen(false);
    setSelected(update);
    if (!currentUserId || update.authorUserId === currentUserId || update.viewers?.some((viewer) => viewer.userId === currentUserId)) return;
    try {
      const response = await fetch(`/api/team/updates/${encodeURIComponent(update.id)}/read`, { method: "POST" });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível registar a visualização.");
      const viewer = value.viewer as TeamUpdateViewer | null;
      if (!viewer) return;
      const applyViewer = (item: TeamUpdateItem) => item.id !== update.id ? item : { ...item, viewers: [...(item.viewers || []).filter((entry) => entry.userId !== viewer.userId), viewer], pendingViewerNames: (item.pendingViewerNames || []).filter((name) => name !== viewer.name) };
      setUpdates((current) => current.map(applyViewer));
      setSelected((current) => current ? applyViewer(current) : current);
    } catch (error) {
      setUpdatesError(error instanceof Error ? error.message : "Não foi possível registar a visualização.");
    }
  };

  useEffect(() => {
    if (requestedUpdateHandled || !updates.length) return;
    const requestedId = new URLSearchParams(window.location.search).get("update");
    if (!requestedId) { setRequestedUpdateHandled(true); return; }
    const requested = updates.find((update) => update.id === requestedId);
    if (requested) { setRequestedUpdateHandled(true); void openUpdate(requested); }
  }, [requestedUpdateHandled, updates]);

  return (
    <>
      <section aria-label="Equipa no Office" className="mb-4 w-full rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60">Equipa no Office</h2>
            <span className="text-[9px] text-white/30">Sessão atual · Atualização automática de presença</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { void loadUpdates(); setHistoryOpen(true); }} className="rounded-lg border border-white/[.07] px-2.5 py-1.5 text-[10px] text-white/45 transition hover:bg-white/[.05] hover:text-white/75">Últimos updates</button>
            <button type="button" onClick={beginCreate} className="rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-slate-950 transition hover:-translate-y-0.5" style={{ backgroundColor: accent, boxShadow: `0 8px 24px ${accent}22` }}><Plus size={12} className="mr-1 inline" />Publicar update</button>
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
        {composerOpen && <UpdateModal onClose={() => { if (!publishing) { setComposerOpen(false); setEditingUpdate(null); } }}>
          <div className="mb-6"><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Update diário</p><h2 className="mt-2 text-2xl font-semibold">{editingUpdate ? "Editar update" : "Publicar progresso"}</h2><p className="mt-1 text-xs text-white/35">{editingUpdate ? "Atualiza o título ou a descrição. Os anexos e visualizações serão mantidos." : "Partilha com a equipa o que avançou hoje."}</p></div>
          <label className="block text-[9px] uppercase tracking-wider text-white/35">Título<input autoFocus maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Homepage aprovada" className="mt-2 w-full rounded-xl border border-white/[.09] bg-white/[.035] px-3.5 py-3 text-sm text-white outline-none focus:border-white/20" /></label>
          <label className="mt-4 block text-[9px] uppercase tracking-wider text-white/35">Descrição<textarea maxLength={2000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Resume o trabalho concluído, decisões e próximos passos…" className="mt-2 w-full resize-none rounded-xl border border-white/[.09] bg-white/[.035] px-3.5 py-3 text-sm leading-6 text-white outline-none focus:border-white/20" /></label>
          {!editingUpdate && <div className="mt-4"><div className="flex items-center justify-between gap-3"><span className="text-[9px] uppercase tracking-wider text-white/35">Imagens ou vídeos</span><label className="cursor-pointer rounded-xl border border-white/[.09] bg-white/[.035] px-3 py-2 text-[10px] text-white/55 transition hover:border-white/20 hover:text-white"><ImagePlus size={13} className="mr-1.5 inline" />Anexar<input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/quicktime" className="hidden" disabled={publishing || mediaFiles.length >= 4} onChange={(event) => { selectMedia(event.target.files); event.currentTarget.value = ""; }} /></label></div><p className="mt-1.5 text-[9px] text-white/20">Até 4 ficheiros · máximo 50 MB cada</p>
            {mediaFiles.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2">{mediaFiles.map((file) => <div key={`${file.name}-${file.lastModified}`} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[.07] bg-black/15 px-3 py-2"><span className="shrink-0" style={{ color: accent }}>{file.type.startsWith("video/") ? <Film size={14} /> : <FileImage size={14} />}</span><span className="min-w-0 flex-1 truncate text-[10px] text-white/55">{file.name}</span><button type="button" aria-label={`Remover ${file.name}`} onClick={() => setMediaFiles((current) => current.filter((item) => item !== file))} className="shrink-0 text-white/25 hover:text-red-300"><Trash2 size={12} /></button></div>)}</div>}
          </div>}
          <div className="mt-2 flex justify-between text-[9px] text-white/20"><span>{updatesError}</span><span>{description.length}/2000</span></div>
          <div className="mt-6 flex justify-end gap-2"><button disabled={publishing} onClick={() => { setComposerOpen(false); setEditingUpdate(null); }} className="rounded-xl border border-white/[.08] px-4 py-2.5 text-xs text-white/45 disabled:opacity-40">Cancelar</button><button disabled={publishing || !title.trim() || !description.trim()} onClick={publish} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-40" style={{ backgroundColor: accent }}><Send size={13} className="mr-1.5 inline" />{publishing ? (editingUpdate ? "A guardar…" : "A publicar…") : (editingUpdate ? "Guardar alterações" : "Publicar")}</button></div>
        </UpdateModal>}
        {historyOpen && <UpdateModal onClose={() => setHistoryOpen(false)} wide>
          <div className="mb-5"><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Equipa AXION</p><h2 className="mt-2 text-2xl font-semibold">Últimos updates</h2><p className="mt-1 text-xs text-white/35">Progresso publicado por Nelson, Sousa e João.</p></div>
          <div className="max-h-[58vh] space-y-2 overflow-auto pr-1">{updates.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-white/30">Ainda não existem updates publicados.</p> : updates.map((update) => <button key={update.id} onClick={() => void openUpdate(update)} className="flex w-full items-start gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-4 text-left transition hover:border-white/[.14] hover:bg-white/[.045]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/[.07] bg-white/[.035]" style={{ color: accent }}><FileText size={15} /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center justify-between gap-2"><strong className="truncate text-sm font-medium text-white/80">{update.title}</strong><span className="text-[9px] text-white/25">{updateDate(update.createdAt)}</span></span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{update.authorName}</span><span className="mt-2 line-clamp-2 block text-xs leading-5 text-white/35">{update.description}</span>{update.media?.[0]?.url && <span className="relative mt-3 block h-28 overflow-hidden rounded-xl border border-white/[.07] bg-black/25">{update.media[0].kind === "video" ? <video src={update.media[0].url} autoPlay loop muted playsInline preload="metadata" className="h-full w-full object-cover" /> : <img src={update.media[0].url} alt={update.media[0].name} loading="lazy" className="h-full w-full object-cover" />}{update.media.length > 1 && <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-[9px] text-white/75">+{update.media.length - 1}</span>}</span>}<span className="mt-3 flex items-center gap-1.5 text-[9px] text-white/30"><Eye size={11} />{(update.viewers || []).length} de {(update.viewers || []).length + (update.pendingViewerNames || []).length} visualizaram</span></span></button>)}</div>
        </UpdateModal>}
        {selected && <UpdateModal onClose={() => { setSelected(null); const url = new URL(window.location.href); url.searchParams.delete("update"); window.history.replaceState({}, "", url); }}>
          <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/[.08] bg-white/[.035]" style={{ color: accent }}><FileText size={18} /></span><div><p className="text-[9px] font-semibold uppercase tracking-[.18em]" style={{ color: accent }}>{selected.authorName}</p><h2 className="mt-2 text-2xl font-semibold">{selected.title}</h2><p className="mt-1 flex items-center gap-1.5 text-[10px] text-white/25"><Clock3 size={11} />{updateDate(selected.createdAt)}{selected.updatedAt && selected.updatedAt !== selected.createdAt ? " · Editado" : ""}</p></div></div>{selected.authorUserId === currentUserId && <div className="mt-5 flex gap-2 border-t border-white/[.07] pt-4"><button type="button" disabled={deleting} onClick={() => beginEdit(selected)} className="flex items-center gap-1.5 rounded-xl border border-white/[.09] px-3 py-2 text-[10px] text-white/55 transition hover:bg-white/[.05] hover:text-white"><Pencil size={12} />Editar</button><button type="button" disabled={deleting} onClick={() => void removeUpdate(selected)} className="flex items-center gap-1.5 rounded-xl border border-red-400/15 px-3 py-2 text-[10px] text-red-300/70 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-40"><Trash2 size={12} />{deleting ? "A apagar…" : "Apagar"}</button></div>}{updatesError && <p className="mt-3 text-[10px] text-amber-200/70">{updatesError}</p>}<div className="mt-6 whitespace-pre-wrap rounded-2xl border border-white/[.07] bg-black/15 p-5 text-sm leading-7 text-white/60">{selected.description}</div>{selected.media?.length > 0 && <div className={`mt-4 grid gap-3 ${selected.media.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"}`}>{selected.media.map((media) => <figure key={media.id} className="overflow-hidden rounded-2xl border border-white/[.08] bg-black/30">{media.kind === "video" ? <video src={media.url} aria-label={media.name} autoPlay loop muted playsInline controls preload="metadata" className="max-h-[55vh] w-full object-contain" /> : <img src={media.url} alt={media.name} className="max-h-[55vh] w-full object-contain" />}<figcaption className="truncate border-t border-white/[.06] px-3 py-2 text-[9px] text-white/30">{media.name}</figcaption></figure>)}</div>}<div className="mt-4 rounded-2xl border border-white/[.07] bg-white/[.025] p-4"><p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-white/50"><Eye size={13} style={{ color: accent }} />Visualizações</p><div className="mt-3 flex flex-wrap gap-2">{selected.viewers?.length ? selected.viewers.map((viewer) => <span key={viewer.userId} title={`Visto em ${updateDate(viewer.viewedAt)}`} className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5 text-[10px] text-emerald-200">{viewer.name} · visto</span>) : <span className="text-[10px] text-white/30">Ainda ninguém visualizou.</span>}</div>{selected.pendingViewerNames?.length > 0 && <p className="mt-3 text-[10px] text-white/30">Por visualizar: {selected.pendingViewerNames.join(", ")}</p>}</div>
        </UpdateModal>}
      </AnimatePresence>
    </>
  );
}

function UpdateModal({ onClose, wide = false, children }: { onClose: () => void; wide?: boolean; children: ReactNode }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><motion.div initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} className={`relative max-h-[90vh] w-full overflow-auto rounded-[28px] border border-white/[.11] bg-[#0a0f18]/95 p-6 shadow-2xl ${wide ? "max-w-2xl" : "max-w-lg"}`}><button onClick={onClose} aria-label="Fechar" className="absolute right-5 top-5 rounded-xl border border-white/[.07] p-2 text-white/35 transition hover:bg-white/[.06] hover:text-white/70"><X size={15} /></button>{children}</motion.div></motion.div>;
}
