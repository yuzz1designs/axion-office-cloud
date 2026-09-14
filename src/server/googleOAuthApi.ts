import type { IncomingMessage, ServerResponse } from "node:http";
import { buildGoogleAuthorizationUrl, GOOGLE_DRIVE_SCOPE, OAuthStateStore, toPublicOAuthStatus } from "./googleOAuthCore";
import { GoogleOAuthClient, type GoogleOAuthConfig } from "./googleOAuthClient";
import { GoogleOAuthStore } from "./googleOAuthStore";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { recordTeamActivity } from "./teamActivityStore";

const states = new OAuthStateStore();
const store = new GoogleOAuthStore();

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function redirect(res: ServerResponse, location: string) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || "http://localhost:3000/api/google/oauth/callback";
  return clientId && clientSecret ? { clientId, clientSecret, redirectUri } : null;
}

export function getGoogleOAuthStore() {
  return store;
}

export function getGoogleOAuthClient() {
  const config = getGoogleOAuthConfig();
  return config ? new GoogleOAuthClient(config) : null;
}

async function recordDriveActivity(req: IncomingMessage, action: "google.drive.connected" | "google.drive.disconnected", email?: string) {
  const backend = getSupabaseBackend();
  if (!backend) return;
  const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
  if (!user) return;
  await recordTeamActivity(backend.client, user.id, action, "integration", "google-drive", { name: email });
}

export async function handleGoogleOAuthApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/google/oauth/")) return next();

  try {
    const config = getGoogleOAuthConfig();
    const client = config ? new GoogleOAuthClient(config) : null;

    if (url.pathname === "/api/google/oauth/status" && req.method === "GET") {
      return sendJson(res, 200, toPublicOAuthStatus({ configured: Boolean(config), grant: store.read() }));
    }

    if (url.pathname === "/api/google/oauth/start" && req.method === "GET") {
      if (!config) return sendJson(res, 503, { error: "OAuth Google ainda não está configurado no servidor.", code: "GOOGLE_OAUTH_NOT_CONFIGURED" });
      const state = states.create();
      return redirect(res, buildGoogleAuthorizationUrl({ clientId: config.clientId, redirectUri: config.redirectUri, state }));
    }

    if (url.pathname === "/api/google/oauth/callback" && req.method === "GET") {
      if (!client) return redirect(res, "/?google-drive=error&reason=not-configured");
      if (url.searchParams.get("error")) return redirect(res, "/?google-drive=error&reason=consent-denied");
      const state = url.searchParams.get("state") || "";
      const code = url.searchParams.get("code") || "";
      if (!state || !states.consume(state)) return redirect(res, "/?google-drive=error&reason=invalid-state");
      if (!code) return redirect(res, "/?google-drive=error&reason=missing-code");

      const tokens = await client.exchangeAuthorizationCode(code);
      if (!tokens.scopes.includes(GOOGLE_DRIVE_SCOPE)) return redirect(res, "/?google-drive=error&reason=missing-scope");
      const email = await client.getUserEmail(tokens.accessToken);
      store.write({ refreshToken: tokens.refreshToken, email, scopes: tokens.scopes, connectedAt: new Date().toISOString() });
      await recordDriveActivity(req, "google.drive.connected", email);
      return redirect(res, "/?google-drive=connected");
    }

    if (url.pathname === "/api/google/oauth/disconnect" && req.method === "POST") {
      const grant = store.read();
      if (grant && client) await client.revokeGrant(grant.refreshToken).catch(() => false);
      store.clear();
      await recordDriveActivity(req, "google.drive.disconnected");
      return sendJson(res, 200, { disconnected: true });
    }

    return sendJson(res, 404, { error: "Endpoint OAuth não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[GOOGLE OAUTH]", message.split(":")[0]);
    if (url.pathname === "/api/google/oauth/callback") return redirect(res, "/?google-drive=error&reason=oauth-failed");
    return sendJson(res, 500, { error: "Não foi possível concluir a operação OAuth.", code: "GOOGLE_OAUTH_FAILED" });
  }
}
