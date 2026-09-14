import assert from "node:assert/strict";
import test from "node:test";
import { executeAivaToolCall } from "./aivaActionRegistry";

test("navigation uses the registered React host", async () => {
  let destination = "";
  const result = await executeAivaToolCall(
    { id: "1", name: "navigate_to_section", arguments: { section: "documents" } },
    { navigate: (section) => { destination = section; } },
  );
  assert.equal(destination, "documents");
  assert.equal(result.ok, true);
});

test("opening a client passes its query to the host", async () => {
  let query = "";
  const result = await executeAivaToolCall(
    { id: "2", name: "open_client", arguments: { query: "Acme" } },
    { navigate: () => undefined, openClient: (value) => { query = value; } },
  );
  assert.equal(query, "Acme");
  assert.equal(result.ok, true);
});

test("a financial settlement uses the payment expected date after confirmation", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "/api/finance") return new Response(JSON.stringify({ payments: [{ id: "pay-1", nextChargeDate: "2026-09-12" }] }), { status: 200 });
    return new Response(JSON.stringify({ transaction: { id: "tx-1" } }), { status: 200 });
  };
  const result = await executeAivaToolCall(
    { id: "3", name: "mark_payment_paid", arguments: { paymentId: "pay-1", actualAmount: 19.99 } },
    { navigate: () => undefined, confirm: () => true, fetch: fetchMock as typeof fetch },
  );
  assert.equal(result.ok, true);
  assert.equal(requests[1].url, "/api/finance/payments/pay-1/mark-paid");
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), { expectedDate: "2026-09-12", actualAmount: 19.99 });
});

test("closing the active window shows a specific confirmation before execution", async () => {
  let question = "";
  const requests: string[] = [];
  const result = await executeAivaToolCall(
    { id: "4", name: "computer_close_window", arguments: { application: "Safari" } },
    {
      navigate: () => undefined,
      brain: "mark-ii",
      confirm: (message) => { question = message; return true; },
      fetch: (async (input: string | URL | Request) => {
        const url = String(input); requests.push(url);
        return new Response(JSON.stringify(url.endsWith("/approve") ? { approval: "approved" } : { executed: true }), { status: 200 });
      }) as typeof fetch,
    },
  );
  assert.match(question, /Fechar o separador, janela, pasta ou documento ativo/);
  assert.deepEqual(requests, ["/api/aiva/tool", "/api/aiva/desktop/approve", "/api/aiva/tool"]);
  assert.equal(result.ok, true);
});
