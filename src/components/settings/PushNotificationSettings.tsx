import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, ExternalLink, LoaderCircle, Send, ShieldAlert, Smartphone } from "lucide-react";
import { getPushDeviceId, isAppleMobile, isStandalonePwa, registerAxionServiceWorker, vapidKeyBytes, webPushSupported } from "../../lib/pushNotifications";
import { getPushDeviceState, requiresAppleHomeScreen } from "./pushNotificationState";

interface PushStatus { configured: boolean; subscribed: boolean; publicKey: string | null }

export default function PushNotificationSettings({ accent }: { accent: string }) {
  const supported = webPushSupported();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [browserSubscribed, setBrowserSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(() => supported ? Notification.permission : "default");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const appleMobile = supported && isAppleMobile();
  const standalone = supported && isStandalonePwa();

  const refresh = useCallback(async () => {
    if (!supported) return;
    try {
      const deviceId = getPushDeviceId();
      const [registration, response] = await Promise.all([registerAxionServiceWorker(), fetch(`/api/push/status?deviceId=${encodeURIComponent(deviceId)}`)]);
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Não foi possível verificar as notificações.");
      setStatus(value);
      setBrowserSubscribed(Boolean(await registration.pushManager.getSubscription()));
      setPermission(Notification.permission);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível verificar as notificações."); }
  }, [supported]);

  useEffect(() => { void refresh(); }, [refresh]);

  const activate = async () => {
    if (!supported || busy) return;
    if (appleMobile && !standalone) { setMessage("No iPhone ou iPad, instala primeiro o AXION Office no ecrã principal e abre-o pelo ícone."); return; }
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/push/status?deviceId=${encodeURIComponent(getPushDeviceId())}`);
      const current = await response.json() as PushStatus & { error?: string };
      if (!response.ok) throw new Error(current.error || "Não foi possível verificar as notificações.");
      if (!current.configured || !current.publicKey) throw new Error("As notificações ainda não estão configuradas no servidor.");
      const choice = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(choice);
      if (choice !== "granted") throw new Error(choice === "denied" ? "A permissão está bloqueada nas definições do browser." : "A permissão não foi concedida.");
      const registration = await registerAxionServiceWorker();
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(current.publicKey) });
      const save = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getPushDeviceId(), subscription: subscription.toJSON() }) });
      const value = await save.json().catch(() => ({}));
      if (!save.ok) { if (!existing) await subscription.unsubscribe(); throw new Error(value.error || "Não foi possível associar este dispositivo."); }
      setMessage("Notificações ativas neste dispositivo.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível ativar as notificações."); }
    finally { setBusy(false); }
  };

  const deactivate = async () => {
    if (!supported || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getPushDeviceId() }) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível desativar este dispositivo.");
      const registration = await registerAxionServiceWorker();
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      setMessage("Notificações desativadas neste dispositivo.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível desativar as notificações."); }
    finally { setBusy(false); }
  };

  const test = async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/push/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: getPushDeviceId() }) });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error || "Não foi possível enviar o teste.");
      setMessage(value.duplicate ? "Já foi enviado um teste neste minuto." : "Notificação de teste enviada.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível enviar o teste."); }
    finally { setBusy(false); }
  };

  const deviceState = getPushDeviceState({ supported, permission, browserSubscribed, serverSubscribed: Boolean(status?.subscribed) });
  const active = deviceState === "active";
  return <section className="rounded-3xl border border-white/[0.08] bg-[#0d121c]/75 p-5 shadow-xl backdrop-blur-xl sm:p-6">
    <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border" style={{ color: accent, borderColor: `${accent}35`, background: `${accent}12` }}>{active ? <Bell size={19} /> : <BellOff size={19} />}</span><div><h2 className="text-base font-semibold text-white">Notificações neste dispositivo</h2><p className="mt-1 text-xs leading-5 text-white/40">Recebe novos updates mesmo com o AXION Office fechado.</p></div></div>
    <div className="mt-5 rounded-2xl border border-white/[.07] bg-black/15 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs">{active ? <CheckCircle2 size={15} className="text-emerald-300" /> : deviceState === "blocked" ? <ShieldAlert size={15} className="text-amber-300" /> : <Smartphone size={15} className="text-white/40" />}<span className="text-white/70">{deviceState === "unsupported" ? "Não suportadas neste browser" : deviceState === "blocked" ? "Permissão bloqueada" : active ? "Ativas e associadas" : deviceState === "incomplete" ? "Associação incompleta" : "Desativadas"}</span></div><button type="button" disabled={!supported || busy || (!active && requiresAppleHomeScreen(appleMobile, standalone))} onClick={() => void (active ? deactivate() : activate())} className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-40" style={{ background: accent }}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : active ? "Desativar" : "Ativar notificações"}</button></div>{permission === "denied" && <p className="mt-3 text-[10px] leading-5 text-amber-200/70">Abre as definições do browser ou do sistema, permite notificações para este site e volta a tentar.</p>}{status && !status.configured && <p className="mt-3 text-[10px] leading-5 text-amber-200/70">O servidor ainda precisa das chaves VAPID.</p>}</div>
    <div className="mt-5"><h3 className="text-[10px] font-semibold uppercase tracking-wider text-white/50">Como ativar</h3>{appleMobile ? <ol className="mt-3 space-y-2 text-xs leading-5 text-white/40"><li>1. Abre o Office no Safari.</li><li>2. Toca em Partilhar e escolhe “Adicionar ao ecrã principal”.</li><li>3. Abre o Office pelo novo ícone.</li><li>4. Regressa aqui e toca em “Ativar notificações”.</li></ol> : <ol className="mt-3 space-y-2 text-xs leading-5 text-white/40"><li>1. Clica em “Ativar notificações”.</li><li>2. Aceita a permissão apresentada pelo browser.</li><li>3. Confirma que o estado muda para “Ativas e associadas”.</li></ol>}</div>
    <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={!active || busy} onClick={() => void test()} className="flex items-center gap-2 rounded-xl border border-white/[.09] px-3.5 py-2.5 text-xs text-white/65 transition hover:bg-white/[.05] disabled:opacity-35"><Send size={13} />Enviar notificação de teste</button>{appleMobile && !standalone && <span className="flex items-center gap-1.5 text-[10px] text-white/30"><ExternalLink size={11} />Instalação no ecrã principal necessária</span>}</div>
    {message && <p role="status" className="mt-4 rounded-xl border border-white/[.07] bg-white/[.025] px-3 py-2.5 text-[10px] leading-5 text-white/55">{message}</p>}
  </section>;
}
