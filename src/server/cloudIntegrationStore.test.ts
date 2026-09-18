import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { encryptIntegration, decryptIntegration, integrationEncryptionConfigured } from './cloudIntegrationStore';

test('encrypted grants reject another user, another provider and tampering', () => {
  process.env.AXION_INTEGRATION_KEY = randomBytes(32).toString('base64');
  const grant = { refreshToken: 'private-refresh-token', email: 'user@example.com' };
  const encrypted = encryptIntegration(grant, 'google_drive:user-1');
  assert.ok(!encrypted.includes(grant.refreshToken));
  assert.deepEqual(decryptIntegration(encrypted, 'google_drive:user-1'), grant);
  assert.throws(() => decryptIntegration(encrypted, 'google_drive:user-2'));
  assert.throws(() => decryptIntegration(encrypted, 'google_calendar_tasks:user-1'));
  const parts = encrypted.split('.');
  const bytes = Buffer.from(parts[3], 'base64url'); bytes[0] ^= 1;
  parts[3] = bytes.toString('base64url');
  assert.throws(() => decryptIntegration(parts.join('.'), 'google_drive:user-1'));
  delete process.env.AXION_INTEGRATION_KEY;
  assert.equal(integrationEncryptionConfigured(), false);
  assert.throws(() => encryptIntegration(grant, 'google_drive:user-1'), /NOT_CONFIGURED/);
});
