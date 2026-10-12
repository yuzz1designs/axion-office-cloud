import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TEAM_UPDATE_MEDIA_BYTES, normalizeTeamUpdateInput, pendingTeamUpdateViewerIds, validateTeamUpdateMedia } from "./teamUpdateCore";

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

test("aceita imagens e vídeos compatíveis nos updates", () => {
  assert.equal(validateTeamUpdateMedia("image/jpeg", 1024), "image/jpeg");
  assert.equal(validateTeamUpdateMedia("video/mp4; codecs=h264", MAX_TEAM_UPDATE_MEDIA_BYTES), "video/mp4");
});

test("rejeita anexos vazios, demasiado grandes ou incompatíveis", () => {
  assert.throws(() => validateTeamUpdateMedia("application/pdf", 1024), /TYPE_INVALID/);
  assert.throws(() => validateTeamUpdateMedia("image/png", 0), /EMPTY/);
  assert.throws(() => validateTeamUpdateMedia("video/mp4", MAX_TEAM_UPDATE_MEDIA_BYTES + 1), /TOO_LARGE/);
});

test("calcula quem ainda não abriu o update sem contar o autor", () => {
  assert.deepEqual(pendingTeamUpdateViewerIds("nelson", ["nelson", "sousa", "joao"], ["sousa"]), ["joao"]);
  assert.deepEqual(pendingTeamUpdateViewerIds("nelson", ["nelson", "sousa", "joao"], ["sousa", "joao"]), []);
});
