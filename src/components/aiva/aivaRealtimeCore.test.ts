import assert from "node:assert/strict";
import test from "node:test";
import { createRealtimeEventState, mapRealtimeStatusToVisualState, reduceRealtimeEvent, shouldRestartRealtimeSession } from "./aivaRealtimeCore";

test("mapeia o ciclo de voz Realtime até voltar a ouvir", () => {
  let state = createRealtimeEventState();
  state = reduceRealtimeEvent(state, { type: "session.created" });
  assert.equal(state.status, "listening");
  state = reduceRealtimeEvent(state, { type: "input_audio_buffer.speech_stopped" });
  assert.equal(state.status, "thinking");
  state = reduceRealtimeEvent(state, { type: "response.output_audio.delta" });
  assert.equal(state.status, "speaking");
  state = reduceRealtimeEvent(state, { type: "response.done" });
  assert.equal(state.status, "speaking");
  state = reduceRealtimeEvent(state, { type: "output_audio_buffer.stopped" });
  assert.equal(state.status, "listening");
});

test("reúne transcrições do utilizador e da AIVA", () => {
  let state = createRealtimeEventState();
  state = reduceRealtimeEvent(state, { type: "conversation.item.input_audio_transcription.completed", transcript: "Olá AIVA" });
  state = reduceRealtimeEvent(state, { type: "response.output_audio_transcript.delta", delta: "Olá " });
  state = reduceRealtimeEvent(state, { type: "response.output_audio_transcript.delta", delta: "Nelson" });
  state = reduceRealtimeEvent(state, { type: "response.output_audio_transcript.done", transcript: "Olá Nelson." });
  assert.equal(state.userTranscript, "Olá AIVA");
  assert.equal(state.assistantTranscript, "Olá Nelson.");
});

test("ignora eventos desconhecidos sem perder o estado", () => {
  const state = { ...createRealtimeEventState(), status: "speaking" as const };
  assert.deepEqual(reduceRealtimeEvent(state, { type: "future.event" }), state);
});

test("traduz estados Realtime para a presença visual existente", () => {
  assert.equal(mapRealtimeStatusToVisualState("connecting"), "thinking");
  assert.equal(mapRealtimeStatusToVisualState("listening"), "listening");
  assert.equal(mapRealtimeStatusToVisualState("speaking"), "speaking");
  assert.equal(mapRealtimeStatusToVisualState("error"), "error");
  assert.equal(mapRealtimeStatusToVisualState("off"), "idle");
});

test("reinicia uma sessão ativa apenas quando a voz muda", () => {
  assert.equal(shouldRestartRealtimeSession({ active: true, previousVoice: "marin", nextVoice: "cedar" }), true);
  assert.equal(shouldRestartRealtimeSession({ active: false, previousVoice: "marin", nextVoice: "cedar" }), false);
  assert.equal(shouldRestartRealtimeSession({ active: true, previousVoice: "cedar", nextVoice: "cedar" }), false);
});
