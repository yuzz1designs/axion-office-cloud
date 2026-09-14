# AIVA Realtime Hands-Free Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma sessão de voz OpenAI Realtime contínua por WebRTC, com interrupção por voz, seletor de vozes e fallback para o modo manual existente.

**Architecture:** O browser cria uma `RTCPeerConnection` e envia o SDP ao backend AXION. O backend autenticado junta o SDP à configuração Realtime e negocia a sessão com a OpenAI sem expor a API key; um hook React gere áudio, eventos, transcrições e cleanup.

**Tech Stack:** React 19, TypeScript, WebRTC browser APIs, OpenAI Realtime REST/WebRTC, Express/Vite middleware, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-05-aiva-realtime-hands-free-design.md`

## Global Constraints

- Usar `gpt-realtime-2.1` e `cedar` por defeito.
- Manter `OPENAI_API_KEY` exclusivamente no servidor.
- Exigir sessão AXION autorizada no endpoint Realtime.
- Manter o microfone manual e os endpoints atuais como fallback.
- Não integrar Chatterbox, clonagem de voz, gravação persistente ou ferramentas empresariais.
- Libertar tracks, peer connection, data channel e áudio em erro, desligar ou desmontar.

---

### Task 1: Contrato e endpoint Realtime autenticado

**Files:**
- Create: `src/lib/aivaRealtimeVoice.ts`
- Create: `src/server/aivaRealtimeCore.ts`
- Create: `src/server/aivaRealtimeCore.test.ts`
- Modify: `src/server/aivaApi.ts`

**Interfaces:**
- Produces shared: `AIVA_REALTIME_VOICES`, `AivaRealtimeVoice`, `normalizeRealtimeVoice(value)`.
- Produces server: `buildRealtimeSession(voice)`, `createSafetyIdentifier(userId)`, `negotiateRealtimeCall(input, fetchImpl)`.
- Produces HTTP: `POST /api/aiva/realtime/session?voice=cedar`, body `application/sdp`, response `application/sdp`.

- [ ] **Step 1: Write failing core tests**

```ts
test("aceita apenas vozes Realtime e usa cedar como fallback", () => {
  assert.equal(normalizeRealtimeVoice("marin"), "marin");
  assert.equal(normalizeRealtimeVoice("invalid"), "cedar");
});

test("configura voz contínua com deteção semântica e interrupção", () => {
  const session = buildRealtimeSession("cedar");
  assert.equal(session.model, "gpt-realtime-2.1");
  assert.deepEqual(session.audio.input.turn_detection, {
    type: "semantic_vad",
    eagerness: "high",
    create_response: true,
    interrupt_response: true,
  });
  assert.equal(session.audio.output.voice, "cedar");
});
```

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/server/aivaRealtimeCore.test.ts`
Expected: FAIL because `aivaRealtimeCore.ts` does not exist.

- [ ] **Step 3: Implement the session contract**

```ts
export const AIVA_REALTIME_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse", "marin", "cedar"] as const;
export type AivaRealtimeVoice = typeof AIVA_REALTIME_VOICES[number];

export function normalizeRealtimeVoice(value: unknown): AivaRealtimeVoice {
  return AIVA_REALTIME_VOICES.includes(value as AivaRealtimeVoice) ? value as AivaRealtimeVoice : "cedar";
}

export function buildRealtimeSession(voice: AivaRealtimeVoice) {
  return {
    type: "realtime" as const,
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    instructions: AIVA_IDENTITY,
    audio: {
      input: {
        transcription: { model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe", language: "pt" },
        turn_detection: { type: "semantic_vad", eagerness: "high", create_response: true, interrupt_response: true },
      },
      output: { voice },
    },
  };
}
```

Keep the voice constant and normalization in `src/lib/aivaRealtimeVoice.ts` so server and browser use the exact same allowlist.

- [ ] **Step 4: Add the authenticated SDP route**

