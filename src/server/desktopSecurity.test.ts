import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { isInternal, isExternal } = createRequire(import.meta.url)('../../desktop/security.cjs');
test('desktop origin cannot be replaced by a similar hostname or another port', () => {
  assert.equal(isInternal('http://localhost:3000/api/auth'), true);
  for (const url of ['http://localhost.evil:3000', 'http://localhost:4000', 'file:///etc/passwd', 'javascript:alert(1)']) assert.equal(isInternal(url), false);
});
test('external navigation denies executable schemes and embedded credentials', () => {
  assert.equal(isExternal('https://accounts.google.com'), true);
  for (const url of ['file:///tmp/x', 'javascript:alert(1)', 'https://user:pass@example.com', 'http://example.com']) assert.equal(isExternal(url), false);
});
