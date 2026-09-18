import { useEffect, useState } from "react";
import { isOfficeMemberOnline, officeSessionTime, type OfficePresenceSnapshot } from "../../lib/officePresence";

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

export default function OfficePresence({ presence, currentUserId, now }: {
  presence: ReturnType<typeof useOfficePresence>; currentUserId?: string; now: number;
}) {
  const serverNow = now + presence.clockOffset;
  const members = [...(presence.snapshot?.members || [])].sort((a, b) =>
    Number(isOfficeMemberOnline(b, serverNow)) - Number(isOfficeMemberOnline(a, serverNow)) || a.name.localeCompare(b.name));
  return (
    <section aria-label="Equipa no Office" className="w-full rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-white/60">Equipa no Office</h2>
        <span className="text-[10px] text-white/40">Sessão atual · Offline após 2 min sem ligação</span>
      </div>
      {presence.error ? <p role="status" className="text-xs text-amber-300">Não foi possível atualizar a presença. A tentar novamente…</p>
        : !presence.snapshot ? <p role="status" className="text-xs text-white/40">A verificar presença…</p>
        : <ul className="flex flex-wrap gap-3">
          {members.map((member) => {
            const online = isOfficeMemberOnline(member, serverNow);
            return <li key={member.userId} className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/15 px-3 py-2">
              <span aria-hidden="true" className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-white/20"}`} />
              <div className="min-w-0">
                <div className="text-xs text-white/85">{member.name}{member.userId === currentUserId ? " (tu)" : ""}</div>
                <div className="text-[10px] text-white/45">{online ? "Online" : "Offline"}</div>
              </div>
              {online && <span className="text-xs font-mono tabular-nums text-white/70" aria-label={`Tempo de sessão de ${member.name}`}>{officeSessionTime(member, serverNow)}</span>}
            </li>;
          })}
        </ul>}
    </section>
  );
}
