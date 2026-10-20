import assert from "node:assert/strict";
import test from "node:test";
import { createRefreshQueue } from "./refreshQueue";

test("realtime bursts produce one refresh and at most one pending batch", async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, release!: () => void;
  const queue = createRefreshQueue(async () => { calls++; if (calls === 1) await new Promise<void>((resolve) => { release = resolve; }); });
  for (let i = 0; i < 30; i++) queue.schedule();
  t.mock.timers.tick(300); assert.equal(calls, 1);
  for (let i = 0; i < 30; i++) queue.schedule();
  t.mock.timers.tick(300); assert.equal(calls, 1);
  release(); await Promise.resolve(); await Promise.resolve();
  t.mock.timers.tick(300); assert.equal(calls, 2); queue.stop();
});

test("unmount cancels scheduled refreshes", (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let calls = 0;
  const queue = createRefreshQueue(async () => { calls++; }); queue.schedule(); queue.stop();
  t.mock.timers.tick(1000); assert.equal(calls, 0);
});
