import assert from "node:assert/strict";
import test from "node:test";
import { createSessionFetch } from "./sessionFetch";
const origin = "https://office.example";

test("concurrent expired requests share one renewal, including late 401 responses", async () => {
  let valid = false, renewals = 0, requests = 0;
  let releaseLate!: () => void;
  const late = new Promise<void>((resolve) => { releaseLate = resolve; });
  const native = (async (input: Request) => {
    requests++; const authorized = valid;
    if (input.url.endsWith('/late') && !authorized) await late;
    return Response.json({}, { status: authorized ? 200 : 401 });
  }) as typeof fetch;
  const request = createSessionFetch(native, async () => { renewals++; await Promise.resolve(); valid = true; return true; }, origin);
  const slow = request(origin + '/api/late');
  const fast = await Promise.all(Array.from({ length: 10 }, () => request(origin + '/api/tasks')));
  releaseLate(); assert.equal((await slow).status, 200);
  assert(fast.every((response) => response.ok)); assert.equal(renewals, 1); assert.equal(requests, 22);
});

test("a rejected mutation is replayed once with its original body and headers", async () => {
  const bodies: string[] = [];
  const native = (async (input: Request) => {
    assert.equal(input.method, 'POST'); assert.equal(input.headers.get('X-File-Name'), 'photo.png');
    bodies.push(await input.text()); return Response.json({}, { status: bodies.length === 1 ? 401 : 200 });
  }) as typeof fetch;
  const request = createSessionFetch(native, async () => true, origin);
  const response = await request(new Request(origin + '/api/upload', { method: 'POST', headers: { 'X-File-Name': 'photo.png' }, body: 'binary-data' }));
  assert.equal(response.status, 200); assert.deepEqual(bodies, ['binary-data', 'binary-data']);
});

test("server/network failures and public/auth endpoints never retry mutations", async () => {
  let renewals = 0, calls = 0;
  const request = createSessionFetch((async () => { calls++; return Response.json({}, { status: 503 }); }) as typeof fetch, async () => { renewals++; return true; }, origin);
  assert.equal((await request(origin + '/api/tasks', { method: 'POST', body: '{}' })).status, 503);
  const rejected = createSessionFetch((async () => Response.json({}, { status: 401 })) as typeof fetch, async () => { renewals++; return true; }, origin);
  await rejected('https://other.example/api/tasks'); await rejected(origin + '/api/auth/session');
  assert.equal(calls, 1); assert.equal(renewals, 0);
});

test("profile status repairs an expired server cookie before presenting a login", async () => {
  let calls = 0;
  const request = createSessionFetch((async () => Response.json({ authRequired: ++calls === 1 })) as typeof fetch, async () => true, origin);
  assert.equal((await (await request(origin + '/api/profile/status')).json()).authRequired, false);
  assert.equal(calls, 2);
});

test("failed recovery and repeated rejection terminate without an infinite loop", async () => {
  for (const outcome of [false, true]) {
    let calls = 0;
    const request = createSessionFetch((async () => { calls++; return new Response(null, { status: 401 }); }) as typeof fetch, async () => outcome, origin);
    assert.equal((await request(origin + '/api/tasks')).status, 401);
    assert.equal(calls, outcome ? 2 : 1);
  }
});

test("a caller that aborts during renewal is not replayed", async () => {
  const controller = new AbortController(); let calls = 0;
  const request = createSessionFetch((async () => { calls++; return new Response(null, { status: 401 }); }) as typeof fetch, async () => { controller.abort(); return true; }, origin);
  await request(origin + '/api/tasks', { signal: controller.signal }); assert.equal(calls, 1);
});
