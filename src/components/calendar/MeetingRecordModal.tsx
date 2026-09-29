import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Download, FileText, FileUp, ListTodo, LoaderCircle, NotebookPen, Save, X } from "lucide-react";
import type { CalendarEvent, IntegratedTask } from "../../data/calendarMockData";
import type { WorkspaceMeetingMember } from "../../server/meetingStore";

interface MeetingFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  url: string;
}

interface MeetingRecord {
  event: CalendarEvent;
  members: WorkspaceMeetingMember[];
  minutes: string;
  notes: string;
  tasks: IntegratedTask[];
  files: MeetingFile[];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || "Não foi possível concluir a operação.");
  return value as T;
}

export default function MeetingRecordModal({ event, accent, onClose, onCompleted }: {
  event: CalendarEvent;
  accent: string;
  onClose: () => void;
  onCompleted: (event: CalendarEvent) => void;
}) {
  const [record, setRecord] = useState<MeetingRecord | null>(null);
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState(event.date);
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  const load = useCallback(async () => {
    try {
      const value = await api<MeetingRecord>(`/api/meetings/${encodeURIComponent(event.id)}/record`);
      setRecord(value);
      setMinutes(value.minutes || "");
      setNotes(value.notes || "");
      setAssignee((current) => current || value.members[0]?.id || "");
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível abrir a ficha.");
    }
  }, [event.id]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const value = await api<{ event: CalendarEvent }>(`/api/meetings/${encodeURIComponent(event.id)}/record`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minutes, notes }),
      });
      setRecord((current) => current ? { ...current, event: value.event, minutes, notes } : current);
      setNotice("Ficha guardada.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível guardar."); }
    finally { setBusy(false); }
  };

  const complete = async () => {
    setBusy(true);
    try {
      const value = await api<{ event: CalendarEvent }>(`/api/meetings/${encodeURIComponent(event.id)}/complete`, { method: "POST" });
      setRecord((current) => current ? { ...current, event: value.event } : current);
      onCompleted(value.event);
      setNotice("Reunião marcada como concluída.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível concluir a reunião."); }
    finally { setBusy(false); }
  };

  const addTask = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!taskTitle.trim() || !assignee) return;
    setBusy(true);
    try {
      const value = await api<{ task: IntegratedTask }>(`/api/meetings/${encodeURIComponent(event.id)}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: taskTitle, notes: taskNotes, assigneeUserId: assignee, dueDate: dueDate || null, dueTime: dueTime || null, priority }),
      });
      setRecord((current) => current ? { ...current, tasks: [...current.tasks, value.task] } : current);
      setTaskTitle(""); setTaskNotes(""); setDueTime("");
      setNotice("Tarefa atribuída.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível atribuir a tarefa."); }
    finally { setBusy(false); }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const value = await api<{ file: MeetingFile }>(`/api/meetings/${encodeURIComponent(event.id)}/files`, {
        method: "POST", headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) }, body: file,
      });
      setRecord((current) => current ? { ...current, files: [value.file, ...current.files] } : current);
      setNotice("Ficheiro anexado.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível anexar o ficheiro."); }
    finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onMouseDown={(mouseEvent) => mouseEvent.target === mouseEvent.currentTarget && onClose()}>
        <motion.section initial={{ opacity: 0, y: 18, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#090e18]/98 shadow-2xl">
          <header className="sticky top-0 z-10 flex flex-wrap items-start justify-between gap-4 border-b border-white/[.08] bg-[#090e18]/95 px-6 py-5 backdrop-blur-xl">
            <div><p className="font-mono text-[9px] uppercase tracking-[.24em]" style={{ color: accent }}>Ficha de reunião</p><h2 className="mt-1 text-xl font-semibold text-white">{event.title}</h2><p className="mt-1 text-[11px] text-white/35">{event.date} · {event.startTime}–{event.endTime} · {event.attendees.length} participantes</p></div>
            <div className="flex items-center gap-2">
              {(record?.event.status || event.status) !== "completed" && <button disabled={busy} onClick={complete} className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"><CheckCircle2 size={14} className="mr-1.5 inline" />Marcar concluída</button>}
              <button onClick={onClose} aria-label="Fechar ficha" className="rounded-xl border border-white/[.08] p-2 text-white/40 hover:bg-white/[.06] hover:text-white"><X size={16} /></button>
            </div>
          </header>

          {!record ? <div className="grid min-h-72 place-items-center text-xs text-white/40">{notice || <><LoaderCircle size={18} className="mr-2 animate-spin" />A abrir ficha…</>}</div> : <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-6">
              <section className="rounded-2xl border border-white/[.07] bg-white/[.025] p-5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70"><FileText size={14} style={{ color: accent }} />Ata da reunião</h3>
                <textarea value={minutes} onChange={(e) => setMinutes(e.target.value)} rows={10} maxLength={50_000} placeholder="Regista os temas discutidos, decisões e conclusões…" className="mt-4 w-full resize-y rounded-xl border border-white/[.08] bg-black/20 p-3 text-sm leading-6 text-white/75 outline-none focus:border-white/20" />
              </section>
              <section className="rounded-2xl border border-white/[.07] bg-white/[.025] p-5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70"><NotebookPen size={14} style={{ color: accent }} />Anotações internas</h3>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} maxLength={50_000} placeholder="Notas de trabalho, seguimentos e contexto adicional…" className="mt-4 w-full resize-y rounded-xl border border-white/[.08] bg-black/20 p-3 text-sm leading-6 text-white/75 outline-none focus:border-white/20" />
                <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[10px] text-white/35">{notice}</span><button disabled={busy} onClick={save} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50" style={{ backgroundColor: accent }}><Save size={13} className="mr-1.5 inline" />Guardar ficha</button></div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-white/[.07] bg-white/[.025] p-5">
                <div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70"><FileUp size={14} style={{ color: accent }} />Ficheiros</h3><label className="cursor-pointer rounded-lg border border-white/[.09] px-3 py-2 text-[10px] text-white/60 hover:bg-white/[.05]"><FileUp size={12} className="mr-1 inline" />Anexar<input type="file" className="hidden" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.currentTarget.value = ""; }} /></label></div>
                <div className="mt-4 space-y-2">{record.files.length ? record.files.map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-black/15 px-3 py-2.5 hover:border-white/[.13]"><FileText size={14} style={{ color: accent }} /><span className="min-w-0 flex-1 truncate text-xs text-white/70">{file.name}</span><span className="text-[9px] text-white/25">{formatSize(file.sizeBytes)}</span><Download size={12} className="text-white/35" /></a>) : <p className="rounded-xl border border-dashed border-white/[.08] p-6 text-center text-[10px] text-white/25">Ainda não existem ficheiros anexados.</p>}</div>
              </section>

              <section className="rounded-2xl border border-white/[.07] bg-white/[.025] p-5">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/70"><ListTodo size={14} style={{ color: accent }} />Atribuição de tarefas</h3>
                <form onSubmit={addTask} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input required value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Tarefa a executar" className="sm:col-span-2 rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-xs text-white outline-none" />
                  <select required value={assignee} onChange={(e) => setAssignee(e.target.value)} className="rounded-xl border border-white/[.08] bg-[#0b111d] px-3 py-2.5 text-xs text-white/70"><option value="">Responsável</option>{record.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} className="rounded-xl border border-white/[.08] bg-[#0b111d] px-3 py-2.5 text-xs text-white/70"><option value="high">Prioridade alta</option><option value="medium">Prioridade média</option><option value="low">Prioridade baixa</option></select>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-xs text-white/70" />
                  <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-xs text-white/70" />
                  <input value={taskNotes} onChange={(e) => setTaskNotes(e.target.value)} placeholder="Notas da tarefa (opcional)" className="sm:col-span-2 rounded-xl border border-white/[.08] bg-black/20 px-3 py-2.5 text-xs text-white outline-none" />
                  <button disabled={busy || !taskTitle.trim() || !assignee} className="sm:col-span-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-40" style={{ backgroundColor: accent }}>Atribuir tarefa</button>
                </form>
                <div className="mt-5 space-y-2">{record.tasks.map((task) => <div key={task.id} className="rounded-xl border border-white/[.06] bg-black/15 px-3 py-2.5"><div className="flex items-center justify-between gap-3"><span className="text-xs text-white/75">{task.title}</span><span className={`h-1.5 w-1.5 rounded-full ${task.priority === "high" ? "bg-red-400" : task.priority === "medium" ? "bg-sky-400" : "bg-emerald-400"}`} /></div><p className="mt-1 text-[9px] text-white/30">{task.assignee.name}{task.dueDate ? ` · ${task.dueDate}` : ""}{task.dueTime ? ` às ${task.dueTime}` : ""}</p></div>)}{!record.tasks.length && <p className="text-[10px] text-white/25">Ainda não existem tarefas de seguimento.</p>}</div>
              </section>
            </div>
          </div>}
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
