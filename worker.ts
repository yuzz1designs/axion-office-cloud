import { createServer } from "node:http";
import { handleAsNodeRequest } from "cloudflare:node";
import { handleAuthApi } from "./src/server/authApi";
import { handleFinanceApi } from "./src/server/financeApi";
import { handleMeetingApi } from "./src/server/meetingApi";
import { handleClientApi } from "./src/server/clientApi";
import { handleNotificationApi } from "./src/server/notificationApi";
import { handleTeamActivityApi } from "./src/server/teamActivityApi";
import { handleGoogleOAuthApi } from "./src/server/googleOAuthApi";
import { handleGoogleWorkspaceApi } from "./src/server/googleWorkspaceApi";
import { handleGoogleDriveApi } from "./src/server/googleDriveApi";
import { handleGoogleSheetsApi } from "./src/server/googleSheetsApi";
import { handleOfficePresenceApi } from "./src/server/officePresenceApi";
import { handleQuoteApi } from "./src/server/quoteApi";
import { handleGmailQuotesApi } from "./src/server/gmailQuotesApi";

const handlers = [handleOfficePresenceApi, handleAuthApi, handleFinanceApi, handleMeetingApi, handleClientApi, handleGmailQuotesApi, handleQuoteApi, handleNotificationApi, handleTeamActivityApi, handleGoogleOAuthApi, handleGoogleWorkspaceApi, handleGoogleDriveApi, handleGoogleSheetsApi];
const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    for (const handler of handlers) {
      let next = false;
      await handler(req, res, () => { next = true; });
      if (!next) return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Endpoint não encontrado." }));
  } catch {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Não foi possível concluir o pedido." }));
  }
});
server.listen(8080);

export default {
  async fetch(request: Request, env: { ASSETS: { fetch(request: Request): Promise<Response> } }) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (url.pathname.startsWith("/api/aiva/")) return Response.json({ error: "AIVA desativada nesta versão web.", code: "AIVA_DISABLED" }, { status: 503 });
    if (url.pathname === "/api/auth/desktop/pending") return Response.json({ state: null });
    if (url.pathname.startsWith("/api/auth/desktop/")) return Response.json({ error: "Desktop em pausa." }, { status: 410 });
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_PUBLISHABLE_KEY) {
      return Response.json({ error: "Configura o Supabase nas variáveis do Worker.", code: "SUPABASE_NOT_CONFIGURED" }, { status: 503 });
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return Response.json({ error: "Origem não autorizada." }, { status: 403 });
    return handleAsNodeRequest(8080, request);
  },
};
