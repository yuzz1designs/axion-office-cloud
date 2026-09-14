import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { listNotificationReads, markNotificationsRead } from "./notificationStore";

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

export async function handleNotificationApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/notifications")) return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (url.pathname === "/api/notifications/read" && req.method === "GET") {
      return sendJson(res, 200, { keys: await listNotificationReads(backend.client, user.id) });
    }
    if (url.pathname === "/api/notifications/read" && req.method === "POST") {
      const body = await readJson(req) as { keys?: unknown };
      if (!Array.isArray(body.keys) || body.keys.some((key) => typeof key !== "string")) return sendJson(res, 400, { error: "Notificações inválidas." });
      return sendJson(res, 200, { keys: await markNotificationsRead(backend.client, user.id, body.keys) });
    }
    return sendJson(res, 404, { error: "Endpoint de notificações não encontrado." });
  } catch {
    return sendJson(res, 500, { error: "Não foi possível atualizar as notificações." });
  }
}
