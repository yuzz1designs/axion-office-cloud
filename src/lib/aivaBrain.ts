export type AivaBrainId = "mark-i" | "mark-ii";

export const AIVA_BRAINS = {
  "mark-i": { id: "mark-i", label: "MARK I", description: "Operações diárias" },
  "mark-ii": { id: "mark-ii", label: "MARK II", description: "Raciocínio avançado" },
} as const satisfies Record<AivaBrainId, { id: AivaBrainId; label: string; description: string }>;

export function normalizeAivaBrain(value: unknown): AivaBrainId {
  return value === "mark-ii" ? "mark-ii" : "mark-i";
}
