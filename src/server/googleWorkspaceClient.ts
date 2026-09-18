const CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TASK_LISTS_URL = "https://tasks.googleapis.com/tasks/v1/users/@me/lists";

type FetchImplementation = typeof fetch;

export class GoogleWorkspaceClient {
  constructor(private readonly accessToken: string, private readonly fetchImpl: FetchImplementation = (input, init) => globalThis.fetch(input, init)) {}

  private async request<T>(url: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json", ...init.headers },
    });
    if (response.status === 410) throw new Error("GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED");
    const result = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
    if (!response.ok) throw new Error(`GOOGLE_WORKSPACE_REQUEST_FAILED:${result.error?.message || response.status}`);
    return result;
  }

  async ensureAxionTaskList() {
    let pageToken = "";
    do {
      const url = new URL(TASK_LISTS_URL);
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await this.request<{ items?: Array<{ id: string; title: string }>; nextPageToken?: string }>(url.toString());
      const existing = result.items?.find((item) => item.title.trim().toUpperCase() === "AXION OFFICE");
      if (existing) return existing.id;
      pageToken = result.nextPageToken || "";
    } while (pageToken);
    const created = await this.request<{ id: string }>(TASK_LISTS_URL, { method: "POST", body: JSON.stringify({ title: "AXION OFFICE" }) });
    return created.id;
  }

  async listCalendarEvents(input: { syncToken?: string; timeMin?: string; timeMax?: string }) {
    const items: Record<string, any>[] = [];
    let pageToken = "";
    let nextSyncToken = "";
    do {
      const url = new URL(CALENDAR_EVENTS_URL);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("showDeleted", "true");
      url.searchParams.set("maxResults", "2500");
      if (input.syncToken) url.searchParams.set("syncToken", input.syncToken);
      else {
        if (input.timeMin) url.searchParams.set("timeMin", input.timeMin);
        if (input.timeMax) url.searchParams.set("timeMax", input.timeMax);
      }
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await this.request<{ items?: Record<string, any>[]; nextPageToken?: string; nextSyncToken?: string }>(url.toString());
      items.push(...(result.items || []));
      pageToken = result.nextPageToken || "";
      nextSyncToken = result.nextSyncToken || nextSyncToken;
    } while (pageToken);
    return { items, nextSyncToken };
  }

  async listTasks(taskListId: string) {
    const items: Record<string, any>[] = [];
    let pageToken = "";
    do {
      const url = new URL(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`);
      url.searchParams.set("showCompleted", "true");
      url.searchParams.set("showHidden", "true");
      url.searchParams.set("showDeleted", "true");
      url.searchParams.set("maxResults", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const result = await this.request<{ items?: Record<string, any>[]; nextPageToken?: string }>(url.toString());
      items.push(...(result.items || []));
      pageToken = result.nextPageToken || "";
    } while (pageToken);
    return items;
  }

  createEvent(event: Record<string, unknown>) {
    return this.request<Record<string, any>>(`${CALENDAR_EVENTS_URL}?sendUpdates=all`, { method: "POST", body: JSON.stringify(event) });
  }

  updateEvent(eventId: string, event: Record<string, unknown>) {
    return this.request<Record<string, any>>(`${CALENDAR_EVENTS_URL}/${encodeURIComponent(eventId)}?sendUpdates=all`, { method: "PATCH", body: JSON.stringify(event) });
  }

  createTask(taskListId: string, task: Record<string, unknown>) {
    return this.request<Record<string, any>>(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`, { method: "POST", body: JSON.stringify(task) });
  }

  updateTask(taskListId: string, taskId: string, task: Record<string, unknown>) {
    return this.request<Record<string, any>>(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", body: JSON.stringify(task) });
  }
}
