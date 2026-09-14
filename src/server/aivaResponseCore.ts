import type { AivaToolCall, AivaToolResult } from "../lib/aivaTools";
import { parseAivaToolArguments } from "../lib/aivaTools";

export function extractAivaToolCalls(response: { output?: unknown[] }): AivaToolCall[] {
  return (response.output ?? []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Record<string, unknown>;
    if (value.type !== "function_call" || typeof value.name !== "string" || typeof value.call_id !== "string") return [];
    return [{ id: value.call_id, name: value.name, arguments: parseAivaToolArguments(String(value.arguments || "{}")) }];
  });
}

export function buildToolOutputs(results: AivaToolResult[]) {
  return results.map((result) => {
    const { image, ...output } = result.output;
    return ({
    type: "function_call_output" as const,
    call_id: result.callId,
    output: typeof image === "string" && /^data:image\/(jpeg|png);base64,/.test(image)
      ? [{ type: "input_text" as const, text: JSON.stringify({ ok: result.ok, ...output }) }, { type: "input_image" as const, image_url: image, detail: "high" as const }]
      : JSON.stringify({ ok: result.ok, ...output }),
  }); });
}
