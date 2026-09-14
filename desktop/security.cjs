const port = process.env.AXION_DESKTOP_SMOKE === '1' ? 3099 : 3000;
const trustedOrigin = `http://localhost:${port}`;
function isInternal(value) {
  try { return new URL(value).origin === trustedOrigin; } catch { return false; }
}
function isExternal(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
module.exports = { trustedOrigin, port, isInternal, isExternal };
