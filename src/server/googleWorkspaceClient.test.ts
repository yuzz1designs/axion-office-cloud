import assert from "node:assert/strict";
import test from "node:test";
import { GoogleWorkspaceClient } from "./googleWorkspaceClient";

test("reutiliza a lista AXION OFFICE sem criar duplicado", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method || "GET" });
    return new Response(JSON.stringify({ items: [{ id: "list-axion", title: "AXION OFFICE" }] }), { status: 200 });
  };
  const client = new GoogleWorkspaceClient("access-token", fakeFetch);

  assert.equal(await client.ensureAxionTaskList(), "list-axion");
  assert.deepEqual(calls.map((call) => call.method), ["GET"]);
});

test("cria a lista AXION OFFICE quando ainda não existe", async () => {
  const responses = [
    new Response(JSON.stringify({ items: [] }), { status: 200 }),
    new Response(JSON.stringify({ id: "new-list", title: "AXION OFFICE" }), { status: 200 }),
  ];
  const fakeFetch: typeof fetch = async () => responses.shift()!;
  const client = new GoogleWorkspaceClient("access-token", fakeFetch);
  assert.equal(await client.ensureAxionTaskList(), "new-list");
});
