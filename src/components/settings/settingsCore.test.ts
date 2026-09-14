import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_SETTING_IDS, getSettingsCopy, publishSettingsActivity, sanitizeCommandCenterConfig } from "./settingsCore";

test("expõe apenas definições que têm efeito real no AXION OFFICE", () => {
  assert.deepEqual(ACTIVE_SETTING_IDS, ["appearance", "language", "command-center", "aiva-desktop"]);
});

test("remove módulos antigos do Command Center e preserva a ordem útil", () => {
  const cleaned = sanitizeCommandCenterConfig({
    modules: [
      { id: "projects", label: "Projects", category: "Operations", visible: true },
      { id: "meetings", label: "Meetings", category: "Core", visible: false },
      { id: "today", label: "Today", category: "Core", visible: true },
      { id: "finance", label: "Finance", category: "Business", visible: true },
    ],
    primaryMetric: "priorities",
    recentItemsCount: 18,
    defaultLandingExperience: "briefing",
  });

  assert.deepEqual(cleaned.modules.map((item) => item.id), ["meetings", "today"]);
  assert.equal(cleaned.modules.every((item) => item.visible), true);
  assert.equal(cleaned.recentItemsCount, 10);
});

test("fornece textos consistentes para a versão inglesa das definições", () => {
  const copy = getSettingsCopy("en");
  assert.equal(copy.heading, "SETTINGS");
  assert.equal(copy.backgroundDescription, "Choose between a static dark canvas and continuously animated waves.");
  assert.equal(Object.values(copy).some((text) => /Definições|Escolha|Ondas|cor do/i.test(text)), false);
});

test("atualiza a atividade imediatamente apenas depois do audit ser aceite", async () => {
  let dispatched = 0;
  await publishSettingsActivity(async () => new Response(null, { status: 201 }), () => { dispatched += 1; });
  assert.equal(dispatched, 1);
  await assert.rejects(() => publishSettingsActivity(async () => new Response(null, { status: 500 }), () => { dispatched += 1; }));
  assert.equal(dispatched, 1);
});
