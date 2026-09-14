import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkspaceOAuthStateStore,
  buildWorkspaceAuthorizationUrl,
  GOOGLE_WORKSPACE_SCOPES,
  applyTaskFocusTransition,
  applySyncedTaskFocus,
  fromGoogleEvent,
  fromGoogleTask,
  mergeCalendarChanges,
  toGoogleEvent,
  toGoogleTask,
} from "./googleWorkspaceCore";

test("OAuth Calendar e Tasks fica associado ao perfil e o state só pode ser usado uma vez", () => {
  const states = new WorkspaceOAuthStateStore(() => 1_000);
  const state = states.create("profile-nelson");
  assert.equal(states.consume(state), "profile-nelson");
  assert.equal(states.consume(state), null);

  const url = new URL(buildWorkspaceAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "http://localhost:3000/api/google/workspace/oauth/callback",
    state,
  }));
  assert.equal(url.searchParams.get("scope"), GOOGLE_WORKSPACE_SCOPES.join(" "));
  assert.equal(url.searchParams.get("access_type"), "offline");
});

test("converte evento Google para evento AXION sem inventar Google Meet", () => {
  const event = fromGoogleEvent({
    id: "google-event-1",
    summary: "Reunião de direção",
    description: "Planeamento",
    location: "Discord · Sala Direção",
    status: "confirmed",
    updated: "2026-09-03T09:00:00.000Z",
    start: { dateTime: "2026-09-10T14:00:00+01:00" },
    end: { dateTime: "2026-09-10T15:30:00+01:00" },
    attendees: [{ email: "sousa@example.com", displayName: "Sousa", responseStatus: "accepted" }],
  });

  assert.equal(event.id, "gcal:google-event-1");
  assert.equal(event.date, "2026-09-10");
  assert.equal(event.startTime, "14:00");
  assert.equal(event.endTime, "15:30");
  assert.equal(event.durationMinutes, 90);
  assert.equal(event.locationType, "discord_stage");
  assert.equal(event.locationUrl, "Discord · Sala Direção");
});

test("tarefas Google sem duração recebem 30 minutos", () => {
  const task = fromGoogleTask({
    id: "google-task-1",
    title: "Preparar proposta",
    notes: "Cliente XPTO",
    status: "needsAction",
    due: "2026-09-12T00:00:00.000Z",
    updated: "2026-09-03T10:00:00.000Z",
  });
  assert.equal(task.id, "gtask:google-task-1");
  assert.equal(task.dueDate, "2026-09-12");
  assert.equal(task.estimatedMinutes, 30);
  assert.equal(task.completed, false);
});

test("horas de foco são idempotentes e reversíveis", () => {
  let focus = { totalMinutes: 0, completedTaskMinutes: {} as Record<string, number> };
  focus = applyTaskFocusTransition(focus, { taskId: "task-1", completed: true, estimatedMinutes: 45 });
  focus = applyTaskFocusTransition(focus, { taskId: "task-1", completed: true, estimatedMinutes: 45 });
  assert.equal(focus.totalMinutes, 45);
  focus = applyTaskFocusTransition(focus, { taskId: "task-1", completed: false, estimatedMinutes: 45 });
  assert.equal(focus.totalMinutes, 0);
});

test("uma tarefa já concluída na primeira sincronização credita foco uma única vez", () => {
  const tasks = [fromGoogleTask({ id: "done-1", title: "Feita", status: "completed" })];
  const initial = { totalMinutes: 0, completedTaskMinutes: {} as Record<string, number> };
  const credited = applySyncedTaskFocus(initial, tasks);
  assert.equal(credited.totalMinutes, 30);
  assert.deepEqual(applySyncedTaskFocus(credited, tasks), credited);
});

test("cancelamento incremental remove o evento do cache mesmo sem data", () => {
  const existing = [fromGoogleEvent({
    id: "event-1",
    summary: "Reunião",
    start: { dateTime: "2026-09-10T14:00:00+01:00" },
    end: { dateTime: "2026-09-10T15:00:00+01:00" },
  })];
  assert.deepEqual(mergeCalendarChanges(existing, [{ id: "event-1", status: "cancelled" }], true), []);
});

test("envia reuniões para Calendar sem conferência Google Meet", () => {
  const payload = toGoogleEvent({
    title: "Reunião AXION",
    description: "Direção",
    date: "2026-09-10",
    startTime: "14:00",
    endTime: "15:00",
    locationType: "discord_stage",
    locationUrl: "Discord · Sala Direção",
    attendees: [{ email: "sousa@example.com" }],
  });
  assert.equal(payload.summary, "Reunião AXION");
  assert.equal(payload.location, "Discord · Sala Direção");
  assert.equal("conferenceData" in payload, false);
  assert.deepEqual(payload.start, { dateTime: "2026-09-10T14:00:00", timeZone: "Europe/Lisbon" });
});

test("rejeita a criação de reuniões AXION fora do Discord", () => {
  assert.throws(() => toGoogleEvent({
    title: "Reunião",
    date: "2026-09-10",
    startTime: "14:00",
    endTime: "15:00",
    locationType: "google_meet",
    locationUrl: "https://meet.google.com/exemplo",
  }), /AXION_EVENT_REQUIRES_DISCORD_LOCATION/);
});

test("preserva duração, hora e prioridade dentro das notas Google Tasks", () => {
  const payload = toGoogleTask({
    title: "Preparar proposta",
    notes: "Cliente XPTO",
    dueDate: "2026-09-12",
    dueTime: "16:30",
    priority: "high",
    completed: false,
    estimatedMinutes: 45,
  });
  assert.equal(payload.notes, "[AXION:45m;time=16:30;priority=high]\nCliente XPTO");
  const restored = fromGoogleTask({ id: "task-1", title: payload.title, notes: payload.notes, due: payload.due, status: payload.status });
  assert.equal(restored.estimatedMinutes, 45);
  assert.equal(restored.dueTime, "16:30");
  assert.equal(restored.priority, "high");
  assert.equal(restored.notes, "Cliente XPTO");
});
