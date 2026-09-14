import assert from "node:assert/strict";
import test from "node:test";
import type { CalendarEvent, IntegratedTask } from "../../data/calendarMockData";
import { selectNextMeeting, selectTodayTasks } from "./commandCenterCore";
import { calculateMonthlyRevenue } from "../../server/financeCore";

const task = (id: string, dueDate: string, dueTime?: string): IntegratedTask => ({
  id, title: id, priority: "medium", dueDate, dueTime, completed: false,
  assignee: { name: "Nelson" }, syncedWithGCal: true, fromDiscordAta: false,
});

const meeting = (id: string, date: string, startTime: string, status: CalendarEvent["status"] = "scheduled"): CalendarEvent => ({
  id, title: id, date, startTime, endTime: "19:00", durationMinutes: 60,
  locationType: "discord_stage", status, category: "internal", description: "",
  attendees: [], tasksCount: 0, completedTasksCount: 0, hasDiscordAta: false,
  gcalSynced: true, gcalEventId: id,
});

test("mostra apenas as tarefas de hoje ordenadas por hora", () => {
  const result = selectTodayTasks([
    task("mais-tarde", "2026-09-04", "18:00"),
    task("amanha", "2026-09-05", "09:00"),
    task("primeiro", "2026-09-04", "09:30"),
  ], "2026-09-04");
  assert.deepEqual(result.map((item) => item.id), ["primeiro", "mais-tarde"]);
});

test("escolhe a próxima reunião pendente e ignora reuniões passadas ou canceladas", () => {
  const result = selectNextMeeting([
    meeting("passada", "2026-09-04", "09:00"),
    meeting("cancelada", "2026-09-04", "15:00", "cancelled"),
    meeting("proxima", "2026-09-04", "16:00"),
    meeting("amanha", "2026-09-05", "10:00"),
  ], "2026-09-04", "12:00");
  assert.equal(result?.id, "proxima");
  assert.equal(selectNextMeeting([], "2026-09-04", "12:00"), null);
});

test("soma apenas revenue recebido no mês selecionado", () => {
  assert.equal(calculateMonthlyRevenue([
    { amount: 1200, receivedDate: "2026-09-01", status: "received" },
    { amount: 300, receivedDate: "2026-09-03", status: "pending" },
    { amount: 800, receivedDate: "2026-08-30", status: "received" },
    { amount: 450, receivedDate: "2026-09-04", status: "received" },
  ], "2026-09-04"), 1650);
});
