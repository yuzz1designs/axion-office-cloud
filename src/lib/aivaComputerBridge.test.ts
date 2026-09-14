import assert from "node:assert/strict";
import test from "node:test";
import { createUnavailableComputerBridge } from "./aivaComputerBridge";

test("computer control stays unavailable until a trusted Desktop Companion connects", async () => {
  const bridge = createUnavailableComputerBridge();
  assert.equal(bridge.available, false);
  await assert.rejects(() => bridge.execute({ capability: "get_battery_status", target: "" }), /AIVA_DESKTOP_COMPANION_REQUIRED/);
});
