import assert from "node:assert/strict";
import test from "node:test";
import { appendClientDocument, nextClientReference, normalizeClientInput, sumMonthlyClientValue, validateClientLogo } from "./clientCore";

test("normaliza uma ficha de cliente para persistência no Supabase", () => {
  const result = normalizeClientInput({ name: "  Empresa Teste  ", legalName: " Empresa Teste Lda. ", website: "https://empresa.pt", contacts: [{ name: "Ana" }] });
  assert.equal(result.name, "Empresa Teste");
  assert.equal(result.legalName, "Empresa Teste Lda.");
  assert.deepEqual(result.contacts, [{ name: "Ana" }]);
  assert.equal(result.logoUrl, "");
});

test("aceita apenas formatos seguros de logótipo até 5 MB", () => {
  assert.equal(validateClientLogo("image/png", 1024), "png");
  assert.equal(validateClientLogo("image/jpeg", 1024), "jpg");
  assert.equal(validateClientLogo("image/webp", 1024), "webp");
  assert.throws(() => validateClientLogo("image/svg+xml", 1024), /Formato/);
  assert.throws(() => validateClientLogo("image/png", 5 * 1024 * 1024 + 1), /5 MB/);
});

test("gera a referência seguinte sem reutilizar números eliminados", () => {
  assert.equal(nextClientReference(["CLI-001", "CLI-003"]), "CLI-004");
});

test("calcula o valor mensal real sem métricas de demonstração", () => {
  assert.equal(sumMonthlyClientValue([{ mrrValue: "€ 3.500,00 / mês" }, { mrrValue: "€ 750,50 / mês" }]), 4250.5);
  assert.equal(sumMonthlyClientValue([]), 0);
});

test("associa à ficha do cliente o documento carregado no Google Drive sem duplicar", () => {
  const current = [{ id: "drive-1", name: "Contrato.pdf", size: "120 KB", type: "PDF", url: "https://drive.google.com/one" }];
  const uploaded = {
    id: "drive-2",
    name: "Fatura.pdf",
    extension: "PDF",
    sizeLabel: "85 KB",
    webViewLink: "https://drive.google.com/two",
  };

  assert.deepEqual(appendClientDocument(current, uploaded), [
    ...current,
    { id: "drive-2", name: "Fatura.pdf", size: "85 KB", type: "PDF", url: "https://drive.google.com/two" },
  ]);
  assert.deepEqual(appendClientDocument(current, { ...uploaded, id: "drive-1" }), current);
});
