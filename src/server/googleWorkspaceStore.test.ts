import assert from "node:assert/strict";
import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GoogleWorkspaceStore } from "./googleWorkspaceStore";

test("isola ligações Calendar e Tasks por perfil", () => {
  const directory = mkdtempSync(join(tmpdir(), "axion-workspace-"));
  const store = new GoogleWorkspaceStore(directory);
  store.writeGrant("profile-1", { refreshToken: "secret-1", email: "nelson@example.com", scopes: ["calendar", "tasks"], connectedAt: "2026-09-03T12:00:00.000Z" });
  store.writeGrant("profile-2", { refreshToken: "secret-2", email: "sousa@example.com", scopes: ["calendar", "tasks"], connectedAt: "2026-09-03T12:00:00.000Z" });

  assert.equal(store.read("profile-1")?.grant.email, "nelson@example.com");
  assert.equal(store.read("profile-2")?.grant.email, "sousa@example.com");
  assert.equal(statSync(join(directory, "google-workspace.json")).mode & 0o777, 0o600);
});

test("guarda cache, lista AXION OFFICE, sync token e foco sem apagar o grant", () => {
  const directory = mkdtempSync(join(tmpdir(), "axion-workspace-"));
  const store = new GoogleWorkspaceStore(directory);
  store.writeGrant("profile-1", { refreshToken: "secret", email: "nelson@example.com", scopes: [], connectedAt: "2026-09-03T12:00:00.000Z" });
  store.update("profile-1", {
    taskListId: "list-1",
    calendarSyncToken: "sync-1",
    events: [{ id: "event-1" } as never],
    tasks: [{ id: "task-1" } as never],
    focus: { totalMinutes: 30, completedTaskMinutes: { "task-1": 30 } },
  });

  const state = store.read("profile-1");
  assert.equal(state?.grant.refreshToken, "secret");
  assert.equal(state?.taskListId, "list-1");
  assert.equal(state?.calendarSyncToken, "sync-1");
  assert.equal(state?.focus.totalMinutes, 30);
});
