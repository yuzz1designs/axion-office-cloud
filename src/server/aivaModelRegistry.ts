import type { AivaBrainId } from "../lib/aivaBrain";

type Environment = Record<string, string | undefined>;

export function getAivaModel(brain: AivaBrainId, environment: Environment = process.env) {
  return brain === "mark-ii"
    ? "gpt-6-astra"
    : environment.OPENAI_AIVA_MARK_I_MODEL || environment.OPENAI_MODEL || "gpt-5.4";
}
