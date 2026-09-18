import { CloudWorkspaceStore, CloudOAuthStates, integrationEncryptionConfigured } from "./cloudIntegrationStore";
import type { IncomingMessage, ServerResponse } from "node:http";
import { AuthProfileStore } from "./authProfileStore";
import { GoogleOAuthClient, type GoogleOAuthConfig } from "./googleOAuthClient";
import { GoogleWorkspaceClient } from "./googleWorkspaceClient";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_TASKS_SCOPE,
  WorkspaceOAuthStateStore,
  applyTaskFocusTransition,
  applySyncedTaskFocus,
  buildWorkspaceAuthorizationUrl,
  fromGoogleEvent,
  fromGoogleTask,
  mergeCalendarChanges,
  toGoogleEvent,
  toGoogleTask,
  type WorkspaceCalendarEvent,
  type WorkspaceTask,
} from "./googleWorkspaceCore";
import { GoogleWorkspaceStore } from "./googleWorkspaceStore";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { recordTeamActivity } from "./teamActivityStore";

const cloud = process.env.AXION_RUNTIME === "cloudflare";
const states = cloud ? new CloudOAuthStates("google_calendar_tasks") : new WorkspaceOAuthStateStore();
const store = cloud ? new CloudWorkspaceStore() : new GoogleWorkspaceStore();
const profiles = new AuthProfileStore();

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function redirect(res: ServerResponse, location: string) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

