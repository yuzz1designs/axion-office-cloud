import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAppearanceSettings } from "./appearance";

test("preserva o fundo animado e a respetiva cor", () => {
  assert.deepEqual(normalizeAppearanceSettings({ theme: "animated", accentColor: "violet" }), {
    theme: "animated",
    accentColor: "violet",
  });
});

test("converte temas antigos light e system para dark canvas", () => {
  assert.deepEqual(normalizeAppearanceSettings({ theme: "light", accentColor: "red", density: "compact" }), {
    theme: "dark",
    accentColor: "red",
  });
  assert.equal(normalizeAppearanceSettings({ theme: "system" }).theme, "dark");
});

test("usa valores seguros quando a preferência guardada é inválida", () => {
  assert.deepEqual(normalizeAppearanceSettings(null), { theme: "dark", accentColor: "axion-blue" });
  assert.deepEqual(normalizeAppearanceSettings({ theme: "unknown", accentColor: "pink" }), { theme: "dark", accentColor: "axion-blue" });
});
