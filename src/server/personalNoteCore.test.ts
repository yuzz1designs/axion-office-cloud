import assert from "node:assert/strict";
import test from "node:test";
import { normalizeNoteInput } from "./personalNoteCore";

test("normaliza notas privadas ou partilhadas com checklist e lembrete", () => {
  const value = normalizeNoteInput({ title: " Ideia ", content: "Texto", category: "idea", visibility: "team", color: "#AABBCC", checklist: [{ id: "item_1", text: " Fazer isto ", completed: false }], pinned: true, archived: false, reminderAt: "2026-10-20T10:00:00Z" });
  assert.deepEqual(value, { title: "Ideia", content: "Texto", category: "idea", visibility: "team", color: "#aabbcc", checklist: [{ id: "item_1", text: "Fazer isto", completed: false }], pinned: true, archived: false, reminderAt: "2026-10-20T10:00:00.000Z" });
});

test("rejeita categorias, cores e checklists inválidas", () => {
  assert.throws(() => normalizeNoteInput({ category: "x" }, true), /CATEGORY/);
  assert.throws(() => normalizeNoteInput({ color: "red" }, true), /COLOR/);
  assert.throws(() => normalizeNoteInput({ checklist: [{ id: "../x", text: "x" }] }, true), /CHECKLIST/);
});
