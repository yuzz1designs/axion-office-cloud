import { useEffect, useState } from "react";
import { useAivaSession } from "./AivaSessionProvider";

export default function AivaDevicePanel() {
  const session = useAivaSession();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const screenAuthorized = session.desktop.capabilities.includes("computer_screenshot");
  const controlAuthorized = session.desktop.capabilities.includes("computer_click");
  const fullyAuthorized = screenAuthorized && controlAuthorized;
  useEffect(() => {
    if (fullyAuthorized) setNotice("");
  }, [fullyAuthorized]);
  async function permissions() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/aiva/desktop/permissions", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await new Promise(resolve => window.setTimeout(resolve, 500));
      await session.refreshDesktop();
      setNotice("Confirma AXIONControl em Acessibilidade e Gravação do ecrã. O estado será atualizado automaticamente.");
    }
    catch (error) { setNotice(error instanceof Error ? error.message : "Não foi possível abrir as permissões."); }
    finally { setBusy(false); }
  }
  async function act() {
    setBusy(true); setNotice("");
    try { if (session.desktop.connected) await session.revokeDesktop(); else { await session.pairDesktop(code.trim()); setCode(""); } }
    catch (error) { setNotice(error instanceof TypeError ? "Sem ligação ao servidor AXION. Inicia npm run dev e atualiza a página. O Companion deve continuar ligado noutro terminal." : error instanceof Error ? error.message : "Ligação indisponível."); }
    finally { setBusy(false); }
  }
  return <div className="aiva-device">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="aiva-device__toggle"><span className={session.desktop.connected ? "is-connected" : ""} />macOS · {session.desktop.connected ? "ligado" : "desligado"}</button>
    {open && <div className="aiva-device__panel">
      <p className="text-sm font-light text-white/85">{session.desktop.connected ? session.desktop.deviceName : "Ligar este Mac"}</p>
      <p className="mt-2 text-xs leading-relaxed text-white/50">{session.desktop.connected ? "Capacidades do sistema disponíveis no Mark II. A ligação pode ser revogada a qualquer momento." : "Inicia o AXION Desktop Companion neste Mac e introduz o código apresentado."}</p>
      {!session.desktop.connected && <><code className="my-3 block rounded-lg bg-black/30 p-2 text-xs text-white/60">npm run companion</code><input aria-label="Código de associação do Mac" value={code} onChange={event => setCode(event.target.value)} placeholder="Código de associação" autoComplete="off" className="w-full rounded-lg border border-white/15 bg-black/20 p-2 text-xs outline-none focus:border-white/40" /></>}
      {session.desktop.connected && <><p className="mt-3 text-xs text-white/50">{session.desktop.capabilities.length} capacidades · {screenAuthorized ? "Ecrã autorizado" : "Ecrã sem permissão"} · {controlAuthorized ? "Controlo autorizado" : "Acessibilidade sem permissão"}</p>{fullyAuthorized ? <p className="mt-3 text-xs text-emerald-200/80">Acesso ao Mac ativo.</p> : <button type="button" disabled={busy} onClick={() => void permissions()} className="mt-3 rounded-full border border-white/20 px-4 py-2 text-xs">Ativar controlo do computador</button>}</>}
      <button type="button" disabled={busy || (!session.desktop.connected && !code.trim())} onClick={() => void act()} className="mt-3 rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 disabled:opacity-30">{busy ? "A processar…" : session.desktop.connected ? "Revogar ligação" : "Associar Mac"}</button>
      {notice && <p role="alert" className="mt-2 text-xs text-amber-200/80">{notice}</p>}
    </div>}
  </div>;
}
