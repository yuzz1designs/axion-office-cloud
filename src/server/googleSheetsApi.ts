import type { IncomingMessage, ServerResponse } from "node:http";
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  companyToRow,
  createNextCompanyId,
  findCompanySheetRow,
  findFirstEmptySheetRow,
  rowToCompany,
  type CrmCompany,
} from "./crmCompany";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { recordTeamActivity } from "./teamActivityStore";

const SHEET_ID = process.env.GOOGLE_SHEETS_ID || "1YauPqJGJonmCE28DwpqWchO-SV2IffzQ1ORc7KtH54k";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const MAX_BODY_BYTES = 64_000;

type ServiceAccount = { client_email: string; private_key: string };

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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

async function getAccessToken(credentials: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: SHEETS_SCOPE,
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

async function sheetsRequest(path: string, init: RequestInit = {}) {
  const credentials = getServiceAccount();
  if (!credentials) throw new Error("GOOGLE_SHEETS_NOT_CONFIGURED");
  const token = await getAccessToken(credentials);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error((result as { error?: { message?: string } }).error?.message || "GOOGLE_SHEETS_REQUEST_FAILED");
  return result;
}

async function getCompanyRows() {
  const result = await sheetsRequest(`/values/${encodeURIComponent("Empresas!A2:Q")}`) as { values?: unknown[][] };
  return result.values || [];
}

async function listCompanies() {
  return (await getCompanyRows()).map(rowToCompany).filter((company) => company.id || company.company);
}

export async function handleGoogleSheetsApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/crm/")) return next();

  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });

    if (url.pathname === "/api/crm/status" && req.method === "GET") {
      return sendJson(res, 200, { configured: Boolean(getServiceAccount()), sheetId: SHEET_ID });
    }
    if (url.pathname === "/api/crm/companies" && req.method === "GET") {
      const companies = await listCompanies();
      return sendJson(res, 200, { companies, syncedAt: new Date().toISOString() });
    }
    if (url.pathname === "/api/crm/companies" && req.method === "POST") {
      const company = await readJson(req) as CrmCompany;
      if (!company.company?.trim()) return sendJson(res, 400, { error: "O nome da empresa é obrigatório." });
      const rows = await getCompanyRows();
      const companies = rows.map(rowToCompany).filter((item) => item.id || item.company);
      company.id ||= createNextCompanyId(companies.map((item) => item.id));
      const sheetRow = findFirstEmptySheetRow(rows);
      const writeResult = await sheetsRequest(`/values/${encodeURIComponent(`Empresas!A${sheetRow}:Q${sheetRow}`)}?valueInputOption=USER_ENTERED&includeValuesInResponse=true`, {
        method: "PUT", body: JSON.stringify({ values: [companyToRow(company)] }),
      }) as { updatedRows?: number };
      if (writeResult.updatedRows !== 1) throw new Error("GOOGLE_SHEETS_WRITE_NOT_CONFIRMED");
      await recordTeamActivity(backend.client, user.id, "client.created", "client", company.id || null, { name: company.company });
      return sendJson(res, 201, { company });
    }
    const match = url.pathname.match(/^\/api\/crm\/companies\/([^/]+)$/);
    if (match && req.method === "PUT") {
      const id = decodeURIComponent(match[1]);
      const company = await readJson(req) as CrmCompany;
      const rows = await getCompanyRows();
      const sheetRow = findCompanySheetRow(rows, id);
      if (sheetRow === null) return sendJson(res, 404, { error: "Empresa não encontrada." });
      company.id = id;
      await sheetsRequest(`/values/${encodeURIComponent(`Empresas!A${sheetRow}:Q${sheetRow}`)}?valueInputOption=USER_ENTERED`, {
        method: "PUT", body: JSON.stringify({ values: [companyToRow(company)] }),
      });
      await recordTeamActivity(backend.client, user.id, "client.updated", "client", company.id || null, { name: company.company });
      return sendJson(res, 200, { company });
    }
    return sendJson(res, 404, { error: "Endpoint CRM não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[GOOGLE SHEETS API]", message);
    const status = message === "GOOGLE_SHEETS_NOT_CONFIGURED" ? 503 : message === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return sendJson(res, status, { error: status === 503 ? "A integração Google Sheets ainda não está configurada no servidor." : "Não foi possível sincronizar o CRM.", detail: message });
  }
}
