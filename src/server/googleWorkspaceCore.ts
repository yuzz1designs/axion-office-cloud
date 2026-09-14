import { randomBytes } from "node:crypto";

export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
export const GOOGLE_WORKSPACE_SCOPES = ["openid", "email", GOOGLE_CALENDAR_SCOPE, GOOGLE_TASKS_SCOPE] as const;

export interface FocusState {
  totalMinutes: number;
  completedTaskMinutes: Record<string, number>;
}

export interface WorkspaceCalendarEvent {
  id: string;
  title: string;
  clientName?: string;
  clientRef?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  locationType: "google_meet" | "zoom" | "in_person" | "discord_stage";
  locationUrl?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  category: "client_sync" | "architecture" | "financial" | "creative" | "internal";
  description: string;
  attendees: Array<{ name: string; email: string; role: string; status: "accepted" | "tentative" | "declined" }>;
  tasksCount: number;
  completedTasksCount: number;
  hasDiscordAta: boolean;
  gcalSynced: boolean;
  gcalEventId: string;
  updatedAt: string;
}

export interface WorkspaceTask {
  id: string;
  title: string;
  notes: string;
  dueDate: string;
  dueTime?: string;
  completed: boolean;
  priority: "high" | "medium" | "low";
  estimatedMinutes: number;
  estimatedTime: string;
  assignee: { name: string };
  syncedWithGCal: boolean;
  fromDiscordAta: boolean;
  googleTaskId: string;
  updatedAt: string;
}

export class WorkspaceOAuthStateStore {
  private readonly states = new Map<string, { profileId: string; expiresAt: number }>();
  constructor(private readonly now: () => number = Date.now, private readonly ttlMs = 300_000) {}
  create(profileId: string) {
    const state = randomBytes(32).toString("base64url");
    this.states.set(state, { profileId, expiresAt: this.now() + this.ttlMs });
    return state;
  }
  consume(state: string): string | null {
    const entry = this.states.get(state);
    this.states.delete(state);
    return entry && entry.expiresAt >= this.now() ? entry.profileId : null;
  }
}

export function buildWorkspaceAuthorizationUrl(input: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_WORKSPACE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: input.state,
  }).toString();
  return url.toString();
}

function dateAndTime(value?: { date?: string; dateTime?: string }) {
  if (value?.dateTime) return { date: value.dateTime.slice(0, 10), time: value.dateTime.slice(11, 16) };
  return { date: value?.date || "", time: "00:00" };
}

