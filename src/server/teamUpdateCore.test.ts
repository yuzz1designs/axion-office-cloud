import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTeamUpdateInput } from "./teamUpdateCore";

test("normaliza um update diário com título e descrição", () => {
  assert.deepEqual(normalizeTeamUpdateInput({ title: "  Site   publicado ", description: "Concluí a nova homepage." }), {
    title: "Site publicado",
    description: "Concluí a nova homepage.",
  });
});

test("exige conteúdo real e aplica limites", () => {
  assert.throws(() => normalizeTeamUpdateInput({ title: "", description: "feito" }), /obrigatórios/);
  assert.throws(() => normalizeTeamUpdateInput({ title: "x".repeat(121), description: "feito" }), /120/);
  assert.throws(() => normalizeTeamUpdateInput({ title: "feito", description: "x".repeat(2001) }), /2000/);
});
