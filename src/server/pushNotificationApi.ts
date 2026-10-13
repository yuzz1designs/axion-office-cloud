import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { getPushStatus, getVapidConfig, removePushSubscription, savePushSubscription, sendTestPush } from "./pushNotificationStore";

function sendJson(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
async function readJson(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > 32_768) throw new Error("PUSH_PAYLOAD_TOO_LARGE"); chunks.push(value); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }

export async function handlePushNotificationApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/push/")) return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (url.pathname === "/api/push/status" && req.method === "GET") return sendJson(res, 200, await getPushStatus(backend.client, user.id, url.searchParams.get("deviceId")));
    if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
      if (!getVapidConfig()) return sendJson(res, 503, { error: "As notificações push ainda não estão configuradas no servidor.", code: "PUSH_NOT_CONFIGURED" });
      const body = await readJson(req) as { deviceId?: unknown; subscription?: unknown };
      return sendJson(res, 201, await savePushSubscription(backend.client, user.id, body.deviceId, body.subscription, String(req.headers["user-agent"] || "")));
    }
    if (url.pathname === "/api/push/subscribe" && req.method === "DELETE") {
      const body = await readJson(req) as { deviceId?: unknown };
      await removePushSubscription(backend.client, user.id, body.deviceId);
      return sendJson(res, 200, { removed: true });
    }
    if (url.pathname === "/api/push/test" && req.method === "POST") {
      const body = await readJson(req) as { deviceId?: unknown };
      return sendJson(res, 200, await sendTestPush(backend.client, user.id, body.deviceId));
    }
    return sendJson(res, 404, { error: "Endpoint push não encontrado." });
  } catch (error) {
    const code = error instanceof Error ? error.message.split(":")[0] : "PUSH_FAILED";
    const status = code === "PUSH_SUBSCRIPTION_NOT_FOUND" ? 404 : code === "PUSH_NOT_CONFIGURED" ? 503 : code.includes("INVALID") || code.includes("TOO_LARGE") ? 400 : 500;
    const message = code === "PUSH_SUBSCRIPTION_NOT_FOUND" ? "Este dispositivo não tem notificações ativas." : code === "PUSH_SUBSCRIPTION_EXPIRED" ? "A subscription deste dispositivo expirou. Ativa novamente as notificações." : code === "PUSH_TEST_FAILED" ? "Não foi possível entregar a notificação de teste." : status === 400 ? "Os dados da subscription são inválidos." : status === 503 ? "As notificações push ainda não estão configuradas no servidor." : "Não foi possível concluir a operação de notificações.";
    console.error("[PUSH]", code);
    return sendJson(res, status, { error: message, code });
  }
}
