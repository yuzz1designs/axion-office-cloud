import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { recordTeamActivity } from "./teamActivityStore";
import { MAX_TEAM_UPDATE_MEDIA_BYTES } from "./teamUpdateCore";
import { attachTeamUpdateMedia, createTeamUpdate, deleteTeamUpdate, listTeamUpdates, markTeamUpdateViewed, updateTeamUpdate } from "./teamUpdateStore";
import { dispatchTeamUpdatePush } from "./pushNotificationStore";

function json(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > 16_384) throw new Error("TEAM_UPDATE_TOO_LARGE"); chunks.push(value); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
async function mediaBody(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > MAX_TEAM_UPDATE_MEDIA_BYTES) throw new Error("TEAM_UPDATE_MEDIA_TOO_LARGE"); chunks.push(value); } return Buffer.concat(chunks); }

export async function handleTeamUpdateApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/team/updates" && !url.pathname.startsWith("/api/team/updates/")) return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return json(res, 503, { error: "Updates da equipa indisponíveis." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return json(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (url.pathname === "/api/team/updates" && req.method === "GET") return json(res, 200, { updates: await listTeamUpdates(backend.client, user.id) });
    const updateMatch = url.pathname.match(/^\/api\/team\/updates\/([^/]+)$/);
    if (updateMatch && req.method === "PATCH") {
      const update = await updateTeamUpdate(backend.client, user.id, decodeURIComponent(updateMatch[1]), await body(req));
      await recordTeamActivity(backend.client, user.id, "team.update.edited", "team_update", update.id, { name: update.title });
      return json(res, 200, { update });
    }
    if (updateMatch && req.method === "DELETE") {
      const deleted = await deleteTeamUpdate(backend.client, user.id, decodeURIComponent(updateMatch[1]));
      await recordTeamActivity(backend.client, user.id, "team.update.deleted", "team_update", deleted.id, { name: deleted.title });
      return json(res, 200, { deleted: true, id: deleted.id });
    }
    if (req.method === "POST") {
      const readMatch = url.pathname.match(/^\/api\/team\/updates\/([^/]+)\/read$/);
      if (readMatch) return json(res, 200, { viewer: await markTeamUpdateViewed(backend.client, user.id, decodeURIComponent(readMatch[1])) });
      const mediaMatch = url.pathname.match(/^\/api\/team\/updates\/([^/]+)\/media$/);
      if (mediaMatch) {
        const rawName = Array.isArray(req.headers["x-file-name"]) ? req.headers["x-file-name"][0] : req.headers["x-file-name"];
        if (!rawName) return json(res, 400, { error: "Seleciona uma imagem ou um vídeo." });
        const media = await attachTeamUpdateMedia(backend.client, user.id, decodeURIComponent(mediaMatch[1]), { name: decodeURIComponent(rawName), type: String(req.headers["content-type"] || ""), bytes: await mediaBody(req) });
        return json(res, 201, { media });
      }
      if (url.pathname !== "/api/team/updates") return json(res, 404, { error: "Endpoint de updates não encontrado." });
      const update = await createTeamUpdate(backend.client, user.id, await body(req));
      await recordTeamActivity(backend.client, user.id, "team.update.published", "team_update", update.id, { name: update.title });
      await dispatchTeamUpdatePush(backend.client, { updateId: update.id, authorUserId: user.id, authorName: update.authorName }).catch((error) => console.error("[TEAM UPDATE PUSH]", error instanceof Error ? error.message : error));
      return json(res, 201, { update });
    }
    return json(res, 405, { error: "Método não permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "TEAM_UPDATE_FAILED";
    const invalid = /obrigatórios|120|2000|TOO_LARGE|TYPE_INVALID|MEDIA_EMPTY|MEDIA_LIMIT/.test(message);
    const notFound = message === "TEAM_UPDATE_NOT_FOUND";
    console.error("[TEAM UPDATES]", message);
    const errorMessage = message.includes("TYPE_INVALID") ? "Seleciona uma imagem ou um vídeo compatível (JPG, PNG, GIF, WebP, AVIF, MP4, WebM ou MOV)."
      : message.includes("TOO_LARGE") ? "Cada imagem ou vídeo pode ter no máximo 50 MB."
        : message.includes("MEDIA_EMPTY") ? "O anexo está vazio."
          : message.includes("MEDIA_LIMIT") ? "Cada update pode ter no máximo quatro anexos."
            : invalid ? message.replace(/^TEAM_UPDATE_[A-Z_]+:?/, "") : "Não foi possível concluir a operação de updates.";
    return json(res, notFound ? 404 : invalid ? 400 : 500, { error: notFound ? "Update não encontrado." : errorMessage });
  }
}