export function fromGoogleEvent(event: Record<string, any>): WorkspaceCalendarEvent {
  const start = dateAndTime(event.start);
  const end = dateAndTime(event.end);
  const durationMinutes = event.start?.dateTime && event.end?.dateTime
    ? Math.max(0, Math.round((new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60_000))
    : 24 * 60;
  const location = String(event.location || "");
  const locationType = /discord/i.test(location) ? "discord_stage" as const
    : /zoom/i.test(location) ? "zoom" as const
    : event.hangoutLink ? "google_meet" as const
    : "in_person" as const;
  return {
    id: `gcal:${event.id}`,
    title: event.summary || "Evento sem título",
    clientName: event.extendedProperties?.private?.axionClientName,
    clientRef: event.extendedProperties?.private?.axionClientRef,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    durationMinutes,
    locationType,
    ...(location || event.hangoutLink ? { locationUrl: location || event.hangoutLink } : {}),
    status: event.status === "cancelled" ? "cancelled" : "scheduled",
    category: event.extendedProperties?.private?.axionCategory || "internal",
    description: event.description || "",
    attendees: (event.attendees || []).map((attendee: Record<string, string>) => ({
      name: attendee.displayName || attendee.email || "Convidado",
      email: attendee.email || "",
      role: "Convidado",
      status: attendee.responseStatus === "declined" ? "declined" : attendee.responseStatus === "accepted" ? "accepted" : "tentative",
    })),
    tasksCount: 0,
    completedTasksCount: 0,
    hasDiscordAta: false,
    gcalSynced: true,
    gcalEventId: event.id,
    updatedAt: event.updated || new Date(0).toISOString(),
  };
}

export function fromGoogleTask(task: Record<string, any>): WorkspaceTask {
  const rawNotes = String(task.notes || "");
  const metadata = rawNotes.match(/^\[AXION:(\d+)m(?:;time=(\d{2}:\d{2}))?(?:;priority=(high|medium|low))?\]\n?/);
  const estimatedMinutes = metadata ? Math.max(1, Number(metadata[1])) : 30;
  return {
    id: `gtask:${task.id}`,
    title: task.title || "Tarefa sem título",
    notes: metadata ? rawNotes.slice(metadata[0].length) : rawNotes,
    dueDate: task.due ? String(task.due).slice(0, 10) : "",
    ...(metadata?.[2] ? { dueTime: metadata[2] } : {}),
    completed: task.status === "completed",
    priority: (metadata?.[3] as WorkspaceTask["priority"] | undefined) || "medium",
    estimatedMinutes,
    estimatedTime: `${estimatedMinutes}m`,
    assignee: { name: "Google Tasks" },
    syncedWithGCal: true,
    fromDiscordAta: false,
    googleTaskId: task.id,
    updatedAt: task.updated || new Date(0).toISOString(),
  };
}

export function applyTaskFocusTransition(state: FocusState, task: { taskId: string; completed: boolean; estimatedMinutes?: number }): FocusState {
  const recorded = state.completedTaskMinutes[task.taskId];
  if (task.completed && recorded === undefined) {
    const minutes = Math.max(0, task.estimatedMinutes || 30);
    return { totalMinutes: state.totalMinutes + minutes, completedTaskMinutes: { ...state.completedTaskMinutes, [task.taskId]: minutes } };
  }
  if (!task.completed && recorded !== undefined) {
    const completedTaskMinutes = { ...state.completedTaskMinutes };
    delete completedTaskMinutes[task.taskId];
    return { totalMinutes: Math.max(0, state.totalMinutes - recorded), completedTaskMinutes };
  }
  return state;
}

export function applySyncedTaskFocus(state: FocusState, tasks: WorkspaceTask[]): FocusState {
  return tasks.reduce((focus, task) => applyTaskFocusTransition(focus, {
    taskId: task.id,
    completed: task.completed,
    estimatedMinutes: task.estimatedMinutes,
  }), state);
}

export function mergeCalendarChanges(
  existing: WorkspaceCalendarEvent[],
  changes: Array<Record<string, any>>,
  incremental: boolean,
): WorkspaceCalendarEvent[] {
  const events = new Map(incremental ? existing.map((event) => [event.gcalEventId, event]) : []);
  for (const change of changes) {
    if (!change.id) continue;
    if (change.status === "cancelled") {
      events.delete(change.id);
      continue;
    }
    if (change.start?.date || change.start?.dateTime) events.set(change.id, fromGoogleEvent(change));
  }
  return [...events.values()];
}

export function toGoogleEvent(event: Record<string, any>): Record<string, any> {
  if (event.locationType !== "discord_stage") throw new Error("AXION_EVENT_REQUIRES_DISCORD_LOCATION");
  return {
    summary: String(event.title || "Evento AXION"),
    description: String(event.description || ""),
    location: String(event.locationUrl || ""),
    start: { dateTime: `${event.date}T${event.startTime || "00:00"}:00`, timeZone: event.timezone || "Europe/Lisbon" },
    end: { dateTime: `${event.date}T${event.endTime || event.startTime || "00:00"}:00`, timeZone: event.timezone || "Europe/Lisbon" },
    attendees: (event.attendees || []).filter((item: Record<string, any>) => item.email).map((item: Record<string, any>) => ({ email: item.email })),
    extendedProperties: {
      private: {
        ...(event.clientName ? { axionClientName: String(event.clientName) } : {}),
        ...(event.clientRef ? { axionClientRef: String(event.clientRef) } : {}),
        ...(event.category ? { axionCategory: String(event.category) } : {}),
      },
    },
  };
}

export function toGoogleTask(task: Record<string, any>): Record<string, any> {
  const estimatedMinutes = Math.max(1, Number(task.estimatedMinutes) || Number.parseInt(String(task.estimatedTime || ""), 10) || 30);
  const notes = String(task.notes || "");
  const dueTime = /^\d{2}:\d{2}$/.test(String(task.dueTime || "")) ? `;time=${task.dueTime}` : "";
  const priority = ["high", "medium", "low"].includes(task.priority) ? `;priority=${task.priority}` : "";
  return {
    title: String(task.title || "Tarefa AXION"),
    notes: `[AXION:${estimatedMinutes}m${dueTime}${priority}]${notes ? `\n${notes}` : ""}`,
    status: task.completed ? "completed" : "needsAction",
    ...(task.completed ? { completed: new Date().toISOString() } : {}),
    ...(task.dueDate ? { due: `${task.dueDate}T00:00:00.000Z` } : {}),
  };
}
