// Run against localhost with an isolated browser and synthetic API/voice transport.
// No real account, microphone, OpenAI calls or macOS actions are used.
import assert from "node:assert/strict";
const { chromium } = await import(process.argv[2] || "playwright");
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  let astraAvailable = true;
  await page.addInitScript(() => {
    window.__peers = 0; window.__sent = []; window.__closed = 0;
    Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia: async () => new MediaStream() } });
    window.RTCPeerConnection = class {
      constructor() { window.__peers++; }
      createDataChannel() {
        const c = { readyState: "connecting", send(raw) { const e = JSON.parse(raw); window.__sent.push(e); if (e.type === "session.update") setTimeout(() => c.onmessage?.({ data: JSON.stringify({ type: "session.updated", session: e.session }) }), 10); }, close() { this.readyState = "closed"; } };
        this.channel = c; window.__channel = c; return c;
      }
      async createOffer() { return { type: "offer", sdp: "v=0\r\n" }; }
      async setLocalDescription() {}
      async setRemoteDescription() { this.channel.readyState = "open"; this.channel.onopen?.(); this.channel.onmessage?.({ data: JSON.stringify({ type: "session.created" }) }); }
      addTrack() {}
      close() { window.__closed++; }
    };
  });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    let data = {};
    if (url.pathname === "/api/auth/config") data = { configured: false };
    else if (url.pathname === "/api/profile/status") data = { hasProfile: false, authRequired: false, profileRequired: false };
    else if (url.pathname === "/api/aiva/status") data = { configured: true };
    else if (url.pathname === "/api/aiva/capabilities") data = { brains: [{ id: "mark-i", available: true, capabilities: [] }, { id: "mark-ii", available: astraAvailable, reason: astraAvailable ? undefined : "Modelo indisponível nesta conta", capabilities: [] }], desktop: { connected: false, capabilities: [] } };
    else if (url.pathname === "/api/aiva/realtime/config") data = { instructions: `Brain ${url.searchParams.get("brain")}; page ${url.searchParams.get("context")}`, tools: [] };
    else if (url.pathname === "/api/aiva/realtime/session") return route.fulfill({ status: 200, contentType: "application/sdp", body: "v=0\r\n" });
    else if (url.pathname === "/api/aiva/respond") data = { responseId: "test-response", text: "Contexto preservado." };
    else data = { summary: { monthlyRevenue: 0, currencies: [] }, clients: [], documents: [], tasks: [], events: [], payments: [], revenues: [], activity: [], notifications: [], configured: false };
    await route.fulfill({ json: data });
  });
  await page.goto("http://localhost:3000");
  await page.locator("#enter-office-btn").click();
  await page.getByRole("button", { name: /AIVA/ }).first().click();
  await page.locator(".aiva-screen").waitFor();
  await page.getByRole("button", { name: "Silenciar AIVA" }).click();
  await page.getByRole("textbox", { name: "Perguntar à AIVA" }).fill("Guardar contexto desta conversa.");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await page.getByText("Contexto preservado.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Hands Free", exact: true }).click();
  await page.waitForFunction(() => window.__sent.some(e => e.type === "session.update"));
  await page.locator(".aiva-brain-switch button").nth(1).click();
  await page.waitForFunction(() => document.querySelector(".aiva-screen")?.dataset.brain === "mark-ii");
  assert.equal(await page.evaluate(() => window.__peers), 1);
  assert.equal(await page.evaluate(() => window.__closed), 0);
  assert.ok(await page.evaluate(() => window.__sent.some(e => e.type === "conversation.item.create" && e.item.content?.[0]?.text === "Guardar contexto desta conversa.")));
  await page.waitForTimeout(1200); // Let the visual transition settle for screenshot review.
  await page.screenshot({ path: "/tmp/aiva-mark-ii.png" });
  await page.locator(".aiva-brain-switch button").nth(0).click();
  await page.waitForFunction(() => document.querySelector(".aiva-screen")?.dataset.brain === "mark-i");
  assert.equal(await page.evaluate(() => window.__peers), 1);
  await page.locator("#nav-item-clients").click();
  await page.locator("#nav-item-aiva").click();
  await page.locator(".aiva-screen").waitFor();
  assert.equal(await page.evaluate(() => window.__peers), 1);
  await page.evaluate(() => window.__channel.onmessage({ data: JSON.stringify({ type: "response.created" }) }));
  await page.locator(".aiva-brain-switch button").nth(1).click();
  assert.equal(await page.locator(".aiva-screen").getAttribute("data-brain"), "mark-i");
  await page.evaluate(() => window.__channel.onmessage({ data: JSON.stringify({ type: "response.done" }) }));
  await page.waitForFunction(() => document.querySelector(".aiva-screen")?.dataset.brain === "mark-ii");
  assert.equal(await page.evaluate(() => window.__peers), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/aiva-mobile.png" });
  await page.evaluate(() => window.__channel.onmessage({ data: JSON.stringify({ type: "conversation.item.input_audio_transcription.completed", transcript: "É tudo." }) }));
  await page.waitForFunction(() => window.__closed === 1);
  astraAvailable = false;
  await page.reload();
  await page.locator("#enter-office-btn").click();
  await page.locator("#nav-item-aiva").click();
  await page.locator(".aiva-brain-switch button").nth(1).waitFor();
  assert.equal(await page.locator(".aiva-brain-switch button").nth(1).isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log("PASS: one peer across brain switches/navigation; shared context; deferred busy switch; Astra unavailable; desktop/mobile; stop phrase.");
} finally { await browser.close(); }
