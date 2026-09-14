import assert from "node:assert/strict";
import test from "node:test";
import { canReuseSupabaseBackend } from "./supabaseBackend";

test("não reutiliza o cliente Supabase quando a service role key muda", () => {
  assert.equal(canReuseSupabaseBackend({ url: "https://axion.supabase.co", serviceRoleKey: "old" }, { url: "https://axion.supabase.co", serviceRoleKey: "new" }), false);
  assert.equal(canReuseSupabaseBackend({ url: "https://axion.supabase.co", serviceRoleKey: "same" }, { url: "https://axion.supabase.co", serviceRoleKey: "same" }), true);
});
