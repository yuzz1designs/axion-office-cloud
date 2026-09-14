import assert from "node:assert/strict";
import test from "node:test";
import { getDriveUploadAction, type DriveOAuthStatus } from "./driveUploadState";

const status = (value: Partial<DriveOAuthStatus>): DriveOAuthStatus => ({
  configured: false,
  connected: false,
  missingScopes: [],
  ...value,
});

test("pede configuração quando faltam credenciais OAuth", () => {
  assert.equal(getDriveUploadAction(status({ configured: false })), "configure");
});

test("pede ligação quando OAuth está configurado mas desligado", () => {
  assert.equal(getDriveUploadAction(status({ configured: true, connected: false })), "connect");
});

test("permite upload apenas com conta ligada e scopes completos", () => {
  assert.equal(getDriveUploadAction(status({ configured: true, connected: true })), "upload");
  assert.equal(getDriveUploadAction(status({ configured: true, connected: true, missingScopes: ["drive"] })), "connect");
});
