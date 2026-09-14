import assert from "node:assert/strict";
import test from "node:test";
import { AIVA_TOOL_DEFINITIONS, getAivaToolPolicy, isConciseCompletionTool, parseAivaToolArguments } from "./aivaTools";

test("tool names are unique and every tool has a policy", () => {
  const names = AIVA_TOOL_DEFINITIONS.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length);
  for (const name of names) assert.ok(getAivaToolPolicy(name));
});

test("financial settlements and deletions require confirmation", () => {
  assert.equal(getAivaToolPolicy("mark_payment_paid"), "confirm");
  assert.equal(getAivaToolPolicy("delete_client"), "confirm");
  assert.equal(getAivaToolPolicy("navigate_to_section"), "automatic");
});

test("tool arguments reject malformed JSON", () => {
  assert.deepEqual(parseAivaToolArguments('{"enabled":true}'), { enabled: true });
  assert.throws(() => parseAivaToolArguments("{"), /AIVA_TOOL_ARGUMENTS_INVALID/);
});

test("completed actions stay concise while data queries still require an answer", () => {
  assert.equal(isConciseCompletionTool("navigate_to_section"), true);
  assert.equal(isConciseCompletionTool("open_client"), true);
  assert.equal(isConciseCompletionTool("list_clients"), false);
});
