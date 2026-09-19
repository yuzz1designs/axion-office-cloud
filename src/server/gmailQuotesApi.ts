import type { IncomingMessage, ServerResponse } from "node:http";
import { CloudOAuthStates, decryptIntegration, encryptIntegration, integrationEncryptionConfigured } from "./cloudIntegrationStore";
import { GmailQuotesClient, GMAIL_READONLY_SCOPE, classifyGmailQuoteCandidate } from "./gmailQuotesClient";
import { GoogleOAuthClient, type GoogleOAuthConfig } from "./googleOAuthClient";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { QuoteStore } from "./quoteStore";
import { recordTeamActivity } from "./teamActivityStore";

const states = new CloudOAuthStates("google_gmail_quotes");
const provider = "google_gmail_quotes";
const expectedEmail = () => (process.env.AXION_QUOTES_GMAIL || "axionportugal@gmail.com").trim().toLowerCase();
function config(): GoogleOAuthConfig | null { const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID; const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET; const redirectUri = process.env.GOOGLE_QUOTES_GMAIL_REDIRECT_URI || "http://localhost:3000/api/quotes/gmail/oauth/callback"; return clientId && clientSecret && integrationEncryptionConfigured() ? { clientId, clientSecret, redirectUri } : null; }
function json(res: ServerResponse, status: number, value: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(value)); }
function redirect(res: ServerResponse, location: string) { res.statusCode = 302; res.setHeader("Location", location); res.setHeader("Cache-Control", "no-store"); res.end(); }
function authUrl(input: { clientId: string; redirectUri: string; state: string }) { const url = new URL("https://accounts.google.com/o/oauth2/v2/auth"); url.search = new URLSearchParams({ client_id: input.clientId, redirect_uri: input.redirectUri, response_type: "code", scope: ["openid", "email", GMAIL_READONLY_SCOPE].join(" "), access_type: "offline", prompt: "consent", state: input.state }).toString(); return url.toString(); }
async function member(req: IncomingMessage) { const backend = getSupabaseBackend(); if (!backend) return null; const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails()); if (!user) return null; const store = new QuoteStore(backend.client); return { backend, user, store, workspaceId: await store.workspaceId(user.id) }; }
async function grant(workspaceId: string) { const backend = getSupabaseBackend()!; const { data, error } = await backend.client.from("workspace_integrations").select("*").eq("workspace_id", workspaceId).eq("provider", provider).maybeSingle(); if (error) throw new Error("GMAIL_INTEGRATION_READ_FAILED"); if (!data || data.status === "revoked" || !data.encrypted_refresh_token) return null; return { ...data, refreshToken: decryptIntegration<string>(data.encrypted_refresh_token, `${provider}:${workspaceId}`) }; }

