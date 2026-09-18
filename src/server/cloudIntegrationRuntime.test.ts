import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("integration encryption round-trips and enforces identity in Cloudflare runtime", async () => {
  const built = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import { encryptIntegration, decryptIntegration } from './src/server/cloudIntegrationStore';
        export default { async fetch() {
          process.env.AXION_INTEGRATION_KEY = Buffer.alloc(32, 7).toString('base64');
          const identity = 'google_calendar_tasks:test-user';
          const value = { grant: { refreshToken: 'test-token', email: 'test@example.com' }, events: [{ title: 'Reunião' }], tasks: [] };
          const encrypted = encryptIntegration(value, identity);
          const roundTrip = decryptIntegration(encrypted, identity);
          let wrongUserRejected = false;
          try { decryptIntegration(encrypted, 'google_calendar_tasks:other-user'); }
          catch { wrongUserRejected = true; }
          return Response.json({ matches: JSON.stringify(value) === JSON.stringify(roundTrip), wrongUserRejected, encrypted: !encrypted.includes('test-token') });
        }};
      `,
    },
    bundle: true, write: false, format: "esm", platform: "node", external: ["node:*"],
  });
  const runtime = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: built.outputFiles[0].text,
    compatibilityDate: "2026-09-17", compatibilityFlags: ["nodejs_compat"],
  }));
  try {
    const response = await runtime.dispatchFetch("http://localhost/");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { matches: true, wrongUserRejected: true, encrypted: true });
  } finally {
    await runtime.dispose();
  }
});
