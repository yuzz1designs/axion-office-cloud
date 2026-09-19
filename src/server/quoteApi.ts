import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { QuoteStore } from "./quoteStore";
import { recordTeamActivity } from "./teamActivityStore";

function json(res: ServerResponse, status: number, body: unknown) { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); }
async function body(req: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += value.length; if (size > 2_000_000) throw new Error("QUOTE_PAYLOAD_TOO_LARGE"); chunks.push(value); } return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }

export async function handleQuoteApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/quotes")) return next();
  try {
    const backend = getSupabaseBackend(); if (!backend) return json(res, 503, { error: "Supabase ainda não está configurado." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return json(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    const store = new QuoteStore(backend.client);
    if (url.pathname === "/api/quotes" && req.method === "GET") return json(res, 200, { requests: await store.listRequests(user.id), quotes: await store.listQuotes(user.id), services: await store.listServices(user.id) });
    if (url.pathname === "/api/quotes" && req.method === "POST") { const quote = await store.createQuote(user.id, await body(req)); await recordTeamActivity(backend.client, user.id, "quote.created", "quote", quote.id, { name: quote.reference }); return json(res, 201, { quote }); }
    if (url.pathname === "/api/quotes/requests" && req.method === "POST") { const request = await store.createRequest(user.id, await body(req)); await recordTeamActivity(backend.client, user.id, "quote.request.created", "quote_request", request.id, { name: request.companyName }); return json(res, 201, { request }); }
    if (url.pathname === "/api/quotes/services" && req.method === "POST") return json(res, 201, { service: await store.saveService(user.id, await body(req)) });
    const requestMatch = /^\/api\/quotes\/requests\/([^/]+)$/.exec(url.pathname);
    if (requestMatch && req.method === "PUT") { const request = await store.updateRequest(user.id, decodeURIComponent(requestMatch[1]), await body(req)); return json(res, 200, { request }); }
    const convertMatch = /^\/api\/quotes\/requests\/([^/]+)\/convert$/.exec(url.pathname);
    if (convertMatch && req.method === "POST") { const input = await body(req); const request = (await store.listRequests(user.id)).find((item) => item.id === decodeURIComponent(convertMatch[1])); if (!request) throw new Error("QUOTE_REQUEST_NOT_FOUND"); const quote = await store.createQuote(user.id, { companyName: request.companyName, contactName: request.contactName, contactEmail: request.contactEmail, title: input.title || request.subject || `Proposta para ${request.companyName}`, summary: request.requestSummary, currency: "EUR", requestId: request.id, clientId: request.clientId, ownerUserId: request.ownerUserId, validUntil: input.validUntil, paymentTerms: "", clientNotes: "", internalNotes: request.notes, items: input.items || [], adjustments: [] }); await recordTeamActivity(backend.client, user.id, "quote.created", "quote", quote.id, { name: quote.reference }); return json(res, 201, { quote }); }
    const statusMatch = /^\/api\/quotes\/([^/]+)\/status$/.exec(url.pathname);
    if (statusMatch && req.method === "POST") { const input = await body(req); const quote = await store.changeStatus(user.id, decodeURIComponent(statusMatch[1]), input.status); await recordTeamActivity(backend.client, user.id, `quote.${quote.status}`, "quote", quote.id, { name: quote.reference }); return json(res, 200, { quote }); }
    const duplicateMatch = /^\/api\/quotes\/([^/]+)\/duplicate$/.exec(url.pathname);
    if (duplicateMatch && req.method === "POST") { const quote = await store.duplicate(user.id, decodeURIComponent(duplicateMatch[1])); await recordTeamActivity(backend.client, user.id, "quote.created", "quote", quote.id, { name: quote.reference }); return json(res, 201, { quote }); }
    const serviceMatch = /^\/api\/quotes\/services\/([^/]+)$/.exec(url.pathname);
    if (serviceMatch && req.method === "PUT") return json(res, 200, { service: await store.saveService(user.id, await body(req), decodeURIComponent(serviceMatch[1])) });
    if (serviceMatch && req.method === "DELETE") { await store.removeService(user.id, decodeURIComponent(serviceMatch[1])); return json(res, 200, { deleted: true }); }
    const quoteMatch = /^\/api\/quotes\/([^/]+)$/.exec(url.pathname);
    if (quoteMatch && req.method === "GET") return json(res, 200, { quote: await store.getQuote(user.id, decodeURIComponent(quoteMatch[1])) });
    if (quoteMatch && req.method === "PUT") { const quote = await store.updateQuote(user.id, decodeURIComponent(quoteMatch[1]), await body(req)); await recordTeamActivity(backend.client, user.id, "quote.updated", "quote", quote.id, { name: quote.reference }); return json(res, 200, { quote }); }
    if (quoteMatch && req.method === "DELETE") { await store.remove(user.id, decodeURIComponent(quoteMatch[1])); return json(res, 200, { deleted: true }); }
    return json(res, 404, { error: "Endpoint de orçamentos não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QUOTE_UNKNOWN_ERROR";
    const status = message.includes("NOT_FOUND") ? 404 : message.includes("obrigat") || message.includes("inválid") || message.includes("Seleciona") || message.includes("Apenas") || message.includes("Só podes") ? 400 : message.includes("TOO_LARGE") ? 413 : 500;
    console.error("[QUOTES]", message);
    return json(res, status, { error: status === 500 ? "Não foi possível concluir a operação de orçamentos." : message.replace(/^QUOTE_[A-Z_]+:?/, "") });
  }
}
