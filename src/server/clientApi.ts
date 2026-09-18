import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { ClientStore } from "./clientStore";
import { recordTeamActivity } from "./teamActivityStore";
import { uploadDocumentToDocs } from "./googleDriveApi";
import { deleteDriveDocument } from "./googleDriveUpload";
import { uploadAndAttachClientDocument } from "./clientDocumentUpload";

function sendJson(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
async function readBody(req: IncomingMessage, limit: number) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > limit) throw new Error("CLIENT_PAYLOAD_TOO_LARGE"); chunks.push(value); } return Buffer.concat(chunks); }

export async function handleClientApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/clients")) return next();
  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    const store = new ClientStore(backend.client);
    if (url.pathname === "/api/clients" && req.method === "GET") return sendJson(res, 200, { clients: await store.list(user.id) });
    if (url.pathname === "/api/clients" && req.method === "POST") {
      const input = JSON.parse((await readBody(req, 1_000_000)).toString("utf8"));
      const client = await store.create(user.id, input);
      await recordTeamActivity(backend.client, user.id, "client.created", "client", String(client.id), { name: client.name });
      return sendJson(res, 201, { client });
    }
    const logoMatch = /^\/api\/clients\/([^/]+)\/logo$/.exec(url.pathname);
    if (logoMatch && req.method === "POST") {
      const client = await store.uploadLogo(user.id, decodeURIComponent(logoMatch[1]), String(req.headers["content-type"] || ""), await readBody(req, 5 * 1024 * 1024 + 1));
      await recordTeamActivity(backend.client, user.id, "client.logo.updated", "client", String(client.id), { name: client.name });
      return sendJson(res, 200, { client });
    }
    const documentMatch = /^\/api\/clients\/([^/]+)\/documents$/.exec(url.pathname);
    if (documentMatch && req.method === "POST") {
      const clientId = decodeURIComponent(documentMatch[1]);
      const result = await uploadAndAttachClientDocument({
        upload: () => uploadDocumentToDocs(req, user.id),
        attach: ({ document }) => store.attachDocument(user.id, clientId, document),
        rollback: ({ document, accessToken }) => deleteDriveDocument({ accessToken, documentId: document.id }),
      });
      await recordTeamActivity(backend.client, user.id, "client.document.uploaded", "client", String(result.client.id), { name: result.client.name, documentName: result.document.document.name });
      return sendJson(res, 201, { client: result.client, document: result.document.document });
    }
    const match = /^\/api\/clients\/([^/]+)$/.exec(url.pathname);
    if (match && req.method === "PUT") {
      const input = JSON.parse((await readBody(req, 1_000_000)).toString("utf8"));
      const client = await store.update(user.id, decodeURIComponent(match[1]), input);
      await recordTeamActivity(backend.client, user.id, "client.updated", "client", String(client.id), { name: client.name });
      return sendJson(res, 200, { client });
    }
    if (match && req.method === "DELETE") {
      const clientId = decodeURIComponent(match[1]);
      const name = (await store.list(user.id)).find((client) => String(client.id) === clientId)?.name;
      await store.remove(user.id, clientId);
      await recordTeamActivity(backend.client, user.id, "client.deleted", "client", clientId, { name });
      return sendJson(res, 200, { deleted: true });
    }
    return sendJson(res, 404, { error: "Endpoint de clientes não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CLIENT_UNKNOWN_ERROR";
    const status = message === "GOOGLE_DRIVE_OAUTH_REQUIRED" ? 409
      : message.includes("TOO_LARGE") ? 413
        : message.includes("NOT_FOUND") ? 404
          : message.includes("REQUIRED") || message.includes("Formato") || message.includes("5 MB") || message.includes("obrigatório") || message.includes("vazio") || message.includes("inválido") ? 400
            : 500;
    return sendJson(res, status, { error: message === "CLIENT_DOCUMENT_ROLLBACK_FAILED" ? "O ficheiro chegou ao Drive, mas não foi possível associá-lo ao cliente nem anular o upload. Remove-o manualmente em DOCS antes de tentar novamente." : status === 409 ? "Liga uma conta Google para carregar ficheiros." : status === 413 ? "O ficheiro é demasiado grande." : status === 400 ? message.replace(/^CLIENT_[A-Z_]+:?/, "") : "Não foi possível atualizar os clientes." });
  }
}
