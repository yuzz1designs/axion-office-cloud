import test from "node:test";
import assert from "node:assert/strict";
import { AivaDiscordChannel } from "./aivaDiscordChannel";

test("mantém contexto entre várias mensagens Discord na mesma conversa", async () => {
  const previousIds: Array<string | null | undefined> = [];
  let turn = 0;
  const channel = new AivaDiscordChannel({} as never, async (input) => {
    previousIds.push(input.previousResponseId);
    turn += 1;
    return { text: `resposta-${turn}`, responseId: `response-${turn}`, brain: "mark-i" as const, toolCalls: [] };
  });
  assert.equal(await channel.respond("guild:channel:user", "axion-user", "primeira"), "resposta-1");
  const conversationId = channel.conversationId("guild:channel:user");
  assert.equal(await channel.respond("guild:channel:user", "axion-user", "segunda"), "resposta-2");
  assert.deepEqual(previousIds, [undefined, "response-1"]);
  assert.equal(channel.conversationId("guild:channel:user"), conversationId);
});

test("isola o contexto de utilizadores Discord diferentes", async () => {
  const previousIds: Array<string | null | undefined> = [];
  let turn = 0;
  const channel = new AivaDiscordChannel({} as never, async (input) => {
    previousIds.push(input.previousResponseId); turn += 1;
    return { text: "ok", responseId: `response-${turn}`, brain: "mark-i" as const, toolCalls: [] };
  });
  await channel.respond("channel:user-1", "axion-1", "um");
  await channel.respond("channel:user-2", "axion-2", "dois");
  assert.deepEqual(previousIds, [undefined, undefined]);
});
