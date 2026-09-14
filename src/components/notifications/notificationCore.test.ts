import assert from "node:assert/strict";
import test from "node:test";
import { buildNotifications } from "./notificationCore";

test("reúne alertas reais e aplica o estado de leitura individual", () => {
  const notifications = buildNotifications({
    now: new Date("2026-09-04T10:00:00Z"),
    activities: [{ id: "audit-1", actorUserId: "other", actorName: "Sousa", action: "Atualizou Cliente X", createdAt: "2026-09-04T09:00:00Z" }],
    tasks: [{ id: "task-1", title: "Enviar proposta", dueDate: "2026-09-04", dueTime: "14:00", completed: false }],
    events: [{ id: "event-1", title: "Reunião semanal", date: "2026-09-05", startTime: "11:00", status: "scheduled" }],
    payments: [{ id: "payment-1", name: "Cloud", provider: "Host", amount: 49, currency: "EUR", nextChargeDate: "2026-09-03", status: "active" }],
    revenues: [{ id: "revenue-1", payerName: "Cliente", description: "Website", amount: 500, currency: "EUR", dueDate: "2026-09-06", status: "pending" }],
    readKeys: new Set(["team:audit-1"]),
  });

  assert.deepEqual(notifications.map(({ id, category, read }) => ({ id, category, read })), [
    { id: "finance:payment-1:2026-09-03", category: "finance", read: false },
    { id: "task:task-1:2026-09-04", category: "task", read: false },
    { id: "meeting:event-1:2026-09-05", category: "meeting", read: false },
    { id: "revenue:revenue-1:2026-09-06", category: "finance", read: false },
    { id: "team:audit-1", category: "team", read: true },
  ]);
});

test("ignora itens concluídos, cancelados ou fora dos próximos sete dias", () => {
  const notifications = buildNotifications({
    now: new Date("2026-09-04T10:00:00Z"), activities: [], readKeys: new Set(),
    tasks: [
      { id: "done", title: "Feita", dueDate: "2026-09-04", completed: true },
      { id: "later", title: "Mais tarde", dueDate: "2026-09-20", completed: false },
    ],
    events: [{ id: "cancelled", title: "Cancelada", date: "2026-09-05", startTime: "11:00", status: "cancelled" }],
    payments: [{ id: "paused", name: "Pausa", provider: "X", amount: 5, currency: "EUR", nextChargeDate: "2026-09-05", status: "paused" }],
  });
  assert.equal(notifications.length, 0);
});

test("respeita o fuso horário do perfil ao determinar o dia atual", () => {
  const [notification] = buildNotifications({
    now: new Date("2026-09-03T23:30:00Z"), timezone: "Europe/Lisbon",
    activities: [], events: [], payments: [], readKeys: new Set(),
    tasks: [{ id: "today", title: "Tarefa local", dueDate: "2026-09-04", completed: false }],
  });
  assert.equal(notification.title, "Tarefa para hoje");
});
