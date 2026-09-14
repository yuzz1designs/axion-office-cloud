import test from "node:test";
import assert from "node:assert/strict";
import { filterDeviceTools, isMacTool } from "./aivaCapabilities";
import { appendAivaMessage, type AivaConversation } from "./aivaConversation";

test("only Mark II receives explicitly discovered macOS tools", () => {
  const tools = [{ name: "list_clients" }, { name: "get_battery_status" }, { name: "read_clipboard" }];
  assert.deepEqual(filterDeviceTools(tools, "mark-i", ["get_battery_status"]), [{ name: "list_clients" }]);
  assert.deepEqual(filterDeviceTools(tools, "mark-ii", []), [{ name: "list_clients" }]);
  assert.deepEqual(filterDeviceTools(tools, "mark-ii", ["get_battery_status"]), [{ name: "list_clients" }, { name: "get_battery_status" }]);
  for (const name of ["run_shell", "control_desktop", "screenshot", "__proto__"]) assert.equal(isMacTool(name), false);
  assert.equal(isMacTool("open_application"), true);
});
test("one conversation keeps voice and text turns without duplicating completed transcripts", () => {
  const conversation: AivaConversation = { id: "same-session", messages: [] };
  appendAivaMessage(conversation, "user", "Olá");
  appendAivaMessage(conversation, "user", "Olá");
  appendAivaMessage(conversation, "assistant", "Olá, estou a ouvir.");
  assert.equal(conversation.id, "same-session");
  assert.deepEqual(conversation.messages.map(item => item.role), ["user", "assistant"]);
});
