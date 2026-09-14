import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GOOGLE_DRIVE_SCOPE, type OAuthGrant } from "./googleOAuthCore";
import { GoogleOAuthStore } from "./googleOAuthStore";

const grant: OAuthGrant = {
  refreshToken: "refresh-secret",
  email: "axion@example.com",
  scopes: [GOOGLE_DRIVE_SCOPE],
  connectedAt: "2026-09-02T12:00:00.000Z",
};

test("persiste e recupera o grant com permissões restritas", () => {
  const directory = mkdtempSync(join(tmpdir(), "axion-oauth-store-"));
  try {
    const store = new GoogleOAuthStore(directory);
    store.write(grant);
    assert.deepEqual(store.read(), grant);
    assert.equal(statSync(join(directory, "google-oauth.json")).mode & 0o777, 0o600);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("clear remove apenas o grant OAuth", () => {
  const directory = mkdtempSync(join(tmpdir(), "axion-oauth-store-"));
  try {
    const store = new GoogleOAuthStore(directory);
    store.write(grant);
    store.clear();
    assert.equal(store.read(), null);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejeita um grant local corrompido", () => {
  const directory = mkdtempSync(join(tmpdir(), "axion-oauth-store-"));
  try {
    writeFileSync(join(directory, "google-oauth.json"), "{invalid-json");
    assert.throws(() => new GoogleOAuthStore(directory).read(), /GOOGLE_OAUTH_STORE_INVALID/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
