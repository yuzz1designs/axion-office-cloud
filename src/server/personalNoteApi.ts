import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { createPersonalNote, deletePersonalNote, listDuePersonalNotes, listPersonalNotes, updatePersonalNote } from "./personalNoteStore";

function json(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
async function body(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > 100_000) throw new Error("NOTE_BODY_TOO_LARGE"); chunks.push(value); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }

export async function handlePersonalNoteApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/api/notes" && !url.pathname.startsWith("/api/notes/")) return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return json(res, 503, { error: "Notas indisponíveis." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return json(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (url.pathname === "/api/notes" && req.method === "GET") return json(res, 200, { notes: url.searchParams.get("scope") === "reminders" ? await listDuePersonalNotes(backend.client, user.id) : await listPersonalNotes(backend.client, user.id, url.searchParams.get("archived") === "true") });
    if (url.pathname === "/api/notes" && req.method === "POST") return json(res, 201, { note: await createPersonalNote(backend.client, user.id, await body(req)) });
    const match = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
    if (match && req.method === "PATCH") return json(res, 200, { note: await updatePersonalNote(backend.client, user.id, decodeURIComponent(match[1]), await body(req)) });
    if (match && req.method === "DELETE") return json(res, 200, { deleted: true, id: await deletePersonalNote(backend.client, user.id, decodeURIComponent(match[1])) });
    return json(res, 405, { error: "Método não permitido." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "NOTE_FAILED";
    const invalid = /TOO_LONG|INVALID|BODY_TOO_LARGE/.test(message);
    const notFound = message === "NOTE_NOT_FOUND";
    console.error("[PERSONAL NOTES]", message);
    return json(res, notFound ? 404 : invalid ? 400 : 500, { error: notFound ? "Nota não encontrada ou sem permissão." : invalid ? "A nota contém dados inválidos ou excede os limites permitidos." : "Não foi possível concluir a operação de notas." });
  }
}
