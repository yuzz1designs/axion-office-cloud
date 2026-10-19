import { useRef, useState } from "react";
import { ImagePlus, Send, Trash2 } from "lucide-react";
import type { TeamUpdateItem, TeamUpdateMedia } from "../../server/teamUpdateStore";
import { validateTeamUpdateMedia, MAX_TEAM_UPDATE_MEDIA_FILES } from "../../server/teamUpdateCore";

export default function UpdateComposer({ update, accent, onSaved, onCancel, onBusyChange }: {
  update?: TeamUpdateItem | null;
  accent: string;
  onSaved: (update: TeamUpdateItem) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [title, setTitle] = useState(update?.title || "");
  const [description, setDescription] = useState(update?.description || "");
  const [media, setMedia] = useState<TeamUpdateMedia[]>(update?.media || []);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Keep completed operations across retries, so a failed upload never creates a second update.
  const saved = useRef<TeamUpdateItem | null>(update || null);
  const inFlight = useRef(false);

  const selectFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files, ...Array.from(incoming)];
    if (next.length + media.length > MAX_TEAM_UPDATE_MEDIA_FILES) return setError("Cada update pode ter no máximo quatro anexos.");
    try {
      for (const file of next) validateTeamUpdateMedia(file.type, file.size);
      setFiles(next); setError("");
    } catch { setError("Seleciona imagens ou vídeos compatíveis, não vazios, até 50 MB cada."); }
  };

  const save = async () => {
    if (inFlight.current || !title.trim() || !description.trim()) return;
    inFlight.current = true; setBusy(true); onBusyChange?.(true); setError("");
    const request = async (url: string, init: RequestInit) => {
      const response = await fetch(url, init);
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível guardar. Tenta novamente.");
      return value;
    };
    try {
      const current = saved.current;
      const value = await request(current ? `/api/team/updates/${encodeURIComponent(current.id)}` : "/api/team/updates", {
        method: current ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description }),
      });
      let result: TeamUpdateItem = { ...current, ...value.update };
      saved.current = result;
      const base = `/api/team/updates/${encodeURIComponent(result.id)}/media`;
      for (const attachment of result.media.filter((item) => !media.some((kept) => kept.id === item.id))) {
        await request(`${base}/${encodeURIComponent(attachment.id)}`, { method: "DELETE" });
        result = { ...result, media: result.media.filter((item) => item.id !== attachment.id) };
        saved.current = result;
      }
      for (const file of files) {
        const value = await request(base, { method: "POST", headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) }, body: file });
        result = { ...result, media: [...result.media, value.media] };
        saved.current = result;
        setMedia((items) => [...items, value.media]);
        setFiles((items) => items.filter((item) => item !== file));
      }
      onSaved(result);
      window.dispatchEvent(new CustomEvent("axion:realtime", { detail: { table: "team_updates" } }));
    } catch (caught) {
      setError(`${saved.current ? "O texto foi guardado; alguns anexos podem já ter sido alterados. " : ""}${caught instanceof Error ? caught.message : "Não foi possível guardar."} Podes tentar novamente.`);
    } finally { inFlight.current = false; setBusy(false); onBusyChange?.(false); }
  };

  return <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
    <div><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Update diário</p><h2 className="mt-2 text-2xl font-semibold">{update ? "Editar update" : "Publicar progresso"}</h2><p className="mt-1 text-xs text-white/40">{update ? "Altera o texto, adiciona ou remove anexos. As visualizações são mantidas." : "Partilha com a equipa o que avançou hoje."}</p></div>
    <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
      <label className="block text-xs text-white/50">Título<input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex: Homepage aprovada" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-base text-white outline-none focus:border-white/40" /></label>
      <label className="block text-xs text-white/50">Descrição<textarea required maxLength={2000} rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Trabalho concluído, decisões e próximos passos…" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-base leading-6 text-white outline-none focus:border-white/40" /></label>
      <div className="flex items-center justify-between gap-3"><span className="text-xs text-white/40">Anexos ({media.length + files.length}/4)</span><label className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/70 hover:bg-white/10 focus-within:ring-2 focus-within:ring-white/50"><ImagePlus size={14} className="mr-2 inline" />Anexar<input aria-label="Anexar imagens ou vídeos" type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/quicktime" disabled={busy || media.length + files.length >= 4} className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={(event) => { selectFiles(event.target.files); event.currentTarget.value = ""; }} /></label></div>
      <p className="text-[10px] text-white/35">Imagens ou vídeos · até 4 ficheiros · 50 MB cada</p>
      <div className="space-y-2">{media.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-2">{item.kind === "image" ? <img src={item.url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <video src={item.url} muted playsInline preload="metadata" className="h-12 w-12 rounded-lg object-cover" />}<span className="min-w-0 flex-1 truncate text-xs text-white/60">{item.name}</span><button type="button" aria-label={`Remover ${item.name}`} onClick={() => setMedia((items) => items.filter((entry) => entry.id !== item.id))} className="rounded-lg p-3 text-white/50 hover:text-red-300"><Trash2 size={16} /></button></div>)}
      {files.map((file, index) => <div key={index} className="flex items-center gap-3 rounded-xl border border-white/10 p-2"><span className="min-w-0 flex-1 truncate text-xs text-white/60">{file.name} · novo</span><button type="button" aria-label={`Remover ${file.name}`} onClick={() => setFiles((items) => items.filter((_, i) => i !== index))} className="rounded-lg p-3 text-white/50 hover:text-red-300"><Trash2 size={16} /></button></div>)}</div>
    </fieldset>
    {error && <p role="alert" className="text-xs leading-5 text-amber-200">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-3 text-xs text-white/60 disabled:opacity-40">{saved.current && !update ? "Fechar" : "Cancelar"}</button><button type="submit" disabled={busy || !title.trim() || !description.trim()} className="rounded-xl px-4 py-3 text-xs font-semibold text-slate-950 disabled:opacity-40" style={{ backgroundColor: accent }}><Send size={13} className="mr-2 inline" />{busy ? "A guardar…" : update ? "Guardar alterações" : "Publicar"}</button></div>
  </form>;
}
