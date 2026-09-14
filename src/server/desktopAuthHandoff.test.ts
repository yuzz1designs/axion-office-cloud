import assert from "node:assert/strict";
import test from "node:test";
import { DesktopAuthHandoffStore } from "./desktopAuthHandoff";

test("desktop auth handoff is pending until completion and can only be consumed once", () => {
  const store = new DesktopAuthHandoffStore();
  const state = store.start();
  assert.equal(store.pendingState(), state);
  assert.equal(store.consume(state), "pending");
  assert.equal(store.complete(state, { ok: true, accessToken: "access", refreshToken: "refresh" }), true);
  assert.deepEqual(store.consume(state), { ok: true, accessToken: "access", refreshToken: "refresh" });
  assert.equal(store.consume(state), null);
  assert.equal(store.pendingState(), null);
});

test("desktop auth handoff rejects unknown, duplicate and expired states", () => {
  let now = 100;
  const store = new DesktopAuthHandoffStore(50, () => now);
  assert.equal(store.complete("unknown", { ok: false, error: "denied" }), false);
  const state = store.start();
  assert.equal(store.complete(state, { ok: false, error: "denied" }), true);
  assert.equal(store.complete(state, { ok: false, error: "again" }), false);
  now = 151;
  assert.equal(store.consume(state), null);
});

test("starting a new desktop login invalidates the previous request", () => {
  const store = new DesktopAuthHandoffStore();
  const first = store.start();
  const second = store.start();
  assert.notEqual(first, second);
  assert.equal(store.consume(first), null);
  assert.equal(store.pendingState(), second);
});
