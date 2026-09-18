import assert from "node:assert/strict";
import test from "node:test";
import { GoogleOAuthClient, type GoogleOAuthConfig } from "./googleOAuthClient";

const config: GoogleOAuthConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  redirectUri: "http://localhost:3000/api/google/oauth/callback",
};

test("troca código e exige refresh token", async () => {
  const client = new GoogleOAuthClient(config, async () => new Response(JSON.stringify({
    access_token: "access-secret",
    refresh_token: "refresh-secret",
    expires_in: 3600,
    scope: "https://www.googleapis.com/auth/drive",
    token_type: "Bearer",
  }), { status: 200, headers: { "Content-Type": "application/json" } }));

  const tokens = await client.exchangeAuthorizationCode("authorization-code");
  assert.equal(tokens.accessToken, "access-secret");
  assert.equal(tokens.refreshToken, "refresh-secret");
  assert.deepEqual(tokens.scopes, ["https://www.googleapis.com/auth/drive"]);
});

test("rejeita troca sem refresh token persistente", async () => {
  const client = new GoogleOAuthClient(config, async () => new Response(JSON.stringify({ access_token: "access-only" }), { status: 200 }));
  await assert.rejects(() => client.exchangeAuthorizationCode("authorization-code"), /GOOGLE_OAUTH_REFRESH_TOKEN_MISSING/);
});

test("refresh envia grant_type e segredo apenas ao endpoint Google", async () => {
  let recordedBody = "";
  const client = new GoogleOAuthClient(config, async (_url, init) => {
    recordedBody = String(init?.body || "");
    return new Response(JSON.stringify({ access_token: "new-access", expires_in: 3600 }), { status: 200 });
  });

  assert.equal(await client.refreshAccessToken("refresh-secret"), "new-access");
  assert.match(recordedBody, /grant_type=refresh_token/);
  assert.match(recordedBody, /refresh_token=refresh-secret/);
  assert.match(recordedBody, /client_secret=client-secret/);
});

test("obtém apenas o email verificado da conta", async () => {
  const client = new GoogleOAuthClient(config, async () => new Response(JSON.stringify({ email: "axion@example.com", email_verified: true }), { status: 200 }));
  assert.equal(await client.getUserEmail("access-token"), "axion@example.com");
});


test("default fetch preserves the Worker global receiver throughout OAuth", async (t) => {
  t.mock.method(globalThis, "fetch", async function (this: unknown, input: RequestInfo | URL) {
    assert.equal(this, globalThis);
    const url = String(input);
    return new Response(JSON.stringify(url.includes("userinfo")
      ? { email: "axion@example.com", email_verified: true }
      : { access_token: "access", refresh_token: "refresh", scope: "email" }));
  });
  const client = new GoogleOAuthClient(config);
  assert.equal((await client.exchangeAuthorizationCode("code")).refreshToken, "refresh");
  assert.equal(await client.refreshAccessToken("refresh"), "access");
  assert.equal(await client.getUserEmail("access"), "axion@example.com");
  assert.equal(await client.revokeGrant("refresh"), true);
});
