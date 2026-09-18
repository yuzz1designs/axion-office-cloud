import assert from "node:assert/strict";
import test from "node:test";
import { isOfficeMemberOnline, officeSessionTime } from "./officePresence";

const now = Date.parse("2026-09-18T12:00:00Z");
const member = { userId: "one", name: "Nelson", startedAt: "2026-09-18T10:58:59Z", lastSeenAt: "2026-09-18T11:59:45Z" };

test("session time uses server start, surviving page refresh", () => {
  assert.equal(officeSessionTime(member, now), "01:01:01");
  assert.equal(officeSessionTime(member, now + 10_000), "01:01:11");
});
test("missing or stale heartbeat cannot display online or an increasing timer", () => {
  assert.equal(isOfficeMemberOnline(member, now + 106_000), false);
  assert.equal(officeSessionTime(member, now + 106_000), null);
  assert.equal(isOfficeMemberOnline({ ...member, lastSeenAt: null }, now), false);
  assert.equal(isOfficeMemberOnline({ ...member, lastSeenAt: "invalid" }, now), false);
  assert.equal(officeSessionTime({ ...member, startedAt: null }, now), null);
});
test("clock skew cannot produce a negative session duration", () => {
  assert.equal(officeSessionTime({ ...member, startedAt: new Date(now + 1000).toISOString() }, now), "00:00:00");
});
