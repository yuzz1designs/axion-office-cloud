import test from "node:test";
import assert from "node:assert/strict";
import { buildAivaDiscordMessage } from "../../discord/presentation";

test("formata respostas Discord com identidade visual AXION e logótipo", () => {
  const message = buildAivaDiscordMessage("Resposta da AIVA");
  const embed = message.embeds[0].toJSON();
  assert.equal(embed.color, 0x00f0ff);
  assert.equal(embed.description, "Resposta da AIVA");
  assert.equal(embed.thumbnail?.url, "attachment://aiva-axion-logo.png");
  assert.equal(message.files.length, 1);
});
