import type OpenAI from "openai";
import type { BrainAvailability } from "../lib/aivaCapabilities";
import { getAivaModel } from "./aivaModelRegistry";

const cache = new Map<string, { until: number; value: Promise<BrainAvailability> }>();
export function brainAvailability(client: OpenAI, id: "mark-i" | "mark-ii"): Promise<BrainAvailability> {
  const model = getAivaModel(id);
  const cached = cache.get(model);
  if (cached && cached.until > Date.now()) return cached.value.then(value => ({ ...value, id }));
  const value = client.models.retrieve(model, { timeout: 10000, maxRetries: 0 }).then(() => ({ id, available: true, capabilities: ["office", "web", "weather", ...(id === "mark-ii" ? ["macos", "advanced_reasoning"] : [])] })).catch(() => ({ id, available: false, capabilities: [], reason: "Modelo indisponível nesta conta ou ligação temporariamente indisponível." }));
  cache.set(model, { until: Date.now() + 60000, value });
  return value;
}
