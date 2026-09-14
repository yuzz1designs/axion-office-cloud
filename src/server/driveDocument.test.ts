import assert from "node:assert/strict";
import test from "node:test";
import { decodeUploadFileName, formatFileSize, mapDriveFile, validateDriveUpload, type DriveFile } from "./driveDocument";

test("normaliza um PDF do Drive para o contrato do depósito", () => {
  const file: DriveFile = {
    id: "pdf-1",
    name: "Proposta.pdf",
    mimeType: "application/pdf",
    size: "1536000",
    modifiedTime: "2026-09-02T10:30:00.000Z",
    createdTime: "2026-09-01T09:00:00.000Z",
    webViewLink: "https://drive.google.com/file/d/pdf-1/view",
    description: "Proposta comercial",
    owners: [{ displayName: "Nelson Afonso" }],
  };

  assert.deepEqual(mapDriveFile(file), {
    id: "pdf-1",
    name: "Proposta.pdf",
    mimeType: "application/pdf",
    extension: "PDF",
    size: 1536000,
    sizeLabel: "1,5 MB",
    modifiedTime: "2026-09-02T10:30:00.000Z",
    createdTime: "2026-09-01T09:00:00.000Z",
    webViewLink: "https://drive.google.com/file/d/pdf-1/view",
    description: "Proposta comercial",
    owner: "Nelson Afonso",
    isFolder: false,
  });
});

test("identifica pastas e não inventa tamanho ou extensão", () => {
  const folder: DriveFile = {
    id: "folder-1",
    name: "Contratos",
    mimeType: "application/vnd.google-apps.folder",
  };

  const result = mapDriveFile(folder);
  assert.equal(result.isFolder, true);
  assert.equal(result.extension, "PASTA");
  assert.equal(result.size, null);
  assert.equal(result.sizeLabel, "—");
});

test("formata bytes com unidades legíveis", () => {
  assert.equal(formatFileSize(0), "0 B");
  assert.equal(formatFileSize(1024), "1 KB");
  assert.equal(formatFileSize(1536000), "1,5 MB");
});

test("aceita um upload válido até 50 MB", () => {
  assert.doesNotThrow(() => validateDriveUpload({ fileName: "Proposta final.pdf", byteLength: 1024 }));
  assert.doesNotThrow(() => validateDriveUpload({ fileName: "limite.zip", byteLength: 50 * 1024 * 1024 }));
});

test("rejeita ficheiros vazios ou superiores a 50 MB", () => {
  assert.throws(() => validateDriveUpload({ fileName: "vazio.pdf", byteLength: 0 }), /vazio/i);
  assert.throws(() => validateDriveUpload({ fileName: "grande.zip", byteLength: 50 * 1024 * 1024 + 1 }), /50 MB/i);
});

test("descodifica nomes Unicode enviados de forma segura no cabeçalho", () => {
  assert.equal(decodeUploadFileName(encodeURIComponent("Proposta João — versão 2.pdf")), "Proposta João — versão 2.pdf");
  assert.throws(() => decodeUploadFileName(""), /nome/i);
});
