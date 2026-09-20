export interface TeamUpdateInput {
  title: string;
  description: string;
}

export function normalizeTeamUpdateInput(raw: Record<string, unknown>): TeamUpdateInput {
  const title = String(raw.title || "").replace(/\s+/g, " ").trim();
  const description = String(raw.description || "").trim();
  if (!title || !description) throw new Error("O título e a descrição são obrigatórios.");
  if (title.length > 120) throw new Error("O título não pode exceder 120 caracteres.");
  if (description.length > 2000) throw new Error("A descrição não pode exceder 2000 caracteres.");
  return { title, description };
}
