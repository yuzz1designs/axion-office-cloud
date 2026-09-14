import { useEffect, useMemo, useState } from "react";
import { AppWindow, CheckCircle2, FolderLock, Monitor, RefreshCw, ShieldCheck, Terminal, XCircle } from "lucide-react";
import { isDesktopRuntime } from "../../lib/runtime";
import { useAivaSession } from "../aiva/AivaSessionProvider";

interface DesktopApplication { name: string; bundleId: string; path: string; authorized: boolean; capabilities: string[]; integrationMethods: string[]; }

export default function AivaDesktopSettings() {
  const session = useAivaSession();
  const desktopRuntime = isDesktopRuntime();
  const [applications, setApplications] = useState<DesktopApplication[]>([]);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [pairingCode, setPairingCode] = useState("");

  async function loadApplications() {
    if (!desktopRuntime || !session.desktop.connected) return setApplications([]);
    setBusy("refresh");
    try {
      const response = await fetch("/api/aiva/desktop/apps");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível descobrir as aplicações.");
      setApplications(data.applications || []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível descobrir as aplicações."); }
    finally { setBusy(""); }
  }

  useEffect(() => { void loadApplications(); }, [desktopRuntime, session.desktop.connected]);

  async function setAuthorized(application: DesktopApplication, authorized: boolean) {
    setBusy(application.bundleId); setNotice("");
    try {
      const response = await fetch("/api/aiva/desktop/apps/authorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bundleId: application.bundleId, authorized }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível alterar a autorização.");
      setApplications(data.applications || []);
      setNotice(`${application.name}: acesso ${authorized ? "autorizado" : "revogado"}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível alterar a autorização."); }
    finally { setBusy(""); }
  }

  async function requestPermissions() {
    setBusy("permissions"); setNotice("");
    try {
      const response = await fetch("/api/aiva/desktop/permissions", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível abrir as permissões.");
      window.setTimeout(() => void session.refreshDesktop(), 700);
      setNotice("Confirma AXIONControl em Acessibilidade e Gravação do ecrã nas Definições do Sistema.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível abrir as permissões."); }
    finally { setBusy(""); }
  }

  async function pair() {
    setBusy("pair"); setNotice("");
    try { await session.pairDesktop(pairingCode.trim()); setPairingCode(""); setNotice("Mac associado ao teu perfil AXION."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível associar este Mac."); }
    finally { setBusy(""); }
  }

  const filtered = useMemo(() => applications.filter(app => `${app.name} ${app.bundleId}`.toLowerCase().includes(query.toLowerCase())), [applications, query]);
  const permissions = session.desktop.permissions;
  const states = [
    { label: "Acessibilidade", active: Boolean(permissions?.accessibility), icon: ShieldCheck },
    { label: "Gravação do ecrã", active: Boolean(permissions?.screenRecording), icon: Monitor },
    { label: "Pastas autorizadas", active: Boolean(permissions?.authorizedFolders), icon: FolderLock },
    { label: "Shell básico", active: Boolean(session.desktop.shell), icon: Terminal },
  ];

  return <section className="space-y-5 rounded-3xl border border-white/[0.08] bg-[#0d121c]/80 p-5 shadow-xl backdrop-blur-xl">
    <div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">AIVA · Runtime</p><h2 className="mt-2 text-xl font-semibold text-white">Acesso ao Computador</h2><p className="mt-1 text-xs leading-relaxed text-white/45">Estado do runtime, permissões macOS e aplicações que a AIVA pode usar.</p></div>
    {!desktopRuntime ? <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="font-medium text-white">Runtime Web</p><p className="mt-1 text-xs text-white/45">O acesso local ao computador só está disponível na app AXION OFFICE para macOS.</p></div> : <>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div><p className="text-sm font-medium text-white">{session.desktop.deviceName || "Este Mac"}</p><p className="mt-1 text-xs text-white/45">{session.desktop.connected ? "Companion interno ligado" : "Companion interno desligado"}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${session.desktop.connected ? "bg-emerald-400/15 text-emerald-200" : "bg-rose-400/15 text-rose-200"}`}>{session.desktop.connected ? "Ligado" : "Desligado"}</span></div>
      {!session.desktop.connected && <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4"><p className="text-xs leading-relaxed text-white/60">Obtém o código no menu <strong className="text-white/80">AXION OFFICE → Código de associação do Mac</strong>.</p><div className="mt-3 flex gap-2"><input value={pairingCode} onChange={event => setPairingCode(event.target.value)} placeholder="Código de associação" autoComplete="off" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/40"/><button type="button" disabled={!pairingCode.trim() || Boolean(busy)} onClick={() => void pair()} className="rounded-xl bg-cyan-300 px-4 py-2 text-xs font-bold text-[#071018] disabled:opacity-35">Associar</button></div></div>}
      <div className="grid gap-2 sm:grid-cols-2">{states.map(state => <div key={state.label} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/10 p-3"><state.icon size={16} className={state.active ? "text-cyan-300" : "text-white/25"}/><span className="flex-1 text-xs text-white/70">{state.label}</span>{state.active ? <CheckCircle2 size={15} className="text-emerald-300"/> : <XCircle size={15} className="text-white/20"/>}</div>)}</div>
      {session.desktop.connected && <button type="button" disabled={busy === "permissions"} onClick={() => void requestPermissions()} className="rounded-xl border border-white/15 px-4 py-2 text-xs text-white/75 hover:bg-white/5 disabled:opacity-40">Abrir permissões macOS</button>}
      <div className="border-t border-white/[0.07] pt-5"><div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">Aplicações autorizadas</h3><p className="mt-1 text-xs text-white/40">Lista dinâmica das aplicações instaladas neste Mac.</p></div><button type="button" aria-label="Atualizar aplicações" disabled={Boolean(busy)} onClick={() => void loadApplications()} className="rounded-xl border border-white/10 p-2 text-white/50 hover:text-white"><RefreshCw size={14} className={busy === "refresh" ? "animate-spin" : ""}/></button></div>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Procurar aplicação…" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"/>
        <div className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">{!session.desktop.connected ? <p className="py-5 text-center text-xs text-white/35">Liga o Desktop Companion para gerir aplicações.</p> : filtered.map(app => <div key={app.bundleId} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.035]"><AppWindow size={16} className="text-white/35"/><span className="min-w-0 flex-1"><span className="block truncate text-xs text-white/80">{app.name}</span><span className="block truncate text-[10px] text-white/30">{app.bundleId}</span></span><button type="button" role="switch" aria-checked={app.authorized} disabled={Boolean(busy)} onClick={() => void setAuthorized(app, !app.authorized)} className={`relative h-6 w-11 rounded-full transition ${app.authorized ? "bg-cyan-300" : "bg-white/10"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[#071018] transition ${app.authorized ? "left-6" : "left-1"}`}/></button></div>)}</div>
      </div>
    </>}
    {notice && <p role="status" className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-3 py-2 text-xs text-amber-100/80">{notice}</p>}
  </section>;
}
