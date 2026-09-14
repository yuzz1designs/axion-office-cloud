import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { listTeamActivity, recordTeamActivity } from "./teamActivityStore";

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

export async function handleTeamActivityApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/team/activity") return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (req.method === "GET") return sendJson(res, 200, { activities: await listTeamActivity(backend.client, user.id) });
    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) as { action?: string } : {};
      if (body.action !== "settings.updated") return sendJson(res, 400, { error: "Ação de atividade inválida." });
      await recordTeamActivity(backend.client, user.id, body.action, "settings", user.id);
      return sendJson(res, 201, { recorded: true });
    }
    return sendJson(res, 405, { error: "Method not allowed" });
  } catch {
    return sendJson(res, 500, { error: "Não foi possível carregar a atividade da equipa." });
  }
}
