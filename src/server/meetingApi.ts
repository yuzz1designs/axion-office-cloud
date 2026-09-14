import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { createWorkspaceMeeting, listWorkspaceMeetings, updateWorkspaceMeeting, updateWorkspaceMeetingTask, type CreateWorkspaceMeetingInput } from "./meetingStore";
import { recordTeamActivity } from "./teamActivityStore";

function sendJson(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
async function readJson(req: IncomingMessage) { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
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
    const status = code === "MEETING_INVITEE_NOT_MEMBER" ? 400 : code === "MEETING_EDIT_FORBIDDEN" ? 403 : code === "MEETING_NOT_FOUND" ? 404 : 500;
    return sendJson(res, status, { error: code === "MEETING_EDIT_FORBIDDEN" ? "Só o organizador pode editar esta reunião." : "Não foi possível concluir a operação da reunião.", code });
  }
}
