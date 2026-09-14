import assert from "node:assert/strict";
import test from "node:test";
import { GOOGLE_DRIVE_SCOPE, GOOGLE_OAUTH_SCOPES, OAuthStateStore, buildGoogleAuthorizationUrl, toPublicOAuthStatus, type OAuthGrant } from "./googleOAuthCore";

test("consome state válido uma única vez", () => {
  const states = new OAuthStateStore(() => 1_000);
  const state = states.create();
  assert.equal(states.consume(state), true);
  assert.equal(states.consume(state), false);
});

test("rejeita state expirado ou desconhecido", () => {
  let now = 1_000;
  const states = new OAuthStateStore(() => now, 300_000);
  const state = states.create();
  now += 300_001;
  assert.equal(states.consume(state), false);
  assert.equal(states.consume("desconhecido"), false);
});

test("constrói consentimento offline com scope Drive e callback exato", () => {
  const url = new URL(buildGoogleAuthorizationUrl({
    clientId: "client-id",
    redirectUri: "http://localhost:3000/api/google/oauth/callback",
    state: "secure-state",
  }));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/google/oauth/callback");
  assert.equal(url.searchParams.get("scope"), GOOGLE_OAUTH_SCOPES.join(" "));
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "secure-state");
});

test("status público nunca contém o refresh token", () => {
  const grant: OAuthGrant = {
    refreshToken: "secret-refresh-token",
    email: "axion@example.com",
    scopes: [GOOGLE_DRIVE_SCOPE],
    connectedAt: "2026-09-02T12:00:00.000Z",
  };
  const status = toPublicOAuthStatus({ configured: true, grant });
  assert.deepEqual(status, {
    configured: true,
    connected: true,
    email: "axion@example.com",
    connectedAt: "2026-09-02T12:00:00.000Z",
    missingScopes: [],
  });
  assert.equal("refreshToken" in status, false);
});
