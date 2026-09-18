import type { IncomingMessage, ServerResponse } from "node:http";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { decodeUploadFileName, mapDriveFile, MAX_DRIVE_UPLOAD_BYTES, validateDriveUpload, type DriveFile } from "./driveDocument";
import { uploadDriveDocument } from "./googleDriveUpload";
import { getGoogleOAuthClient, getGoogleOAuthStore } from "./googleOAuthApi";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { recordTeamActivity } from "./teamActivityStore";

const DOCS_FOLDER_ID = process.env.GOOGLE_DRIVE_DOCS_FOLDER_ID || "1_Xtah1WKj_YoxZoOjNABiM0TjuWBvef8";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type ServiceAccount = { client_email: string; private_key: string };

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function getServiceAccount(): ServiceAccount | null {
  const credentialsFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (credentialsFile) {
    const parsed = JSON.parse(readFileSync(credentialsFile, "utf8")) as ServiceAccount;
    return parsed.client_email && parsed.private_key ? parsed : null;
  }
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return clientEmail && privateKey ? { client_email: clientEmail, private_key: privateKey } : null;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

async function readBody(req: IncomingMessage, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("DRIVE_UPLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function getAccessToken(credentials: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: DRIVE_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const assertion = `${unsignedToken}.${base64Url(signer.sign(credentials.private_key))}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const result = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "GOOGLE_AUTH_FAILED");
  return result.access_token;
}

async function listDocuments() {
  const credentials = getServiceAccount();
  if (!credentials) throw new Error("GOOGLE_DRIVE_NOT_CONFIGURED");
  const token = await getAccessToken(credentials);
  const params = new URLSearchParams({
    q: `"${DOCS_FOLDER_ID}" in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,description,owners(displayName))",
    orderBy: "folder,name",
    pageSize: "100",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json() as { files?: DriveFile[]; error?: { message?: string } };
  if (!response.ok) throw new Error(result.error?.message || "GOOGLE_DRIVE_REQUEST_FAILED");
  return (result.files || []).map(mapDriveFile);
}

export async function uploadDocumentToDocs(req: IncomingMessage, userId: string) {
  const fileName = decodeUploadFileName(typeof req.headers["x-file-name"] === "string" ? req.headers["x-file-name"] : undefined);
  const mimeType = String(req.headers["content-type"] || "application/octet-stream").split(";")[0];
  const file = await readBody(req, MAX_DRIVE_UPLOAD_BYTES);
  validateDriveUpload({ fileName, byteLength: file.length });

  const store = getGoogleOAuthStore();
  const grant = await store.read(userId);
  const client = getGoogleOAuthClient();
  if (!grant || !client) throw new Error("GOOGLE_DRIVE_OAUTH_REQUIRED");
  try {
    const accessToken = await client.refreshAccessToken(grant.refreshToken);
    const document = await uploadDriveDocument({ accessToken, folderId: DOCS_FOLDER_ID, fileName, mimeType, file });
    return { document, accessToken };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("GOOGLE_OAUTH_TOKEN_FAILED")) {
      await store.clear(userId);
      throw new Error("GOOGLE_DRIVE_OAUTH_REQUIRED");
    }
    throw error;
  }
}

export async function handleGoogleDriveApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/documents")) return next();

  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    if (url.pathname === "/api/documents" && req.method === "GET") {
      const documents = await listDocuments();
      return sendJson(res, 200, {
        documents,
        folderId: DOCS_FOLDER_ID,
        folderUrl: `https://drive.google.com/drive/folders/${DOCS_FOLDER_ID}`,
        syncedAt: new Date().toISOString(),
      });
    }
    if (url.pathname === "/api/documents/upload" && req.method === "POST") {
      const { document } = await uploadDocumentToDocs(req, user.id);
      await recordTeamActivity(backend.client, user.id, "document.uploaded", "document", document.id, { name: document.name });
      return sendJson(res, 201, { document });
    }
    return sendJson(res, 404, { error: "Endpoint de documentos não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[GOOGLE DRIVE API]", message);
    const status = message === "GOOGLE_DRIVE_OAUTH_REQUIRED" ? 409
      : message === "GOOGLE_DRIVE_NOT_CONFIGURED" ? 503
      : message === "DRIVE_UPLOAD_TOO_LARGE" || message.includes("50 MB") ? 413
        : message.includes("obrigatório") || message.includes("vazio") || message.includes("inválido") ? 400
          : 500;
    return sendJson(res, status, {
      error: status === 409 ? "Liga uma conta Google para carregar ficheiros."
        : status === 503 ? "A integração Google Drive ainda não está configurada."
          : status === 400 || status === 413 ? message
            : "Não foi possível concluir a operação no Google Drive.",
      code: status === 409 ? "GOOGLE_DRIVE_OAUTH_REQUIRED" : undefined,
    });
  }
}
