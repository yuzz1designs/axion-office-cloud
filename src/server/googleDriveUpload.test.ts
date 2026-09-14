import assert from "node:assert/strict";
import test from "node:test";
import { deleteDriveDocument, uploadDriveDocument } from "./googleDriveUpload";

test("upload usa token do utilizador e a pasta DOCS como parent", async () => {
  let authorization = "";
  let requestBody = "";
  const document = await uploadDriveDocument({
    accessToken: "user-access-token",
    folderId: "1_Xtah1WKj_YoxZoOjNABiM0TjuWBvef8",
    fileName: "Proposta.pdf",
    mimeType: "application/pdf",
    file: Buffer.from("pdf-content"),
    fetchImpl: async (_url, init) => {
      authorization = new Headers(init?.headers).get("Authorization") || "";
      requestBody = Buffer.from(init?.body as Buffer).toString("utf8");
      return new Response(JSON.stringify({
        id: "drive-file-1",
        name: "Proposta.pdf",
        mimeType: "application/pdf",
        size: "11",
        webViewLink: "https://drive.google.com/file/d/drive-file-1/view",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(authorization, "Bearer user-access-token");
  assert.match(requestBody, /"parents":\["1_Xtah1WKj_YoxZoOjNABiM0TjuWBvef8"\]/);
  assert.equal(document.id, "drive-file-1");
  assert.equal(document.name, "Proposta.pdf");
});

test("não declara sucesso quando o Drive rejeita o upload", async () => {
  await assert.rejects(() => uploadDriveDocument({
    accessToken: "user-access-token",
    folderId: "docs-folder",
    fileName: "Proposta.pdf",
    mimeType: "application/pdf",
    file: Buffer.from("pdf-content"),
    fetchImpl: async () => new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 }),
  }), /GOOGLE_DRIVE_UPLOAD_FAILED/);
});

test("elimina do Drive o ficheiro órfão usando supportsAllDrives", async () => {
  let requestUrl = "";
  let requestMethod = "";
  await deleteDriveDocument({
    accessToken: "token",
    documentId: "drive-42",
    fetchImpl: async (input, init) => {
      requestUrl = String(input);
      requestMethod = init?.method || "";
      return new Response(null, { status: 204 });
    },
  });
  assert.match(requestUrl, /\/files\/drive-42\?supportsAllDrives=true$/);
  assert.equal(requestMethod, "DELETE");
});
