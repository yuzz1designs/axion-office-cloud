import assert from "node:assert/strict";
import test from "node:test";
import { uploadAndAttachClientDocument } from "./clientDocumentUpload";

test("remove do Drive o documento quando a associação ao cliente falha", async () => {
  const removed: string[] = [];
  await assert.rejects(() => uploadAndAttachClientDocument({
    upload: async () => ({ id: "drive-42", name: "Contrato.pdf" }),
    attach: async () => { throw new Error("SUPABASE_FAILED"); },
    rollback: async (document) => { removed.push(document.id); },
  }), /SUPABASE_FAILED/);
  assert.deepEqual(removed, ["drive-42"]);
});

test("mantém o documento no Drive quando a associação ao cliente é concluída", async () => {
  const removed: string[] = [];
  const result = await uploadAndAttachClientDocument({
    upload: async () => ({ id: "drive-42", name: "Contrato.pdf" }),
    attach: async (document) => ({ id: "client-1", documentId: document.id }),
    rollback: async (document) => { removed.push(document.id); },
  });
  assert.deepEqual(result, { document: { id: "drive-42", name: "Contrato.pdf" }, client: { id: "client-1", documentId: "drive-42" } });
  assert.deepEqual(removed, []);
});

test("expõe a falha de compensação quando o documento não pode ser removido do Drive", async () => {
  await assert.rejects(() => uploadAndAttachClientDocument({
    upload: async () => ({ id: "drive-42" }),
    attach: async () => { throw new Error("SUPABASE_FAILED"); },
    rollback: async () => { throw new Error("DRIVE_DELETE_FAILED"); },
  }), /CLIENT_DOCUMENT_ROLLBACK_FAILED/);
});
