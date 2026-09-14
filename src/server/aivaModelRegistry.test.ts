import assert from "node:assert/strict";
import test from "node:test";
import { getAivaModel } from "./aivaModelRegistry";

test("keeps model identifiers server-side and allows explicit deployment overrides", () => {
  assert.equal(getAivaModel("mark-i", {}), "gpt-5.4");
  assert.equal(getAivaModel("mark-ii", {}), "gpt-6-astra");
  assert.equal(getAivaModel("mark-i", { OPENAI_AIVA_MARK_I_MODEL: "standard-deployment" }), "standard-deployment");
  assert.equal(getAivaModel("mark-ii", { OPENAI_AIVA_MARK_II_MODEL: "advanced-deployment" }), "gpt-6-astra");
});
