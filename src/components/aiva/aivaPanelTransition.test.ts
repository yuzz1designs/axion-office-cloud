import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AivaPanelTransition from "./AivaPanelTransition";
import { getAivaPanelTransition } from "./aivaPanelMotion";

test("abre a AIVA a partir de uma linha central e revela o painel por fases", () => {
  const transition = getAivaPanelTransition(false);

  assert.deepEqual(transition.panel.initial, {
    clipPath: "inset(49.8% 3% 49.8% 3% round 2px)",
    opacity: 0.42,
    scaleX: 0.72,
    filter: "brightness(1.8) blur(2px)",
  });
  assert.deepEqual(transition.panel.animate.clipPath, [
    "inset(49.8% 3% 49.8% 3% round 2px)",
    "inset(8% 1% 8% 1% round 18px)",
    "inset(0% 0% 0% 0% round 28px)",
  ]);
  assert.equal(transition.panel.transition.duration, 0.9);
  assert.equal(transition.content.transition.delay, 0.28);
});

test("remove recortes e varrimentos quando o utilizador reduz movimento", () => {
  const transition = getAivaPanelTransition(true);

  assert.deepEqual(transition.panel.initial, { opacity: 0 });
  assert.deepEqual(transition.panel.animate, { opacity: 1 });
  assert.deepEqual(transition.panel.exit, { opacity: 0 });
  assert.equal(transition.panel.transition.duration, 0.15);
  assert.equal(transition.showScanEffects, false);
});

test("mantém uma altura definida em toda a cadeia do painel AIVA", () => {
  const markup = renderToStaticMarkup(createElement(AivaPanelTransition, {
    accentColor: "#00f0ff",
    children: createElement("div", null, "AIVA"),
  }));

  assert.match(markup, /class="relative h-full min-h-full"/);
});
