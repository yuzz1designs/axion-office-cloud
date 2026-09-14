import type OpenAI from "openai";
import { normalizeAivaBrain, type AivaBrainId } from "../lib/aivaBrain";
import { filterDeviceTools } from "../lib/aivaCapabilities";
import { getOpenAiTools, type AivaToolResult } from "../lib/aivaTools";
import { AIVA_IDENTITY } from "./aivaIdentity";
import { getAivaModel } from "./aivaModelRegistry";
import { buildToolOutputs, extractAivaToolCalls } from "./aivaResponseCore";

export interface AivaCoreTurnInput {
  userId: string;
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  previousResponseId?: string | null;
  brain?: AivaBrainId | string;
  context?: string;
  source?: "app" | "discord";
  toolResults?: AivaToolResult[];
  toolsDisabled?: boolean;
  availableToolNames?: Set<string>;
  desktopCapabilities?: string[];
  signal?: AbortSignal;
}

export async function runAivaCoreTurn(client: OpenAI, input: AivaCoreTurnInput) {
  const brain = normalizeAivaBrain(input.brain);
  const history = (input.history || []).slice(-40).map((item) => ({ role: item.role, content: item.content.slice(0, 4000) }));
  const toolResults = input.toolResults || [];
  const tools = filterDeviceTools(getOpenAiTools(), brain, input.desktopCapabilities || [])
    .filter((tool) => !input.availableToolNames || input.availableToolNames.has(tool.name));
  const response = await client.responses.create({
    model: getAivaModel(brain),
    instructions: `${AIVA_IDENTITY}\nCONTEXTO DO CANAL\n- Origem: ${input.source || "app"}.\n- Módulo: ${String(input.context || "desconhecido").slice(0, 40)}.\n- Data atual em Europe/Lisbon: ${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date())}.`,
    input: toolResults.length ? buildToolOutputs(toolResults) : [...history, { role: "user" as const, content: String(input.message || "") }],
    previous_response_id: input.previousResponseId || undefined,
    store: true,
    max_output_tokens: brain === "mark-ii" ? 2400 : 900,
    text: { verbosity: "low" },
    safety_identifier: `axion-office:${input.userId}`,
    ...(input.toolsDisabled ? {} : { tools }),
  } as Parameters<typeof client.responses.create>[0], { signal: input.signal }) as unknown as { id: string; output_text: string; output?: unknown[] };
  return { text: response.output_text, responseId: response.id, brain, toolCalls: extractAivaToolCalls(response) };
}
