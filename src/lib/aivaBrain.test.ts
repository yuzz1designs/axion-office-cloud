import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAivaBrain } from "./aivaBrain";

test("normalizes unsupported brains to Mark I", () => {
  assert.equal(normalizeAivaBrain("mark-ii"), "mark-ii");
  assert.equal(normalizeAivaBrain("unknown"), "mark-i");
});