Authenticate with `getSupabaseBackend`, `readSessionToken`, `authenticateSupabaseUser`, and `getAllowedEmails`. Read at most 64 KB of SDP, build `FormData` with `sdp` and serialized `session`, then POST to `https://api.openai.com/v1/realtime/calls` with `Authorization: Bearer ${OPENAI_API_KEY}` and a SHA-256 safety identifier derived from `user.id`. Relay only status, content type, and SDP/error-safe text.

Add a test for `negotiateRealtimeCall` using an injected fetch implementation. Assert from the received `RequestInit` that the standard API key is present only in the outgoing OpenAI authorization header, the selected voice is inside the `session` form field, and a non-2xx OpenAI response is returned as a normalized failure without response headers being blindly relayed.

- [ ] **Step 5: Verify Task 1**

Run: `node --import tsx --test src/server/aivaRealtimeCore.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/lib/aivaRealtimeVoice.ts src/server/aivaRealtimeCore.ts src/server/aivaRealtimeCore.test.ts src/server/aivaApi.ts
git commit -m "feat: add authenticated AIVA realtime session endpoint"
```

---

### Task 2: Estado e lifecycle do cliente WebRTC

**Files:**
- Create: `src/components/aiva/aivaRealtimeCore.ts`
- Create: `src/components/aiva/aivaRealtimeCore.test.ts`
- Create: `src/components/aiva/useAivaRealtimeVoice.ts`

**Interfaces:**
- Consumes: `POST /api/aiva/realtime/session?voice=<voice>`.
- Produces: `useAivaRealtimeVoice({ voice, muted, onUserTranscript, onAssistantTranscript })` returning `{ status, active, notice, start, stop }`.
- Produces: `reduceRealtimeEvent(state, event)` for deterministic event handling.

- [ ] **Step 1: Write failing event reducer tests**

```ts
test("mapeia início de fala, resposta e transcrições", () => {
  let state = createRealtimeEventState();
  state = reduceRealtimeEvent(state, { type: "input_audio_buffer.speech_started" });
  assert.equal(state.status, "listening");
  state = reduceRealtimeEvent(state, { type: "response.audio.delta" });
  assert.equal(state.status, "speaking");
  state = reduceRealtimeEvent(state, { type: "response.done" });
  assert.equal(state.status, "listening");
});

test("ignora eventos desconhecidos sem perder o estado", () => {
  const state = { ...createRealtimeEventState(), status: "speaking" as const };
  assert.deepEqual(reduceRealtimeEvent(state, { type: "future.event" }), state);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/components/aiva/aivaRealtimeCore.test.ts`
Expected: FAIL because the reducer is missing.

- [ ] **Step 3: Implement event normalization**

Define `AivaRealtimeStatus = "off" | "connecting" | "listening" | "thinking" | "speaking" | "error"`. Handle `session.created`, speech start/stop, input transcription completion, response audio start/delta/done, output transcript deltas/completion, and `error`. Unknown events return the prior state.

- [ ] **Step 4: Implement `useAivaRealtimeVoice`**

The hook must:

1. obtain `getUserMedia` only from the explicit `start()` action;
2. create `RTCPeerConnection`, autoplay remote audio, add the microphone track and create `oai-events` data channel;
3. create/set the local SDP offer and POST it to the backend endpoint;
4. validate `response.ok` before setting the remote SDP answer;
5. update state and transcript callbacks from data-channel events;
6. mute/unmute only the remote audio element;
7. make `stop()` idempotent and close data channel, peer connection, tracks, `srcObject`, handlers and state;
8. call `stop()` in effect cleanup and on connection failure.

- [ ] **Step 5: Verify Task 2**

Run: `node --import tsx --test src/components/aiva/aivaRealtimeCore.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/components/aiva/aivaRealtimeCore.ts src/components/aiva/aivaRealtimeCore.test.ts src/components/aiva/useAivaRealtimeVoice.ts
git commit -m "feat: add AIVA realtime WebRTC voice lifecycle"
```

---

### Task 3: Hands Free e seletor de voz na UI AIVA

