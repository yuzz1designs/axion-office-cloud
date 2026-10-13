import assert from "node:assert/strict";
import test from "node:test";
import { isExpiredPushStatus, normalizePushSubscription, teamUpdatePushEventKey, validatePushDeviceId } from "./pushNotificationCore";

test("valida uma subscription Web Push e o dispositivo", () => {
  const subscription = normalizePushSubscription({ endpoint: "https://push.example/subscription/123", keys: { p256dh: "p".repeat(65), auth: "a".repeat(16) } });
  assert.equal(subscription.endpoint, "https://push.example/subscription/123");
  assert.equal(validatePushDeviceId("device-12345678"), "device-12345678");
});

test("rejeita endpoints e dispositivos inválidos", () => {
  assert.throws(() => normalizePushSubscription({ endpoint: "http://unsafe", keys: {} }), /INVALID/);
  assert.throws(() => validatePushDeviceId("short"), /INVALID/);
});

test("gera uma chave idempotente e reconhece subscriptions expiradas", () => {
  assert.equal(teamUpdatePushEventKey("update-1"), "team-update:update-1");
  assert.equal(isExpiredPushStatus(404), true);
  assert.equal(isExpiredPushStatus(410), true);
  assert.equal(isExpiredPushStatus(500), false);
});
