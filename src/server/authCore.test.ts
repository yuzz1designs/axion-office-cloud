import assert from "node:assert/strict";
import test from "node:test";
import { attachDevice, createProfile, detectDevice, profileNeedsSetup, sanitizeProfileInput } from "./authCore";

test("cria perfil com email associado e AX KEY visível", () => {
  const profile = createProfile({ email: " Nelson@Example.com ", name: "Nelson", role: "Founder" }, () => "AX-TEST-123");
  assert.equal(profile.email, "nelson@example.com");
  assert.equal(profile.axKey, "AX-TEST-123");
  assert.equal(profile.focusMinutes, 0);
  assert.equal(profileNeedsSetup(profile), false);
});

test("perfil precisa de nome, função e email", () => {
  const profile = createProfile({ email: "", name: "", role: "" }, () => "AX-TEST-123");
  assert.equal(profileNeedsSetup(profile), true);
});

test("sanitiza edição sem trocar a AX KEY", () => {
  const profile = createProfile({ email: "nelson@example.com", name: "Nelson", role: "Founder" }, () => "AX-TEST-123");
  const updated = sanitizeProfileInput(profile, { name: " Nelson Afonso ", axKey: "AX-HACK" } as never);
  assert.equal(updated.name, "Nelson Afonso");
  assert.equal(updated.axKey, "AX-TEST-123");
});

test("reconhece o browser e sistema operativo do dispositivo atual", () => {
  const device = detectDevice({
    id: "device-1",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36",
    ipAddress: "127.0.0.1",
  }, new Date("2026-09-03T12:00:00.000Z"));

  assert.deepEqual(device, {
    id: "device-1",
    name: "Mac · Chrome",
    browser: "Chrome",
    operatingSystem: "macOS",
    ipAddress: "127.0.0.1",
    firstSeenAt: "2026-09-03T12:00:00.000Z",
    lastSeenAt: "2026-09-03T12:00:00.000Z",
  });
});

test("associa o dispositivo atual uma única vez e atualiza a última utilização", () => {
  const profile = createProfile({ email: "nelson@example.com", name: "Nelson", role: "Founder" }, () => "AX-TEST-123");
  const first = detectDevice({ id: "device-1", userAgent: "Mozilla/5.0 Chrome/140.0", ipAddress: "127.0.0.1" }, new Date("2026-09-03T12:00:00.000Z"));
  const second = detectDevice({ id: "device-1", userAgent: "Mozilla/5.0 Chrome/140.0", ipAddress: "127.0.0.1" }, new Date("2026-09-04T12:00:00.000Z"));

  const updated = attachDevice(attachDevice(profile, first), second);

  assert.equal(updated.devices.length, 1);
  assert.equal(updated.devices[0].lastSeenAt, "2026-09-04T12:00:00.000Z");
});