export async function handleGmailQuotesApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost"); if (!url.pathname.startsWith("/api/quotes/gmail/")) return next();
  try {
    if (url.pathname === "/api/quotes/gmail/oauth/callback" && req.method === "GET") {
      const oauthConfig = config(); if (!oauthConfig) return redirect(res, "/?quotes-gmail=error&reason=not-configured");
      const userId = await states.consume(url.searchParams.get("state") || ""); if (!userId) return redirect(res, "/?quotes-gmail=error&reason=invalid-state");
      const backend = getSupabaseBackend()!; const quoteStore = new QuoteStore(backend.client); const workspaceId = await quoteStore.workspaceId(userId);
      const oauth = new GoogleOAuthClient(oauthConfig); const tokens = await oauth.exchangeAuthorizationCode(url.searchParams.get("code") || "");
      if (!tokens.scopes.includes(GMAIL_READONLY_SCOPE)) return redirect(res, "/?quotes-gmail=error&reason=missing-scope");
      const email = (await oauth.getUserEmail(tokens.accessToken)).toLowerCase(); if (email !== expectedEmail()) return redirect(res, `/?quotes-gmail=error&reason=wrong-account&email=${encodeURIComponent(email)}`);
      const { error } = await backend.client.from("workspace_integrations").upsert({ workspace_id: workspaceId, provider, provider_email: email, encrypted_refresh_token: encryptIntegration(tokens.refreshToken, `${provider}:${workspaceId}`), scopes: tokens.scopes, status: "connected", connected_by: userId, last_error: null, updated_at: new Date().toISOString() }, { onConflict: "workspace_id,provider" });
      if (error) throw new Error(`GMAIL_INTEGRATION_WRITE_FAILED:${error.message}`);
      await recordTeamActivity(backend.client, userId, "google.gmail_quotes.connected", "integration", provider, { name: email }); return redirect(res, "/?quotes-gmail=connected");
    }
    const context = await member(req); if (!context) return json(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." }); const current = await grant(context.workspaceId);
    if (url.pathname === "/api/quotes/gmail/status" && req.method === "GET") return json(res, 200, { configured: Boolean(config()), connected: Boolean(current), email: current?.provider_email, expectedEmail: expectedEmail(), lastSyncAt: current?.last_sync_at, error: current?.last_error });
    if (url.pathname === "/api/quotes/gmail/oauth/start" && req.method === "GET") { const oauthConfig = config(); if (!oauthConfig) return json(res, 503, { error: "Configura o OAuth e a chave de encriptação no servidor." }); return redirect(res, authUrl({ clientId: oauthConfig.clientId, redirectUri: oauthConfig.redirectUri, state: await states.create(context.user.id) })); }
    if (url.pathname === "/api/quotes/gmail/disconnect" && req.method === "POST") { if (current && config()) await new GoogleOAuthClient(config()!).revokeGrant(current.refreshToken).catch(() => false); await context.backend.client.from("workspace_integrations").update({ status: "revoked", encrypted_refresh_token: "", updated_at: new Date().toISOString() }).eq("workspace_id", context.workspaceId).eq("provider", provider); await recordTeamActivity(context.backend.client, context.user.id, "google.gmail_quotes.disconnected", "integration", provider); return json(res, 200, { disconnected: true }); }
    if (url.pathname === "/api/quotes/gmail/sync" && req.method === "POST") {
      if (!current || !config()) return json(res, 409, { error: "Liga primeiro o Gmail comercial partilhado." });
      try {
        const accessToken = await new GoogleOAuthClient(config()!).refreshAccessToken(current.refreshToken); const messages = await new GmailQuotesClient(accessToken).listCandidates(current.last_sync_at); const existing = await context.store.listRequests(context.user.id); let imported = 0;
        for (const message of messages) { if (existing.some((item) => item.gmailMessageId === message.messageId)) continue; const candidate = classifyGmailQuoteCandidate(message); if (!candidate) continue; const request = await context.store.createRequest(context.user.id, { ...candidate, source: "gmail", status: "new", gmailMessageId: message.messageId, gmailThreadId: message.threadId, gmailReceivedAt: message.receivedAt }); await recordTeamActivity(context.backend.client, context.user.id, "quote.request.imported", "quote_request", request.id, { name: request.companyName }); imported += 1; }
        const syncAt = new Date().toISOString(); await context.backend.client.from("workspace_integrations").update({ last_sync_at: syncAt, last_error: null, status: "connected", updated_at: syncAt }).eq("workspace_id", context.workspaceId).eq("provider", provider); return json(res, 200, { imported, lastSyncAt: syncAt });
      } catch (error) { const message = error instanceof Error ? error.message : "GMAIL_SYNC_FAILED"; await context.backend.client.from("workspace_integrations").update({ status: "error", last_error: message, updated_at: new Date().toISOString() }).eq("workspace_id", context.workspaceId).eq("provider", provider); throw error; }
    }
    return json(res, 404, { error: "Endpoint Gmail de orçamentos não encontrado." });
  } catch (error) { const message = error instanceof Error ? error.message : "GMAIL_QUOTES_FAILED"; console.error("[GMAIL QUOTES]", message); if (url.pathname.endsWith("/callback")) return redirect(res, "/?quotes-gmail=error&reason=oauth-failed"); return json(res, 500, { error: "Não foi possível concluir a operação do Gmail comercial." }); }
}
