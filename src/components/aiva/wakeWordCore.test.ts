import assert from "node:assert/strict";
import test from "node:test";
import { containsAivaWakeWord, isHandsFreeStopPhrase, normalizeWakeTranscript } from "./wakeWordCore";

test("detects the Portuguese AIVA wake phrase despite accents and punctuation", () => {
  assert.equal(containsAivaWakeWord("Olá, AIVA!"), true);
  assert.equal(containsAivaWakeWord("ola aiva podes ajudar"), true);
  assert.equal(containsAivaWakeWord("olha a IVA"), false);
});

test("normalizes only for wake-word comparison", () => {
  assert.equal(normalizeWakeTranscript("  OLÁ, AIVA!  "), "ola aiva");
});

test("ends hands-free only for the explicit Portuguese stop phrase", () => {
  assert.equal(isHandsFreeStopPhrase("É tudo."), true);
  assert.equal(isHandsFreeStopPhrase("AIVA, é tudo"), true);
  assert.equal(isHandsFreeStopPhrase("É tudo, AIVA"), true);
  assert.equal(isHandsFreeStopPhrase("Isso é tudo o que falta"), false);
  assert.equal(isHandsFreeStopPhrase("É tudo o que preciso"), false);
});