function parseCookie(req: IncomingMessage, name: string) {
  return (req.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

async function getProfile(req: IncomingMessage) {
  const backend = getSupabaseBackend();
  if (backend) {
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    return user ? backend.profiles.findById(user.id) : null;
  }
  return profiles.findById(parseCookie(req, "axion_profile"));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function config(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_WORKSPACE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/google/workspace/oauth/callback";
  return clientId && clientSecret && (!cloud || integrationEncryptionConfigured()) ? { clientId, clientSecret, redirectUri } : null;
}

function isGrantComplete(scopes: string[]) {
  return scopes.includes(GOOGLE_CALENDAR_SCOPE) && scopes.includes(GOOGLE_TASKS_SCOPE);
}

export async function getGoogleWorkspaceState(profileId: string) {
  const value = await store.read(profileId);
  return {
    configured: Boolean(config()),
    connected: Boolean(value && isGrantComplete(value.grant.scopes)),
    email: value?.grant.email,
    connectedAt: value?.grant.connectedAt,
    events: value?.events ?? [],
    tasks: value?.tasks ?? [],
    focusMinutes: value?.focus.totalMinutes ?? 0,
    lastCalendarSyncAt: value?.lastCalendarSyncAt,
    lastTasksSyncAt: value?.lastTasksSyncAt,
    calendarError: value?.calendarError,
    tasksError: value?.tasksError,
  };
}

async function updateProfileFocus(profileId: string, focusMinutes: number) {
  const backend = getSupabaseBackend();
  if (backend) {
    const profile = await backend.profiles.findById(profileId);
    if (profile) await backend.profiles.upsert({ ...profile, focusMinutes, updatedAt: new Date().toISOString() });
    return;
  }
  const profile = profiles.findById(profileId);
  if (!profile) return;
  profiles.upsert({ ...profile, focusMinutes, updatedAt: new Date().toISOString() });
}

async function syncWorkspace(profileId: string) {
  let value = await store.read(profileId);
  const oauthConfig = config();
  if (!value || !oauthConfig) throw new Error("GOOGLE_WORKSPACE_NOT_CONNECTED");
  const oauth = new GoogleOAuthClient(oauthConfig);
  const accessToken = await oauth.refreshAccessToken(value.grant.refreshToken);
  const google = new GoogleWorkspaceClient(accessToken);
  const now = new Date();

  try {
    const fullRange = () => ({
      timeMin: new Date(now.getTime() - 90 * 86_400_000).toISOString(),
      timeMax: new Date(now.getTime() + 365 * 86_400_000).toISOString(),
    });
    let result;
    try {
      result = await google.listCalendarEvents(value.calendarSyncToken ? { syncToken: value.calendarSyncToken } : fullRange());
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "GOOGLE_CALENDAR_SYNC_TOKEN_EXPIRED") throw error;
      result = await google.listCalendarEvents(fullRange());
      value = { ...value, calendarSyncToken: undefined };
    }
    const events = mergeCalendarChanges(value.events, result.items, Boolean(value.calendarSyncToken));
    await store.update(profileId, { events, calendarSyncToken: result.nextSyncToken || value.calendarSyncToken, lastCalendarSyncAt: now.toISOString(), calendarError: undefined });
  } catch (error) {
    await store.update(profileId, { calendarError: error instanceof Error ? error.message : "Falha no Calendar" });
  }

  value = (await store.read(profileId))!;
  try {
    const taskListId = value.taskListId || await google.ensureAxionTaskList();
    const rawTasks = await google.listTasks(taskListId);
    const tasks = rawTasks.filter((task) => !task.deleted).map(fromGoogleTask);
    const focus = applySyncedTaskFocus(value.focus, tasks);
    await store.update(profileId, { taskListId, tasks, focus, lastTasksSyncAt: now.toISOString(), tasksError: undefined });
    await updateProfileFocus(profileId, focus.totalMinutes);
  } catch (error) {
    await store.update(profileId, { tasksError: error instanceof Error ? error.message : "Falha no Tasks" });
  }

  return getGoogleWorkspaceState(profileId);
}

async function workspaceClient(profileId: string) {
  const value = await store.read(profileId);
  const oauthConfig = config();
  if (!value || !oauthConfig) throw new Error("GOOGLE_WORKSPACE_NOT_CONNECTED");
  const accessToken = await new GoogleOAuthClient(oauthConfig).refreshAccessToken(value.grant.refreshToken);
  return { value, google: new GoogleWorkspaceClient(accessToken) };
}

export async function handleGoogleWorkspaceApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/google/workspace/")) return next();

  try {
    if (url.pathname === "/api/google/workspace/oauth/callback" && req.method === "GET") {
      const oauthConfig = config();
      if (!oauthConfig) return redirect(res, "/?google-workspace=error&reason=not-configured");
      if (url.searchParams.get("error")) return redirect(res, "/?google-workspace=error&reason=consent-denied");
      const profileId = await states.consume(url.searchParams.get("state") || "");
      if (!profileId) return redirect(res, "/?google-workspace=error&reason=invalid-state");
      const oauth = new GoogleOAuthClient(oauthConfig);
      const tokens = await oauth.exchangeAuthorizationCode(url.searchParams.get("code") || "");
      if (!isGrantComplete(tokens.scopes)) return redirect(res, "/?google-workspace=error&reason=missing-scopes");
      const email = await oauth.getUserEmail(tokens.accessToken);
      await store.writeGrant(profileId, { refreshToken: tokens.refreshToken, email, scopes: tokens.scopes, connectedAt: new Date().toISOString() });
      await syncWorkspace(profileId);
      const backend = getSupabaseBackend();
      if (backend) await recordTeamActivity(backend.client, profileId, "google.workspace.connected", "integration", "google-workspace", { name: email });
      return redirect(res, "/?google-workspace=connected");
    }

    const profile = await getProfile(req);
    if (!profile) return sendJson(res, 401, { error: "Configura primeiro o perfil AXION.", code: "AXION_PROFILE_REQUIRED" });

    if (url.pathname === "/api/google/workspace/status" && req.method === "GET") {
      return sendJson(res, 200, await getGoogleWorkspaceState(profile.id));
    }

    if (url.pathname === "/api/google/workspace/oauth/start" && req.method === "GET") {
      const oauthConfig = config();
      if (!oauthConfig) return sendJson(res, 503, { error: "OAuth Google não está configurado.", code: "GOOGLE_WORKSPACE_NOT_CONFIGURED" });
      return redirect(res, buildWorkspaceAuthorizationUrl({ clientId: oauthConfig.clientId, redirectUri: oauthConfig.redirectUri, state: await states.create(profile.id) }));
    }

    if (url.pathname === "/api/google/workspace/disconnect" && req.method === "POST") {
      const value = await store.read(profile.id);
      const oauthConfig = config();
      if (value && oauthConfig) await new GoogleOAuthClient(oauthConfig).revokeGrant(value.grant.refreshToken).catch(() => false);
      await store.clear(profile.id);
      const backend = getSupabaseBackend();
      if (backend) await recordTeamActivity(backend.client, profile.id, "google.workspace.disconnected", "integration", "google-workspace");
      return sendJson(res, 200, { disconnected: true });
    }

    if (url.pathname === "/api/google/workspace/sync" && req.method === "POST") {
      return sendJson(res, 200, await syncWorkspace(profile.id));
    }

    if (url.pathname === "/api/google/workspace/calendar/events" && req.method === "POST") {
      const input = await readJson(req) as WorkspaceCalendarEvent;
      const { value, google } = await workspaceClient(profile.id);
      const created = fromGoogleEvent(await google.createEvent(toGoogleEvent(input)));
      await store.update(profile.id, { events: [...value.events.filter((item) => item.gcalEventId !== created.gcalEventId), created] });
      const backend = getSupabaseBackend();
      if (backend) await recordTeamActivity(backend.client, profile.id, "meeting.created", "calendar_event", created.id, { title: created.title });
      return sendJson(res, 201, created);
    }

    const calendarMatch = url.pathname.match(/^\/api\/google\/workspace\/calendar\/events\/([^/]+)$/);
    if (calendarMatch && req.method === "PATCH") {
      const input = await readJson(req) as WorkspaceCalendarEvent;
      const { value, google } = await workspaceClient(profile.id);
      const eventId = decodeURIComponent(calendarMatch[1]);
      const updated = fromGoogleEvent(await google.updateEvent(eventId, toGoogleEvent(input)));
      await store.update(profile.id, { events: [...value.events.filter((item) => item.gcalEventId !== eventId), updated] });
      const backend = getSupabaseBackend();
      if (backend) await recordTeamActivity(backend.client, profile.id, "meeting.updated", "calendar_event", updated.id, { title: updated.title });
      return sendJson(res, 200, updated);
    }

    if (url.pathname === "/api/google/workspace/tasks" && req.method === "POST") {
      const input = await readJson(req) as WorkspaceTask;
      const { value, google } = await workspaceClient(profile.id);
      const taskListId = value.taskListId || await google.ensureAxionTaskList();
      const created = fromGoogleTask(await google.createTask(taskListId, toGoogleTask(input)));
      await store.update(profile.id, { taskListId, tasks: [...value.tasks.filter((item) => item.googleTaskId !== created.googleTaskId), created] });
      const backend = getSupabaseBackend();
      if (backend) await recordTeamActivity(backend.client, profile.id, "task.created", "task", created.id, { title: created.title });
      return sendJson(res, 201, created);
    }

    const taskMatch = url.pathname.match(/^\/api\/google\/workspace\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === "PATCH") {
      const input = await readJson(req) as WorkspaceTask;
      const { value, google } = await workspaceClient(profile.id);
      if (!value.taskListId) throw new Error("GOOGLE_TASK_LIST_MISSING");
      const taskId = decodeURIComponent(taskMatch[1]);
      const previous = value.tasks.find((item) => item.googleTaskId === taskId);
      const updated = fromGoogleTask(await google.updateTask(value.taskListId, taskId, toGoogleTask(input)));
      let focus = value.focus;
      if (previous?.completed !== updated.completed) focus = applyTaskFocusTransition(focus, { taskId: updated.id, completed: updated.completed, estimatedMinutes: updated.estimatedMinutes });
      await store.update(profile.id, { tasks: [...value.tasks.filter((item) => item.googleTaskId !== taskId), updated], focus });
      await updateProfileFocus(profile.id, focus.totalMinutes);
      const backend = getSupabaseBackend();
      if (backend) await recordTeamActivity(backend.client, profile.id, "task.updated", "task", updated.id, { title: updated.title, completed: updated.completed });
      return sendJson(res, 200, { task: updated, focusMinutes: focus.totalMinutes });
    }

    return sendJson(res, 404, { error: "Endpoint Google Workspace não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[GOOGLE WORKSPACE]", message.split(":")[0]);
    return sendJson(res, 500, { error: "Não foi possível concluir a operação Google Workspace.", code: message.split(":")[0] });
  }
}
