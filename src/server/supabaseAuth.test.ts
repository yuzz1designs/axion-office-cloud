import assert from "node:assert/strict";
import test from "node:test";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";

test("lê a sessão Supabase do cookie HttpOnly", () => {
  assert.equal(readSessionToken("other=x; axion_session=jwt-token; theme=dark"), "jwt-token");
});

test("aceita apenas utilizadores Google presentes na allowlist", async () => {
  const auth = { getUser: async () => ({ data: { user: { id: "user-1", email: "nelson@example.com", app_metadata: { provider: "google" } } }, error: null }) };
  const user = await authenticateSupabaseUser("token", auth, ["nelson@example.com"]);
  assert.equal(user?.id, "user-1");
  assert.equal(await authenticateSupabaseUser("token", auth, ["sousa@example.com"]), null);
});

test("temporary auth outages do not become invalid sessions", async () => {
  for (const status of [0, 429, 500, 503]) {
    const auth = { getUser: async () => ({ data: { user: null }, error: { status } }) };
    await assert.rejects(authenticateSupabaseUser("token", auth, ["nelson@example.com"]), /AUTH_SERVICE_UNAVAILABLE/);
  }
});

test("expired or revoked credentials remain unauthorized", async () => {
  for (const status of [400, 401, 403, 422]) {
    const auth = { getUser: async () => ({ data: { user: null }, error: { status } }) };
    assert.equal(await authenticateSupabaseUser("token", auth, ["nelson@example.com"]), null);
  }
});
