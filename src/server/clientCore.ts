export type ClientProfileData = Record<string, unknown> & { name: string; legalName?: string; logoUrl?: string };

export function normalizeClientInput(input: Record<string, unknown>): ClientProfileData {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("CLIENT_NAME_REQUIRED");
  const normalized = { ...input, name, legalName: String(input.legalName || name).trim(), logoUrl: String(input.logoUrl || "").trim() };
  for (const field of ["vatNumber", "website", "generalEmail", "generalPhone", "industry", "headquarters", "executiveSummary"] as const) {
    if (field in normalized) normalized[field] = String(normalized[field] || "").trim();
  }
  return normalized;
}

export function validateClientLogo(mimeType: string, size: number) {
  const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  const extension = extensions[mimeType.toLowerCase()];
  if (!extension) throw new Error("Formato de logótipo inválido. Usa PNG, JPG ou WebP.");
  if (!Number.isFinite(size) || size <= 0) throw new Error("O ficheiro do logótipo está vazio.");
  if (size > 5 * 1024 * 1024) throw new Error("O logótipo não pode ultrapassar 5 MB.");
  return extension;
}

export function nextClientReference(references: string[]) {
  const highest = references.reduce((maximum, reference) => {
    const match = /^CLI-(\d+)$/i.exec(reference.trim());
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `CLI-${String(highest + 1).padStart(3, "0")}`;
}

export function sumMonthlyClientValue(clients: Array<{ mrrValue?: string }>) {
  return clients.reduce((total, client) => {
    const normalized = String(client.mrrValue || "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
}

export interface ClientDocumentReference {
  id: string;
  name: string;
  size: string;
  type: string;
  url?: string;
}

export function appendClientDocument(
  current: ClientDocumentReference[],
  uploaded: { id: string; name: string; extension: string; sizeLabel: string; webViewLink: string },
) {
  if (current.some((document) => document.id === uploaded.id)) return current;
  return [...current, {
    id: uploaded.id,
    name: uploaded.name,
    size: uploaded.sizeLabel,
    type: uploaded.extension,
    url: uploaded.webViewLink,
  }];
}
