import assert from "node:assert/strict";
import test from "node:test";
import { advanceVoiceSilence, createVoiceSilenceState, describeVoiceCaptureError, replaceVoiceRequest } from "./voiceSilence";

test("envia a gravação após três segundos de silêncio depois da fala", () => {
  let state = createVoiceSilenceState();

  ({ state } = advanceVoiceSilence(state, true, 1_000));
  ({ state } = advanceVoiceSilence(state, false, 1_500));
  const beforeLimit = advanceVoiceSilence(state, false, 4_499);
  const atLimit = advanceVoiceSilence(beforeLimit.state, false, 4_500);

  assert.equal(beforeLimit.shouldStop, false);
  assert.equal(atLimit.shouldStop, true);
});

test("não termina enquanto ainda não tiver sido detetada voz", () => {
  const result = advanceVoiceSilence(createVoiceSilenceState(), false, 10_000);

  assert.equal(result.shouldStop, false);
  assert.equal(result.state.silenceStartedAt, null);
});

test("reinicia os três segundos quando o utilizador volta a falar", () => {
  let state = createVoiceSilenceState();

  ({ state } = advanceVoiceSilence(state, true, 1_000));
  ({ state } = advanceVoiceSilence(state, false, 2_000));
  ({ state } = advanceVoiceSilence(state, true, 4_000));
  ({ state } = advanceVoiceSilence(state, false, 4_100));
  const result = advanceVoiceSilence(state, false, 7_099);

  assert.equal(result.shouldStop, false);
  assert.equal(result.state.silenceStartedAt, 4_100);
});

test("cancela o pedido de voz anterior antes de iniciar outro", () => {
  const previous = new AbortController();
  const current = replaceVoiceRequest(previous);

  assert.equal(previous.signal.aborted, true);
  assert.equal(current.signal.aborted, false);
});

test("distingue bloqueio de permissão de uma falha posterior do áudio", () => {
  assert.equal(
    describeVoiceCaptureError("microphone", { name: "NotAllowedError" }),
    "Microfone bloqueado nas permissões da aplicação ou do macOS",
  );
  assert.equal(
    describeVoiceCaptureError("analysis", { name: "NotSupportedError" }),
    "Microfone autorizado · análise de silêncio indisponível (NotSupportedError)",
  );
});
