import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, mkdir, readFile, readdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { organizeDirectory } from "../../companion/fileOrganization";
import { webUrl } from "../../companion/macCapabilities";
import { issueComputerApproval, consumeComputerApproval } from "./aivaApproval";
import { buildToolOutputs } from "./aivaResponseCore";
import { realtimeReply } from "../lib/aivaVoicePolicy";
import { createRealtimeEventState, reduceRealtimeEvent } from "../components/aiva/aivaRealtimeCore";
import { COMPUTER_CONFIRM_TOOLS, COMPUTER_VISION_TOOLS, filterDeviceTools } from "../lib/aivaCapabilities";
import { getAivaToolPolicy, getOpenAiTools } from "../lib/aivaTools";

test("aprovação está ligada ao utilizador e argumentos e só funciona uma vez", () => {
  const args = { text: "Olá" };
  const token = issueComputerApproval("user-a", "computer_type", args);
  assert.equal(consumeComputerApproval(token, "user-a", "computer_type", args), true);
  assert.equal(consumeComputerApproval(token, "user-a", "computer_type", args), false);
  assert.equal(consumeComputerApproval(issueComputerApproval("a", "computer_type", args), "b", "computer_type", args), false);
  assert.equal(consumeComputerApproval(issueComputerApproval("a", "computer_type", args), "a", "computer_type", { text: "Outro" }), false);
});
test("fechar janelas e aplicações exige observação e confirmação no Mark II", () => {
  const names = ["computer_close_window", "computer_quit_application"];
  const markTwoTools = filterDeviceTools(getOpenAiTools(), "mark-ii", names).map(tool => tool.name);
  for (const name of names) {
    assert.equal(getAivaToolPolicy(name), "confirm");
    assert.equal(COMPUTER_CONFIRM_TOOLS.has(name), true);
    assert.equal(COMPUTER_VISION_TOOLS.has(name), true);
    assert.equal(markTwoTools.includes(name), true);
  }
  assert.equal(filterDeviceTools(getOpenAiTools(), "mark-i", names).some(tool => names.includes(tool.name)), false);
});
test("organização permite pré-visualização, conserva conflitos e ignora links", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "axion-organize-"));
  try {
    await writeFile(path.join(root, "foto.png"), "image");
    await writeFile(path.join(root, "nota.txt"), "original");
    await writeFile(path.join(root, "video.mp4"), "video");
    await mkdir(path.join(root, "Documentos"));
    await writeFile(path.join(root, "Documentos", "nota.txt"), "existing");
    await symlink(path.join(root, "Documentos"), path.join(root, "Vídeos"));
    const preview = await organizeDirectory(root, "type", true);
    assert.equal(preview.moved, 0);
    assert.ok(!(await readdir(root)).includes("Imagens"));
    const result = await organizeDirectory(root, "type", false);
    assert.equal(result.moved, 1);
    assert.equal(await readFile(path.join(root, "Imagens", "foto.png"), "utf8"), "image");
    assert.equal(await readFile(path.join(root, "nota.txt"), "utf8"), "original");
    assert.equal(await readFile(path.join(root, "Documentos", "nota.txt"), "utf8"), "existing");
    assert.equal(await readFile(path.join(root, "video.mp4"), "utf8"), "video");
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("sites não aceitam protocolos executáveis nem credenciais", () => {
  assert.equal(webUrl("https://google.com"), "https://google.com/");
  for (const url of ["file:///tmp/test", "javascript:alert(1)", "https://user:secret@example.com"]) assert.throws(() => webUrl(url));
});
test("captura chega ao modelo como imagem sem duplicar base64 no texto", () => {
  const image = "data:image/jpeg;base64,AA==";
  const output = buildToolOutputs([{ callId: "screen", ok: true, output: { image, width: 100 } }])[0].output;
  assert.ok(Array.isArray(output));
  assert.equal(output[1].type, "input_image");
  assert.ok(!JSON.stringify(output[0]).includes("base64"));
});
test("respostas de ferramentas conservam identidade e português europeu", () => {
  for (const purpose of ["answer", "done", "greeting"] as const) {
    const reply = realtimeReply("IDENTIDADE ORIGINAL", purpose);
    assert.match(reply.response.instructions, /IDENTIDADE ORIGINAL/);
    assert.match(reply.response.instructions, /pt-PT/);
  }
});
test("conflitos recuperáveis de voz não desligam sessão", () => {
  const state = { ...createRealtimeEventState(), status: "speaking" as const };
  assert.deepEqual(reduceRealtimeEvent(state, { type: "error", error: { code: "conversation_already_has_active_response" } }), state);
});
