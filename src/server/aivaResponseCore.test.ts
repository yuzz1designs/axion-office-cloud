import assert from "node:assert/strict";
import test from "node:test";
import { buildToolOutputs, extractAivaToolCalls } from "./aivaResponseCore";

test("extracts structured function calls from a response", () => {
  assert.deepEqual(extractAivaToolCalls({ output: [{ type: "function_call", call_id: "call-1", name: "navigate_to_section", arguments: '{"section":"documents"}' }] }), [
    { id: "call-1", name: "navigate_to_section", arguments: { section: "documents" } },
  ]);
});

test("maps client results back to Responses API outputs", () => {
  assert.deepEqual(buildToolOutputs([{ callId: "call-1", ok: true, output: { opened: "documents" } }]), [
    { type: "function_call_output", call_id: "call-1", output: '{"ok":true,"opened":"documents"}' },
  ]);
});
