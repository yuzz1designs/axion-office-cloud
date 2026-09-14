import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Bell, CalendarClock, CheckCheck, CreditCard, ListTodo, Users } from "lucide-react";
import type { AccentColorOption } from "../../types/settings";
import type { AxionNotification, NotificationCategory, NotificationTarget } from "./notificationCore";

interface NotificationsScreenProps {
  notifications: AxionNotification[];
  accentColor: AccentColorOption;
  isLight?: boolean;
  timezone?: string;
  onBack: () => void;
  onOpen: (target: NotificationTarget, id: string) => void;
  onMarkAllRead: () => Promise<void>;
}

const categoryDetails: Record<NotificationCategory, { label: string; icon: typeof Bell }> = {
  team: { label: "Equipa", icon: Users }, task: { label: "Tarefas", icon: ListTodo },
  meeting: { label: "Reuniões", icon: CalendarClock }, finance: { label: "Financeiro", icon: CreditCard },
};

export default function NotificationsScreen({ notifications, accentColor, isLight = false, timezone = "Europe/Lisbon", onBack, onOpen, onMarkAllRead }: NotificationsScreenProps) {
  const [filter, setFilter] = useState<"all" | "unread" | NotificationCategory>("all");
  const [saving, setSaving] = useState(false);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const visible = useMemo(() => notifications.filter((item) => filter === "all" || (filter === "unread" ? !item.read : item.category === filter)), [filter, notifications]);
  const panel = isLight ? "border-slate-200 bg-white/80" : "border-white/10 bg-white/[0.025]";
  const muted = isLight ? "text-slate-500" : "text-white/40";
  const formatDate = (value: string) => new Date(value).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone });

  const markAll = async () => {
    if (!unreadCount || saving) return;
    setSaving(true);
    try { await onMarkAllRead(); } finally { setSaving(false); }
  };

  return <div className={`min-h-full px-2 py-3 md:px-5 md:py-5 ${isLight ? "text-slate-950" : "text-white"}`}>
    <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <button onClick={onBack} className={`mb-5 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] transition-colors hover:text-current ${muted}`}><ArrowLeft size={13} /> Painel principal</button>
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl border" style={{ borderColor: `${accentColor.hex}35`, background: `${accentColor.hex}12`, color: accentColor.hex }}><Bell size={18} /></div><div><p className={`font-mono text-[9px] uppercase tracking-[0.25em] ${muted}`}>Central de atualizações</p><h1 className="text-2xl font-semibold tracking-tight">Notificações</h1></div></div>
      </div>
      <button disabled={!unreadCount || saving} onClick={markAll} className={`flex items-center gap-2 self-start rounded-xl border px-4 py-2.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${panel}`}><CheckCheck size={14} style={{ color: accentColor.hex }} /> Marcar todas como lidas</button>
    </header>

    <div className="mb-5 flex flex-wrap gap-2">
      {(["all", "unread", "team", "task", "meeting", "finance"] as const).map((value) => {
        const label = value === "all" ? "Todas" : value === "unread" ? `Não lidas (${unreadCount})` : categoryDetails[value].label;
        return <button key={value} onClick={() => setFilter(value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-all ${filter === value ? "text-black" : panel}`} style={filter === value ? { background: accentColor.hex, borderColor: accentColor.hex } : undefined}>{label}</button>;
      })}
    </div>

    <section className={`overflow-hidden rounded-2xl border backdrop-blur-xl ${panel}`}>
      {visible.length ? <div className="divide-y divide-white/[0.06]">{visible.map((item, index) => {
        const detail = categoryDetails[item.category]; const Icon = detail.icon;
        return <motion.button key={item.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.25) }} onClick={() => onOpen(item.target, item.id)} className={`group relative flex w-full items-start gap-4 px-4 py-4 text-left transition-colors md:px-5 ${isLight ? "hover:bg-slate-50" : "hover:bg-white/[0.035]"}`}>
          {!item.read && <span className="absolute left-0 top-0 h-full w-0.5" style={{ background: accentColor.hex, boxShadow: `0 0 10px ${accentColor.hex}` }} />}
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]" style={{ color: item.urgent ? "#fb7185" : accentColor.hex }}><Icon size={15} /></div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={`text-[9px] font-mono uppercase tracking-[0.16em] ${muted}`}>{detail.label}</span>{item.urgent && <span className="rounded-full bg-rose-400/10 px-2 py-0.5 text-[8px] font-mono uppercase text-rose-300">Prioritário</span>}<span className={`ml-auto text-[9px] font-mono ${muted}`}>{formatDate(item.occurredAt)}</span></div><h3 className={`mt-1 text-sm ${item.read ? "font-medium opacity-70" : "font-semibold"}`}>{item.title}</h3><p className={`mt-1 truncate text-xs ${muted}`}>{item.description}</p></div>
          {!item.read && <span className="mt-4 h-2 w-2 shrink-0 rounded-full" style={{ background: accentColor.hex, boxShadow: `0 0 8px ${accentColor.hex}` }} />}
        </motion.button>;
      })}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center"><Bell size={26} className={muted} /><h3 className="mt-4 text-sm font-semibold">Tudo em ordem</h3><p className={`mt-1 max-w-sm text-xs ${muted}`}>{filter === "unread" ? "Não tens notificações por ler." : "Ainda não existem notificações nesta categoria."}</p></div>}
    </section>
  </div>;
}
