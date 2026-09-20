import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { recordTeamActivity } from "./teamActivityStore";
import { createTeamUpdate, listTeamUpdates } from "./teamUpdateStore";

function json(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > 16_384) throw new Error("TEAM_UPDATE_TOO_LARGE"); chunks.push(value); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }

export async function handleTeamUpdateApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/team/updates") return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return json(res, 503, { error: "Updates da equipa indisponíveis." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return json(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (req.method === "GET") return json(res, 200, { updates: await listTeamUpdates(backend.client, user.id) });
    if (req.method === "POST") {
      const update = await createTeamUpdate(backend.client, user.id, await body(req));
      await recordTeamActivity(backend.client, user.id, "team.update.published", "team_update", update.id, { name: update.title });
      return json(res, 201, { update });
    }
    return json(res, 405, { error: "Método não permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TEAM_UPDATE_FAILED";
    const invalid = /obrigatórios|120|2000|TOO_LARGE/.test(message);
    console.error("[TEAM UPDATES]", message);
    return json(res, invalid ? 400 : 500, { error: invalid ? message.replace(/^TEAM_UPDATE_[A-Z_]+:?/, "") : "Não foi possível concluir a operação de updates." });
  }
}
