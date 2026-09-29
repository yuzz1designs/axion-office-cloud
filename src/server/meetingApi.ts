import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { completeWorkspaceMeeting, createWorkspaceMeeting, createWorkspaceMeetingActionTask, getWorkspaceMeetingRecord, listWorkspaceMeetings, updateWorkspaceMeeting, updateWorkspaceMeetingRecord, updateWorkspaceMeetingTask, uploadWorkspaceMeetingFile, type CreateWorkspaceMeetingInput } from "./meetingStore";
import { recordTeamActivity } from "./teamActivityStore";

function sendJson(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
async function readJson(req: IncomingMessage) { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
async function readFile(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > 20 * 1024 * 1024) throw new Error("MEETING_FILE_TOO_LARGE"); chunks.push(value); } return Buffer.concat(chunks); }
function validInput(body: any): body is CreateWorkspaceMeetingInput { return typeof body?.title === "string" && body.title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(body.date) && /^\d{2}:\d{2}$/.test(body.startTime) && Number.isInteger(body.durationMinutes) && body.durationMinutes > 0 && body.durationMinutes <= 1440 && Array.isArray(body.invitedUserIds) && body.invitedUserIds.every((id: unknown) => typeof id === "string"); }

export async function handleMeetingApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/meetings")) return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (url.pathname === "/api/meetings" && req.method === "GET") return sendJson(res, 200, await listWorkspaceMeetings(backend.client, user.id));
    if (url.pathname === "/api/meetings" && req.method === "POST") {
      const body = await readJson(req);
      if (!validInput(body)) return sendJson(res, 400, { error: "Preenche o título, data, hora e duração da reunião." });
      const result = await createWorkspaceMeeting(backend.client, user.id, { ...body, title: body.title.trim() });
      await recordTeamActivity(backend.client, user.id, "meeting.created", "calendar_event", result.event.id, { title: result.event.title });
      return sendJson(res, 201, result);
    }
    const recordMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/record$/);
    if (recordMatch && req.method === "GET") return sendJson(res, 200, await getWorkspaceMeetingRecord(backend.client, user.id, decodeURIComponent(recordMatch[1])));
    if (recordMatch && req.method === "PATCH") {
      const body = await readJson(req);
      if (typeof body.minutes !== "string" || typeof body.notes !== "string" || body.minutes.length > 50_000 || body.notes.length > 50_000) return sendJson(res, 400, { error: "Ata ou anotações inválidas." });
      const event = await updateWorkspaceMeetingRecord(backend.client, user.id, decodeURIComponent(recordMatch[1]), { minutes: body.minutes, notes: body.notes });
      await recordTeamActivity(backend.client, user.id, "meeting.record.updated", "calendar_event", event.id, { title: event.title });
      return sendJson(res, 200, { event });
    }
    const completeMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/complete$/);
    if (completeMatch && req.method === "POST") {
      const event = await completeWorkspaceMeeting(backend.client, user.id, decodeURIComponent(completeMatch[1]));
      await recordTeamActivity(backend.client, user.id, "meeting.completed", "calendar_event", event.id, { title: event.title });
      return sendJson(res, 200, { event });
    }
    const actionTaskMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/tasks$/);
    if (actionTaskMatch && req.method === "POST") {
      const body = await readJson(req);
      if (typeof body.title !== "string" || !body.title.trim() || typeof body.assigneeUserId !== "string" || (body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) || (body.dueTime && !/^\d{2}:\d{2}$/.test(body.dueTime))) return sendJson(res, 400, { error: "Preenche o título e o responsável da tarefa." });
      const task = await createWorkspaceMeetingActionTask(backend.client, user.id, decodeURIComponent(actionTaskMatch[1]), body);
      await recordTeamActivity(backend.client, user.id, "meeting.task.created", "task", task.id, { title: task.title });
      return sendJson(res, 201, { task });
    }
    const fileMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)\/files$/);
    if (fileMatch && req.method === "POST") {
      const rawName = Array.isArray(req.headers["x-file-name"]) ? req.headers["x-file-name"][0] : req.headers["x-file-name"];
      if (!rawName) return sendJson(res, 400, { error: "Seleciona um ficheiro." });
      const bytes = await readFile(req);
      if (!bytes.length) return sendJson(res, 400, { error: "O ficheiro está vazio." });
      const file = await uploadWorkspaceMeetingFile(backend.client, user.id, decodeURIComponent(fileMatch[1]), { name: decodeURIComponent(rawName), type: String(req.headers["content-type"] || "application/octet-stream"), bytes });
      return sendJson(res, 201, { file });
    }
    const meetingMatch = url.pathname.match(/^\/api\/meetings\/([^/]+)$/);
    if (meetingMatch && req.method === "PATCH") {
      const body = await readJson(req);
      if (!validInput(body)) return sendJson(res, 400, { error: "Preenche o título, data, hora e duração da reunião." });
      const result = await updateWorkspaceMeeting(backend.client, user.id, decodeURIComponent(meetingMatch[1]), { ...body, title: body.title.trim() });
      await recordTeamActivity(backend.client, user.id, "meeting.updated", "calendar_event", result.event.id, { title: result.event.title });
      return sendJson(res, 200, result);
    }
    const taskMatch = url.pathname.match(/^\/api\/meetings\/tasks\/([^/]+)$/);
    if (taskMatch && req.method === "PATCH") {
      const body = await readJson(req);
      if (typeof body.completed !== "boolean") return sendJson(res, 400, { error: "Estado da tarefa inválido." });
      return sendJson(res, 200, { task: await updateWorkspaceMeetingTask(backend.client, user.id, decodeURIComponent(taskMatch[1]), body.completed) });
    }
    return sendJson(res, 404, { error: "Endpoint de reuniões não encontrado." });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0] : "MEETING_FAILED";
    const status = code === "MEETING_INVITEE_NOT_MEMBER" || code === "MEETING_TASK_ASSIGNEE_INVALID" || code === "MEETING_FILE_TOO_LARGE" ? 400 : code === "MEETING_EDIT_FORBIDDEN" || code === "MEETING_ACCESS_FORBIDDEN" ? 403 : code === "MEETING_NOT_FOUND" ? 404 : 500;
    const message = code === "MEETING_EDIT_FORBIDDEN" ? "Só o organizador pode editar esta reunião." : code === "MEETING_ACCESS_FORBIDDEN" ? "Não tens acesso a esta reunião." : code === "MEETING_FILE_TOO_LARGE" ? "O ficheiro não pode exceder 20 MB." : "Não foi possível concluir a operação da reunião.";
    return sendJson(res, status, { error: message, code });
  }
}
