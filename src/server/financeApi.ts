import type { IncomingMessage, ServerResponse } from "node:http";
import { getAllowedEmails } from "./supabaseConfig";
import { getSupabaseBackend } from "./supabaseBackend";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { SupabaseFinanceStore } from "./supabaseFinanceStore";
import { recordTeamActivity } from "./teamActivityStore";

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

function publicError(error: unknown) {
  const message = error instanceof Error ? error.message : "FINANCE_UNKNOWN_ERROR";
  if (message.includes("NOT_FOUND")) return { status: 404, message: "Pagamento não encontrado." };
  if (message.includes("ALREADY_ADVANCED") || message.includes("ALREADY_RECEIVED")) return { status: 409, message: "Este pagamento já foi processado. Atualiza a página." };
  if (message.includes("INVALID") || message.includes("obrigatóri") || message.includes("inválid")) {
    return { status: 400, message: message.replace(/^FINANCE_[A-Z_]+:?/, "") || "Dados inválidos." };
  }
  return { status: 500, message: "Não foi possível processar o pedido financeiro." };
}

export async function handleFinanceApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/finance")) return next();

  try {
    const backend = getSupabaseBackend();
    if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    const store = new SupabaseFinanceStore(backend.client);

    if (url.pathname === "/api/finance" && req.method === "GET") {
      return sendJson(res, 200, await store.load(user.id));
    }

    if (url.pathname === "/api/finance/payments" && req.method === "POST") {
      const body = await readJson(req) as Record<string, unknown>;
      const result = await store.create(user.id, body);
      await recordTeamActivity(backend.client, user.id, "finance.payment.created", "payment", null, { name: body.name });
      return sendJson(res, 201, result);
    }

    if (url.pathname === "/api/finance/revenue" && req.method === "POST") {
      const body = await readJson(req) as Record<string, unknown>;
      const result = await store.createRevenue(user.id, body);
      await recordTeamActivity(backend.client, user.id, "finance.revenue.created", "revenue", null, { name: body.description });
      return sendJson(res, 201, result);
    }

    const revenueMatch = /^\/api\/finance\/revenue\/([^/]+)(\/mark-received)?$/.exec(url.pathname);
    if (revenueMatch && req.method === "PATCH" && !revenueMatch[2]) {
      const body = await readJson(req) as Record<string, unknown>;
      const revenueId = decodeURIComponent(revenueMatch[1]);
      const result = await store.updateRevenue(user.id, revenueId, body);
      await recordTeamActivity(backend.client, user.id, "finance.revenue.updated", "revenue", revenueId, { name: body.description });
      return sendJson(res, 200, result);
    }
    if (revenueMatch && req.method === "DELETE" && !revenueMatch[2]) {
      const revenueId = decodeURIComponent(revenueMatch[1]);
      const current = await store.load(user.id);
      const name = current.revenues.find((entry) => entry.id === revenueId)?.description;
      const result = await store.removeRevenue(user.id, revenueId);
      await recordTeamActivity(backend.client, user.id, "finance.revenue.deleted", "revenue", revenueId, { name });
      return sendJson(res, 200, result);
    }
    if (revenueMatch && req.method === "POST" && revenueMatch[2]) {
      const body = await readJson(req) as { actualAmount?: number; receivedAt?: string };
      const revenueId = decodeURIComponent(revenueMatch[1]);
      const current = await store.load(user.id);
      const name = current.revenues.find((entry) => entry.id === revenueId)?.description;
      const result = await store.markRevenueReceived(user.id, revenueId, Number(body.actualAmount), body.receivedAt);
      await recordTeamActivity(backend.client, user.id, "finance.revenue.received", "revenue", revenueId, { name, amount: body.actualAmount });
      return sendJson(res, 200, result);
    }

    const match = /^\/api\/finance\/payments\/([^/]+)(\/mark-paid)?$/.exec(url.pathname);
    if (match && req.method === "PATCH" && !match[2]) {
      const body = await readJson(req) as Record<string, unknown>;
      const result = await store.update(user.id, decodeURIComponent(match[1]), body);
      await recordTeamActivity(backend.client, user.id, "finance.payment.updated", "payment", decodeURIComponent(match[1]), { name: body.name });
      return sendJson(res, 200, result);
    }
    if (match && req.method === "DELETE" && !match[2]) {
      const paymentId = decodeURIComponent(match[1]);
      const current = await store.load(user.id);
      const name = current.payments.find((payment) => payment.id === paymentId)?.name;
      const result = await store.remove(user.id, paymentId);
      await recordTeamActivity(backend.client, user.id, "finance.payment.deleted", "payment", paymentId, { name });
      return sendJson(res, 200, result);
    }
    if (match && req.method === "POST" && match[2]) {
      const body = await readJson(req) as { expectedDate?: string; actualAmount?: number; notes?: string };
      if (!body.expectedDate) return sendJson(res, 400, { error: "A data prevista é obrigatória." });
      const paymentId = decodeURIComponent(match[1]);
      const current = await store.load(user.id);
      const name = current.payments.find((payment) => payment.id === paymentId)?.name;
      const result = await store.markPaid(
        user.id,
        paymentId,
        body.expectedDate,
        body.actualAmount,
        body.notes,
      );
      await recordTeamActivity(backend.client, user.id, "finance.payment.paid", "payment", paymentId, { name, amount: body.actualAmount });
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    const output = publicError(error);
    return sendJson(res, output.status, { error: output.message });
  }
}
