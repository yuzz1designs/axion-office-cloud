import assert from "node:assert/strict";
import test from "node:test";
import { AivaRateLimiter } from "./aivaRateLimit";

test("limits repeated expensive requests per user and window", () => {
  const limiter = new AivaRateLimiter(1_000);
  assert.equal(limiter.consume("user:speech", 2, 0), true);
  assert.equal(limiter.consume("user:speech", 2, 10), true);
  assert.equal(limiter.consume("user:speech", 2, 20), false);
  assert.equal(limiter.consume("user:speech", 2, 1_001), true);
});
