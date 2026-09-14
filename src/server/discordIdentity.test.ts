import test from "node:test";
import assert from "node:assert/strict";
import { resolveDiscordIdentity, type DiscordIdentitySource } from "./discordIdentity";

function source(links: Record<string, string>, names: Record<string, string>): DiscordIdentitySource {
  return {
    async findAxionUserId(discordUserId) { return links[discordUserId] || null; },
    async findProfile(userId) { return names[userId] ? { userId, name: names[userId], email: `${userId}@axion.test` } : null; },
  };
}

test("identifica um utilizador Discord associado", async () => {
  const identity = await resolveDiscordIdentity(source({ "11111111111111111": "axion-1" }, { "axion-1": "Nelson" }), "11111111111111111");
  assert.equal(identity?.name, "Nelson");
});

test("devolve null para um utilizador Discord não associado", async () => {
  assert.equal(await resolveDiscordIdentity(source({}, {}), "99999999999999999"), null);
});

test("mantém dois utilizadores Discord associados a perfis diferentes", async () => {
  const freshSource = () => source({ "11111111111111111": "axion-1", "22222222222222222": "axion-2" }, { "axion-1": "Nelson", "axion-2": "Sousa" });
  assert.equal((await resolveDiscordIdentity(freshSource(), "11111111111111111"))?.name, "Nelson");
  assert.equal((await resolveDiscordIdentity(freshSource(), "22222222222222222"))?.name, "Sousa");
  assert.equal((await resolveDiscordIdentity(freshSource(), "11111111111111111"))?.name, "Nelson");
});
