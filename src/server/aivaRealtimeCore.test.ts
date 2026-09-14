import assert from "node:assert/strict";
import test from "node:test";
import { normalizeRealtimeVoice } from "../lib/aivaRealtimeVoice";
import { buildRealtimeSession, createSafetyIdentifier, negotiateRealtimeCall, validateRealtimeSdp } from "./aivaRealtimeCore";

test("aceita apenas vozes Realtime e usa coral como fallback feminino", () => {
  assert.equal(normalizeRealtimeVoice("marin"), "marin");
  assert.equal(normalizeRealtimeVoice("invalid"), "coral");
});

test("configura voz contínua com deteção semântica e interrupção", () => {
  const session = buildRealtimeSession("cedar", {});
  assert.equal(session.model, "gpt-realtime-2.1");
  assert.deepEqual(session.audio.input.turn_detection, {
    type: "semantic_vad",
    eagerness: "medium",
    create_response: true,
    interrupt_response: true,
  });
  assert.equal(session.audio.output.voice, "cedar");
});

test("Mark II delega raciocínio de voz no cérebro avançado sem trocar a identidade", () => {
  const session = buildRealtimeSession("cedar", {}, "mark-ii");
  assert.match(session.instructions, /MARK II/);
  assert.ok(session.tools.some((tool) => tool.name === "consult_active_brain"));
});

test("protege a identidade do utilizador no safety identifier", () => {
  const identifier = createSafetyIdentifier("user-secret-id");
  assert.equal(identifier.length, 64);
  assert.equal(identifier.includes("user-secret-id"), false);
  assert.equal(identifier, createSafetyIdentifier("user-secret-id"));
});

test("negocia SDP sem expor a API key no resultado", async () => {
  let receivedInit: RequestInit | undefined;
  const result = await negotiateRealtimeCall({ sdp: "v=0\r\n", voice: "cedar", userId: "user-1", apiKey: "sk-secret" }, async (_url, init) => {
    receivedInit = init;
    return new Response("v=0\r\na=answer", { status: 201, headers: { "Content-Type": "application/sdp" } });
  });

  assert.deepEqual(result, { ok: true, status: 201, sdp: "v=0\r\na=answer" });
  assert.equal((receivedInit?.headers as Record<string, string>).Authorization, "Bearer sk-secret");
  assert.equal((receivedInit?.headers as Record<string, string>)["OpenAI-Safety-Identifier"].length, 64);
  const form = receivedInit?.body as FormData;
  assert.equal(form.get("sdp"), "v=0\r\n");
  assert.equal(JSON.parse(String(form.get("session"))).audio.output.voice, "cedar");
  assert.equal(JSON.stringify(result).includes("sk-secret"), false);
});

test("normaliza uma rejeição da OpenAI", async () => {
  const result = await negotiateRealtimeCall({ sdp: "v=0", voice: "cedar", userId: "user-1", apiKey: "sk-secret" }, async () => new Response("sensitive upstream detail", { status: 429 }));
  assert.deepEqual(result, { ok: false, status: 429, error: "Não foi possível iniciar a sessão Realtime." });
});

test("preserva integralmente o SDP incluindo o CRLF final", () => {
  const sdp = "v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\ns=-\r\n";
  assert.equal(validateRealtimeSdp(sdp), sdp);
  assert.throws(() => validateRealtimeSdp("  \r\n"), /SDP_EMPTY/);
});