**Files:**
- Modify: `src/components/aiva/AivaOverviewScreen.tsx`
- Modify: `src/components/aiva/AivaInteractionBar.tsx`
- Modify: `src/components/aiva/useAivaVisualState.ts`
- Modify: `src/components/aiva/aiva.css`
- Modify: `src/components/aiva/aivaVisual.types.ts`

**Interfaces:**
- Consumes: `useAivaRealtimeVoice` and the shared `AIVA_REALTIME_VOICES` constant/type.
- Produces UI actions: toggle Hands Free, select voice, retain manual mic and text submit.

- [ ] **Step 1: Write failing UI-state tests**

Extend `aivaRealtimeCore.test.ts` with literal expectations for `mapRealtimeStatusToVisualState(status)` and `shouldRestartRealtimeSession({ active, previousVoice, nextVoice })`.

```ts
assert.equal(mapRealtimeStatusToVisualState("connecting"), "thinking");
assert.equal(mapRealtimeStatusToVisualState("speaking"), "speaking");
assert.equal(shouldRestartRealtimeSession({ active: true, previousVoice: "marin", nextVoice: "cedar" }), true);
```

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test src/components/aiva/aivaRealtimeCore.test.ts`
Expected: FAIL because mapping/restart functions are absent.

- [ ] **Step 3: Implement state mapping and mode exclusion**

When Hands Free starts, call the manual `stop()`. When manual voice starts, stop Realtime first. Map Realtime state into the existing particle/preset visual state and use its transcripts as `userMessage`/`response`. Creating a new AIVA session stops both modes and clears transcript state.

- [ ] **Step 4: Add the controls**

Add a labelled Hands Free pill with `aria-pressed`, persistent live-microphone indicator, and a compact settings popover containing a labelled voice `<select>`. Default to `cedar`; persist the selected value in `localStorage` under `axion_aiva_voice`. Voice changes while active perform a clean stop/start sequence.

- [ ] **Step 5: Keep the fallback explicit**

Realtime errors show a concise notice and leave text/manual controls enabled. Manual voice continues to use the existing 3-second silence flow and `/api/aiva/transcribe`, `/api/aiva/respond`, `/api/aiva/speech` endpoints.

- [ ] **Step 6: Verify Task 3**

Run: `npm test && npm run typecheck`
Expected: all tests PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/components/aiva/AivaOverviewScreen.tsx src/components/aiva/AivaInteractionBar.tsx src/components/aiva/useAivaVisualState.ts src/components/aiva/aiva.css src/components/aiva/aivaVisual.types.ts src/components/aiva/aivaRealtimeCore.ts src/components/aiva/aivaRealtimeCore.test.ts
git commit -m "feat: add AIVA hands-free voice controls"
```

---

### Task 4: Integração real e verificação final

**Files:**
- No production files unless verification exposes a defect; any defect follows a fresh failing-test cycle before correction.

**Interfaces:**
- Consumes the completed endpoint, hook, and UI.
- Produces a verified local hands-free conversation flow.

- [ ] **Step 1: Restart the local server**

Stop only the Vite process listening on port 3000, run `npm run dev`, and verify `GET /api/aiva/status` returns HTTP 200.

- [ ] **Step 2: Test the authenticated handshake**

From the logged-in Safari session, activate Hands Free and verify: permission is reused, status reaches listening, speech produces streaming audio, a second utterance triggers another response without another click, speaking during output interrupts it, and disabling Hands Free removes the active microphone indicator.

- [ ] **Step 3: Run complete verification**

```bash
npm run typecheck
npm run lint
npm test
npm run build
git diff --check
```

Expected: zero type errors, lint errors, failed tests, build errors, or whitespace errors. A Rollup chunk-size warning is non-blocking if unchanged.

- [ ] **Step 4: Request code review and resolve Critical/Important findings**

Review authentication, secret handling, WebRTC cleanup, event races, manual fallback, and voice changes. Re-run Step 4 after any fix.

- [ ] **Step 5: Record final evidence**

Capture the test count, typecheck/lint/build exit status, handshake result, selected voice, and remaining non-blocking warnings in the final handoff. Do not commit unrelated dirty-worktree files.
