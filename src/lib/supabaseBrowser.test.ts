import assert from "node:assert/strict";
import test from "node:test";
import { extractOAuthTokens, getDesktopOAuthReturnState, hasSupabaseOAuthReturn, isAxionDesktop, shouldEnterAfterOAuth } from "./supabaseBrowser";

test("reconhece callbacks OAuth Supabase com code ou erro", () => {
  assert.equal(hasSupabaseOAuthReturn("http://localhost:3000/?code=abc"), true);
  assert.equal(hasSupabaseOAuthReturn("http://localhost:3000/?error=access_denied"), true);
  assert.equal(hasSupabaseOAuthReturn("http://localhost:3000/"), false);
});

test("distingue o runtime desktop do retorno OAuth no browser", () => {
  assert.equal(isAxionDesktop("http://localhost:3000/?axion-desktop=1"), true);
  assert.equal(isAxionDesktop("http://localhost:3000/?axion-desktop-return=secret"), false);
  assert.equal(getDesktopOAuthReturnState("http://localhost:3000/?axion-desktop-return=secret#access_token=x"), "secret");
});

test("entra no dashboard apenas quando o callback criou uma sessão", () => {
  assert.equal(shouldEnterAfterOAuth(true, true), true);
  assert.equal(shouldEnterAfterOAuth(true, false), false);
  assert.equal(shouldEnterAfterOAuth(false, true), false);
});

test("extrai access e refresh token do callback OAuth implícito", () => {
  assert.deepEqual(extractOAuthTokens("http://localhost:3000/#access_token=access-1&refresh_token=refresh-1"), {
    accessToken: "access-1",
    refreshToken: "refresh-1",
  });
  assert.equal(extractOAuthTokens("http://localhost:3000/"), null);
});
