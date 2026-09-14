import { createHash } from "node:crypto";
import type { AivaRealtimeVoice } from "../lib/aivaRealtimeVoice";
import { getOpenAiTools } from "../lib/aivaTools";
import type { AivaBrainId } from "../lib/aivaBrain";
import { AIVA_IDENTITY } from "./aivaIdentity";
import { filterDeviceTools } from "../lib/aivaCapabilities";

type Environment = Record<string, string | undefined>;

export function validateRealtimeSdp(sdp: string) {
  if (!sdp.trim()) throw new Error("SDP_EMPTY");
  return sdp;
}

export function buildRealtimeSession(voice: AivaRealtimeVoice, environment: Environment = process.env, brain: AivaBrainId = "mark-i") {
  const brainInstruction = brain === "mark-ii"
    ? "O cérebro ativo é MARK II. Para qualquer pedido que exija raciocínio, análise ou resposta substantiva, chama consult_active_brain e comunica fielmente a resposta devolvida. Podes usar diretamente as restantes ferramentas para ações simples."
    : "O cérebro ativo é MARK I. Responde diretamente a cumprimentos e ações simples. Para respostas substantivas, raciocínio ou consulta de contexto anterior, chama consult_active_brain. Para dados atuais usa as ferramentas.";
  return {
    type: "realtime" as const,
    model: environment.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    instructions: `${AIVA_IDENTITY}\nCÉREBRO ATIVO\n${brainInstruction}`,
    tools: filterDeviceTools(getOpenAiTools(true, false), brain, []),
    tool_choice: "auto" as const,
    output_modalities: ["audio"] as const,
    audio: {
      input: {
        transcription: {
          model: environment.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
          language: "pt",
        },
        turn_detection: {
          type: "semantic_vad" as const,
          eagerness: "medium" as const,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice },
    },
  };
}

export function createSafetyIdentifier(userId: string) {
  return createHash("sha256").update(`axion-aiva:${userId}`).digest("hex");
}

interface RealtimeCallInput {
  sdp: string;
  voice: AivaRealtimeVoice;
  userId: string;
  apiKey: string;
  environment?: Environment;
  brain?: AivaBrainId;
}

type RealtimeCallResult =
  | { ok: true; status: number; sdp: string }
  | { ok: false; status: number; error: string };

export async function negotiateRealtimeCall(
  input: RealtimeCallInput,
  fetchImpl: typeof fetch = fetch,
  reportError: (status: number, detail: string) => void = () => undefined,
): Promise<RealtimeCallResult> {
  const form = new FormData();
  form.set("sdp", input.sdp);
  form.set("session", JSON.stringify(buildRealtimeSession(input.voice, input.environment, input.brain)));
  const response = await fetchImpl("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "OpenAI-Safety-Identifier": createSafetyIdentifier(input.userId),
    },
    body: form,
  });
  if (!response.ok) {
    const diagnostic = (await response.text()).slice(0, 1_500);
    reportError(response.status, diagnostic);
    return { ok: false, status: response.status, error: "Não foi possível iniciar a sessão Realtime." };
  }
  return { ok: true, status: response.status, sdp: await response.text() };
}
