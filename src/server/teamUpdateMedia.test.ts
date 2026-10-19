import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteTeamUpdateMedia } from "./teamUpdateStore";

function mockClient({ owner = true, asset = true, deleteFails = false } = {}) {
  const queries: { table: string; action: string; filters: Record<string, unknown> }[] = [];
  const removed: string[][] = [];
  const client = {
    from(table: string) {
      const query = { table, action: "select", filters: {} as Record<string, unknown> };
      queries.push(query);
      const result = () => ({
        data: table === "workspace_members" ? { workspace_id: "workspace-1" }
          : table === "team_updates" ? (owner ? { id: "update-1" } : null)
            : asset ? { id: "media-1", container: "attachments", object_id: "workspace-1/updates/update-1/image.png" } : null,
        error: table === "file_assets" && query.action === "delete" && deleteFails ? { message: "offline" } : null,
      });
      const chain = {
        select() { return chain; },
        eq(key: string, value: unknown) { query.filters[key] = value; return chain; },
        delete() { query.action = "delete"; return chain; },
        update() { query.action = "update"; return chain; },
        single: async () => result(),
        maybeSingle: async () => result(),
        then(resolve: (value: unknown) => unknown) { return Promise.resolve(result()).then(resolve); },
      };
      return chain;
    },
    storage: { from: () => ({ remove: async (paths: string[]) => { removed.push(paths); return { error: null }; } }) },
  } as unknown as SupabaseClient;
  return { client, queries, removed };
}

test("only the update author can remove an attachment", async () => {
  const mock = mockClient({ owner: false });
  await assert.rejects(deleteTeamUpdateMedia(mock.client, "other-user", "update-1", "media-1"), /NOT_FOUND/);
  assert.equal(mock.queries.some((query) => query.table === "file_assets"), false);
  assert.equal(mock.queries[1].filters.author_user_id, "other-user");
  assert.deepEqual(mock.removed, []);
});

test("attachment deletion is scoped to the workspace and update and preserves read receipts", async () => {
  const mock = mockClient();
  await deleteTeamUpdateMedia(mock.client, "author", "update-1", "media-1");
  const deletion = mock.queries.find((query) => query.action === "delete")!;
  assert.deepEqual(deletion.filters, { id: "media-1", workspace_id: "workspace-1", entity_type: "team_update", entity_id: "update-1" });
  assert.deepEqual(mock.removed, [["workspace-1/updates/update-1/image.png"]]);
  assert.equal(mock.queries.some((query) => query.table === "team_update_reads"), false);
});

test("missing attachments can be removed again safely", async () => {
  const mock = mockClient({ asset: false });
  await deleteTeamUpdateMedia(mock.client, "author", "update-1", "missing-media");
  assert.equal(mock.queries.some((query) => query.action === "delete"), false);
  assert.deepEqual(mock.removed, []);
});

test("metadata failure leaves stored media intact", async () => {
  const mock = mockClient({ deleteFails: true });
  await assert.rejects(deleteTeamUpdateMedia(mock.client, "author", "update-1", "media-1"), /DELETE_FAILED/);
  assert.deepEqual(mock.removed, []);
});
