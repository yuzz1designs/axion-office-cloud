import assert from "node:assert/strict";
import test from "node:test";
import { getAllowedEmails, getSupabaseServerConfig, isAllowedEmail } from "./supabaseConfig";

test("Supabase só fica configurado com URL e service role key", () => {
  assert.equal(getSupabaseServerConfig({ SUPABASE_URL: "https://axion.supabase.co" }), null);
  assert.deepEqual(getSupabaseServerConfig({
    SUPABASE_URL: "https://axion.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "secret",
  }), { url: "https://axion.supabase.co", serviceRoleKey: "secret" });
});

test("allowlist normaliza emails e inclui Nelson e Sousa", () => {
  const emails = getAllowedEmails({ AXION_ALLOWED_EMAILS: " NELSON@example.com, sousa@example.com " });
  assert.deepEqual(emails, ["nelsonafonsoprofissional@gmail.com", "eduardo04ssousa@gmail.com", "joaotpsilva.pro@gmail.com", "nelson@example.com", "sousa@example.com"]);
  assert.equal(isAllowedEmail("NELSON@example.com", emails), true);
  assert.equal(isAllowedEmail("intruso@example.com", emails), false);
});

test("allowlist AXION inclui os três sócios por omissão", () => {
  assert.equal(isAllowedEmail("joaotpsilva.pro@gmail.com", getAllowedEmails({})), true);
});
