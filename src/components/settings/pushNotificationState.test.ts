import assert from "node:assert/strict";
import test from "node:test";
import { getPushDeviceState, requiresAppleHomeScreen } from "./pushNotificationState";

test("distingue permissão, subscription do browser e associação no servidor", () => {
  assert.equal(getPushDeviceState({ supported: false, permission: "default", browserSubscribed: false, serverSubscribed: false }), "unsupported");
  assert.equal(getPushDeviceState({ supported: true, permission: "denied", browserSubscribed: false, serverSubscribed: false }), "blocked");
  assert.equal(getPushDeviceState({ supported: true, permission: "granted", browserSubscribed: true, serverSubscribed: false }), "incomplete");
  assert.equal(getPushDeviceState({ supported: true, permission: "granted", browserSubscribed: true, serverSubscribed: true }), "active");
});

test("iOS exige abertura pelo ícone instalado", () => {
  assert.equal(requiresAppleHomeScreen(true, false), true);
  assert.equal(requiresAppleHomeScreen(true, true), false);
  assert.equal(requiresAppleHomeScreen(false, false), false);
});
