import test from "node:test";
import assert from "node:assert/strict";
import { detectAxionRuntime } from "./runtime";

test("distingue explicitamente Web e Desktop", () => {
  assert.equal(detectAxionRuntime({ search: "" } as Location), "web");
  assert.equal(detectAxionRuntime({ search: "?axion-desktop=1" } as Location), "desktop");
});
