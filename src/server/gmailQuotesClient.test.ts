import assert from "node:assert/strict";
import test from "node:test";
import { GmailQuotesClient, classifyGmailQuoteCandidate } from "./gmailQuotesClient";
const message = (subject: string, body: string, from = "Cliente <cliente@example.com>") => ({ messageId: "m1", threadId: "t1", receivedAt: "2026-09-19T00:00:00Z", from, subject, body });
test("classifica pedidos comerciais sem inventar campos", () => { const result = classifyGmailQuoteCandidate(message("Pedido de orçamento", "Precisamos de um website")); assert.equal(result?.contactEmail, "cliente@example.com"); assert.match(result?.requestSummary || "", /website/); });
test("exclui newsletters e mensagens sem intenção comercial", () => { assert.equal(classifyGmailQuoteCandidate(message("Newsletter", "Novidades de marketing", "no-reply@example.com")), null); assert.equal(classifyGmailQuoteCandidate(message("Olá", "Obrigado pela reunião")), null); });

test("default fetch preserves the Worker global receiver for Gmail", async (t) => {
  t.mock.method(globalThis, "fetch", async function (this: unknown, input: string | URL | Request) {
    assert.equal(this, globalThis);
    assert.match(String(input), /maxResults=20/);
    return new Response(JSON.stringify({ messages: [] }));
  });
  assert.deepEqual(await new GmailQuotesClient("access").listCandidates(), []);
});
