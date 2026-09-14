import type { TeamActivityItem } from "../../server/teamActivityStore";

export type NotificationCategory = "team" | "task" | "meeting" | "finance";
export type NotificationTarget = "overview" | "calendar" | "payments";

export interface AxionNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  occurredAt: string;
  target: NotificationTarget;
  read: boolean;
  urgent: boolean;
}

interface NotificationTask { id: string; title: string; dueDate: string; dueTime?: string; completed: boolean }
interface NotificationEvent { id: string; title: string; date: string; startTime: string; status: string }
interface NotificationPayment { id: string; name: string; provider: string; amount: number; currency: string; nextChargeDate: string; status: string }
interface NotificationRevenue { id: string; payerName: string; description: string; amount: number; currency: string; dueDate: string; status: string }

interface BuildNotificationInput {
  now: Date;
  timezone?: string;
  activities: TeamActivityItem[];
  tasks: NotificationTask[];
  events: NotificationEvent[];
  payments: NotificationPayment[];
  revenues?: NotificationRevenue[];
  readKeys: Set<string>;
}

const dayNumber = (value: string) => Date.parse(`${value}T12:00:00Z`) / 86_400_000;

export function buildNotifications(input: BuildNotificationInput): AxionNotification[] {
  const timezone = input.timezone || "Europe/Lisbon";
  const dateParts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: timezone }).formatToParts(input.now);
  const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((item) => item.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const timeParts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: timezone }).formatToParts(input.now);
  const timePart = (type: "hour" | "minute") => timeParts.find((item) => item.type === type)?.value || "00";
  const localTime = `${timePart("hour")}:${timePart("minute")}`;
  const todayNumber = dayNumber(today);
  const isNear = (date: string) => dayNumber(date) - todayNumber <= 7;
  const items: Array<AxionNotification & { order: number }> = [];

  for (const payment of input.payments) {
    if (payment.status !== "active" || !isNear(payment.nextChargeDate)) continue;
    const overdue = payment.nextChargeDate < today;
    const id = `finance:${payment.id}:${payment.nextChargeDate}`;
    items.push({ id, category: "finance", title: overdue ? "Pagamento em atraso" : "Pagamento próximo", description: `${payment.name} · ${new Intl.NumberFormat("pt-PT", { style: "currency", currency: payment.currency }).format(payment.amount)}`, occurredAt: `${payment.nextChargeDate}T12:00:00Z`, target: "payments", read: input.readKeys.has(id), urgent: overdue, order: overdue ? 0 : 3 });
  }
  for (const task of input.tasks) {
    if (task.completed || !isNear(task.dueDate)) continue;
    const overdue = task.dueDate < today;
    const id = `task:${task.id}:${task.dueDate}`;
    items.push({ id, category: "task", title: overdue ? "Tarefa em atraso" : task.dueDate === today ? "Tarefa para hoje" : "Tarefa próxima", description: task.title, occurredAt: `${task.dueDate}T${task.dueTime || "23:59"}:00`, target: "calendar", read: input.readKeys.has(id), urgent: overdue || task.dueDate === today, order: overdue ? 0 : 1 });
  }
  for (const event of input.events) {
    const eventMoment = `${event.date}T${event.startTime}:00`;
    if (event.status !== "scheduled" || event.date < today || (event.date === today && event.startTime < localTime) || !isNear(event.date)) continue;
    const id = `meeting:${event.id}:${event.date}`;
    items.push({ id, category: "meeting", title: "Reunião próxima", description: event.title, occurredAt: eventMoment, target: "calendar", read: input.readKeys.has(id), urgent: event.date === today, order: 2 });
  }
  for (const revenue of input.revenues || []) {
    if (revenue.status !== "pending" || !isNear(revenue.dueDate)) continue;
    const overdue = revenue.dueDate < today;
    const id = `revenue:${revenue.id}:${revenue.dueDate}`;
    items.push({ id, category: "finance", title: overdue ? "Vencimento em atraso" : "Vencimento próximo", description: `${revenue.payerName} · ${revenue.description}`, occurredAt: `${revenue.dueDate}T12:00:00Z`, target: "payments", read: input.readKeys.has(id), urgent: overdue, order: overdue ? 0 : 3 });
  }
  for (const activity of input.activities) {
    const id = `team:${activity.id}`;
    items.push({ id, category: "team", title: activity.actorName, description: activity.action, occurredAt: activity.createdAt, target: "overview", read: input.readKeys.has(id), urgent: false, order: 4 });
  }

  return items.sort((a, b) => a.order - b.order || a.occurredAt.localeCompare(b.occurredAt)).map(({ order: _order, ...item }) => item);
}
