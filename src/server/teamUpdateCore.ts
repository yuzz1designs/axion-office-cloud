export interface TeamUpdateInput {
  title: string;
  description: string;
}

export const MAX_TEAM_UPDATE_MEDIA_BYTES = 50 * 1024 * 1024;
export const MAX_TEAM_UPDATE_MEDIA_FILES = 4;
const TEAM_UPDATE_MEDIA_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/avif",
  "video/mp4", "video/webm", "video/quicktime",
]);

export function validateTeamUpdateMedia(contentType: string, byteLength: number) {
  const normalizedType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (!TEAM_UPDATE_MEDIA_TYPES.has(normalizedType)) throw new Error("TEAM_UPDATE_MEDIA_TYPE_INVALID");
  if (byteLength <= 0) throw new Error("TEAM_UPDATE_MEDIA_EMPTY");
  if (byteLength > MAX_TEAM_UPDATE_MEDIA_BYTES) throw new Error("TEAM_UPDATE_MEDIA_TOO_LARGE");
  return normalizedType;
}

export function normalizeTeamUpdateInput(raw: Record<string, unknown>): TeamUpdateInput {
  const title = String(raw.title || "").replace(/\s+/g, " ").trim();
  const description = String(raw.description || "").trim();
  if (!title || !description) throw new Error("O título e a descrição são obrigatórios.");
  if (title.length > 120) throw new Error("O título não pode exceder 120 caracteres.");
  if (description.length > 2000) throw new Error("A descrição não pode exceder 2000 caracteres.");
  return { title, description };
}
