import type { IncomingMessage, ServerResponse } from "node:http";
import OpenAI, { toFile } from "openai";
import { normalizeRealtimeVoice } from "../lib/aivaRealtimeVoice";
import { normalizeAivaBrain } from "../lib/aivaBrain";
import { getOpenAiTools, type AivaToolResult } from "../lib/aivaTools";
import { AIVA_IDENTITY, AIVA_VOICE_INSTRUCTIONS } from "./aivaIdentity";
import { negotiateRealtimeCall, validateRealtimeSdp } from "./aivaRealtimeCore";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";
import { recordTeamActivity } from "./teamActivityStore";
import { AivaRateLimiter } from "./aivaRateLimit";
import { getAivaModel } from "./aivaModelRegistry";
import { brainAvailability } from "./aivaAvailability";
import { authorizeDesktopApplication, desktopStatus, pairDesktop, revokeDesktop, executeDesktop, listDesktopApplications, requestDesktopPermissions } from "./aivaDesktop";
import { isMacTool, MAC_MUTATIONS, filterDeviceTools, COMPUTER_CONFIRM_TOOLS, COMPUTER_VISION_TOOLS } from "../lib/aivaCapabilities";
import { issueComputerApproval, consumeComputerApproval } from "./aivaApproval";
import { currentDateTime, getWeather } from "./aivaContextTools";
import { buildRealtimeSession } from "./aivaRealtimeCore";
import { runAivaCoreTurn } from "./aivaCore";

const MAX_JSON_BYTES = 64_000;
const MAX_AUDIO_BYTES = 16_000_000;
const rateLimiter = new AivaRateLimiter();

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

async function readBody(req: IncomingMessage, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > limit) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

export async function handleAivaApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/aiva/")) return next();

  if (process.env.AXION_AIVA_ENABLED?.trim().toLowerCase() !== "true") {
    return sendJson(res, 503, { error: "A AIVA está desativada nesta fase do AXION OFFICE.", code: "AIVA_DISABLED" });
  }

  if (url.pathname === "/api/aiva/status" && req.method === "GET") {
    return sendJson(res, 200, { configured: Boolean(process.env.OPENAI_API_KEY), provider: "OpenAI", voice: "coral" });
  }

  const client = getClient();
  if (!client) return sendJson(res, 503, { error: "A AIVA ainda precisa da OPENAI_API_KEY no servidor.", code: "AIVA_NOT_CONFIGURED" });

  const backend = getSupabaseBackend();
  if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
  const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails()).catch(() => null);
  if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
  const rateLimits: Record<string, number> = { "/api/aiva/respond": 30, "/api/aiva/transcribe": 20, "/api/aiva/speech": 40, "/api/aiva/realtime/session": 10, "/api/aiva/audit": 120 };
  const limit = rateLimits[url.pathname] ?? 30;
  if (!rateLimiter.consume(`${user.id}:${url.pathname}`, limit)) return sendJson(res, 429, { error: "Limite temporário da AIVA atingido. Tenta novamente dentro de um minuto.", code: "AIVA_RATE_LIMITED" });

  try {
    if (req.method !== "GET" && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return sendJson(res, 403, { error: "Origem não autorizada." });
    if (url.pathname === "/api/aiva/capabilities" && req.method === "GET") {
      const [brains, desktop] = await Promise.all([Promise.all([brainAvailability(client, "mark-i"), brainAvailability(client, "mark-ii")]), desktopStatus(backend.client, user.id)]);
      return sendJson(res, 200, { brains, desktop });
    }
    if (url.pathname === "/api/aiva/realtime/config" && req.method === "GET") {
      const brain = normalizeAivaBrain(url.searchParams.get("brain"));
      const availability = await brainAvailability(client, brain);
      if (!availability.available) return sendJson(res, 503, { error: availability.reason });
      const config = buildRealtimeSession("coral", process.env, brain);
      const desktop = await desktopStatus(backend.client, user.id);
      return sendJson(res, 200, { instructions: `${config.instructions}\nMódulo atual: ${String(url.searchParams.get("context") || "overview").slice(0, 40)}.\n${JSON.stringify(currentDateTime())}\nmacOS: ${desktop.connected ? "ligado; usa apenas ferramentas anunciadas" : "desligado"}. Para tarefas que exigem ver o ecrã ou controlar interfaces, chama consult_active_brain com o pedido completo.`, tools: filterDeviceTools(getOpenAiTools(true, false), brain, desktop.capabilities).filter(tool => !COMPUTER_VISION_TOOLS.has(tool.name)) });
    }
    if (url.pathname === "/api/aiva/desktop/pair" && req.method === "POST") {
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress || "")) return sendJson(res, 403, { error: "Esta versão do Companion associa-se através do localhost do próprio Mac." });
      const body = JSON.parse((await readBody(req, MAX_JSON_BYTES)).toString()) as { code?: string };
      return sendJson(res, 200, await pairDesktop(backend.client, user.id, String(body.code || "")));
    }
    if (url.pathname === "/api/aiva/desktop/revoke" && req.method === "POST") return sendJson(res, 200, await revokeDesktop(backend.client, user.id));
    if (url.pathname === "/api/aiva/desktop/permissions" && req.method === "POST") return sendJson(res, 200, await requestDesktopPermissions(backend.client, user.id));
    if (url.pathname === "/api/aiva/desktop/apps" && req.method === "GET") return sendJson(res, 200, await listDesktopApplications(backend.client, user.id));
    if (url.pathname === "/api/aiva/desktop/apps/authorize" && req.method === "POST") {
      const body = JSON.parse((await readBody(req, MAX_JSON_BYTES)).toString()) as { bundleId?: string; authorized?: boolean };
      return sendJson(res, 200, await authorizeDesktopApplication(backend.client, user.id, String(body.bundleId || ""), body.authorized === true));
    }
    if (url.pathname === "/api/aiva/desktop/approve" && req.method === "POST") {
      const body = JSON.parse((await readBody(req, MAX_JSON_BYTES)).toString());
      if (!COMPUTER_CONFIRM_TOOLS.has(body.name)) return sendJson(res, 400, { error: "Ação de confirmação inválida." });
      return sendJson(res, 200, { approval: issueComputerApproval(user.id, body.name, body.arguments || {}) });
    }
    if (url.pathname === "/api/aiva/tool" && req.method === "POST") {
      const body = JSON.parse((await readBody(req, MAX_JSON_BYTES)).toString()) as { name: string; arguments?: Record<string, unknown>; brain?: string; approval?: string };
      const args = body.arguments || {};
      if (body.name === "get_date_time") return sendJson(res, 200, currentDateTime());
      if (body.name === "get_weather") return sendJson(res, 200, await getWeather(String(args.location || "")));
      if (body.name === "search_web") {
        const brain = normalizeAivaBrain(body.brain);
        if (!(await brainAvailability(client, brain)).available) return sendJson(res, 503, { error: "Cérebro indisponível." });
        const result = await client.responses.create({ model: getAivaModel(brain), input: String(args.query || "").slice(0, 2000), instructions: "Pesquisa informação atual. Responde em pt-PT, de forma breve, com fontes. Não executes outras ações.", tools: [{ type: "web_search" }], max_output_tokens: 1200 });
        const sources = result.output.flatMap(item => item.type === "message" ? item.content.flatMap(part => part.type === "output_text" ? part.annotations.filter(annotation => annotation.type === "url_citation").map(annotation => ({ title: annotation.title, url: annotation.url })) : []) : []);
        return sendJson(res, 200, { text: result.output_text, sources });
      }
      if (!isMacTool(body.name)) return sendJson(res, 403, { error: "Ferramenta não permitida." });
      if (body.brain !== "mark-ii" || !(await brainAvailability(client, "mark-ii")).available) return sendJson(res, 403, { error: "As capacidades macOS requerem Mark II disponível." });
      const approved = COMPUTER_CONFIRM_TOOLS.has(body.name) && consumeComputerApproval(body.approval || "", user.id, body.name, args);
      if (COMPUTER_CONFIRM_TOOLS.has(body.name) && !approved) return sendJson(res, 403, { error: "Confirmação necessária ou expirada." });
      const result = await executeDesktop(backend.client, user.id, body.name, args, approved);
      if (MAC_MUTATIONS.has(body.name)) {
        try { await recordTeamActivity(backend.client, user.id, "aiva.tool.executed", "aiva_tool", null, { tool: body.name, brain: "mark-ii", ok: true, ...(body.name === "set_system_volume" ? { percent: args.percent } : {}), ...(body.name === "set_system_muted" ? { muted: args.muted } : {}), ...(typeof args.path === "string" ? { file: args.path.split("/").at(-1) } : {}) }); }
        catch { return sendJson(res, 200, { ...result, auditWarning: "Ação concluída; registo de auditoria indisponível." }); }
      }
      return sendJson(res, 200, result);
    }
    if (url.pathname === "/api/aiva/audit" && req.method === "POST") {
      const body = JSON.parse((await readBody(req, MAX_JSON_BYTES)).toString("utf8")) as { tool?: string; ok?: boolean };
      await recordTeamActivity(backend.client, user.id, "aiva.tool.executed", "aiva_tool", null, { tool: String(body.tool || "unknown").slice(0, 80), ok: body.ok === true });
      return sendJson(res, 201, { recorded: true });
    }

    if (url.pathname === "/api/aiva/realtime/session" && req.method === "POST") {
      if (!String(req.headers["content-type"] || "").startsWith("application/sdp")) {
        return sendJson(res, 415, { error: "O pedido Realtime requer SDP." });
      }
      const rawSdp = (await readBody(req, MAX_JSON_BYTES)).toString("utf8");
      if (!rawSdp.trim()) return sendJson(res, 400, { error: "Não foi recebido SDP." });
      const sdp = validateRealtimeSdp(rawSdp);
      if (!(await brainAvailability(client, normalizeAivaBrain(url.searchParams.get("brain")))).available) return sendJson(res, 503, { error: "Cérebro indisponível nesta conta." });
      const result = await negotiateRealtimeCall({
        sdp,
        voice: normalizeRealtimeVoice(url.searchParams.get("voice")),
        userId: user.id,
        apiKey: process.env.OPENAI_API_KEY!,
        brain: normalizeAivaBrain(url.searchParams.get("brain")),
      });
      if (result.ok === false) return sendJson(res, result.status, { error: result.error });
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/sdp");
      res.setHeader("Cache-Control", "no-store");
      return res.end(result.sdp);
    }

    if (url.pathname === "/api/aiva/respond" && req.method === "POST") {
      const raw = await readBody(req, 6_000_000);
      const body = JSON.parse(raw.toString("utf8")) as { message?: string; history?: Array<{ role: string; content: string }>; previousResponseId?: string | null; brain?: string; context?: string; toolsDisabled?: boolean; toolResults?: AivaToolResult[] };
      const message = body.message?.trim();
      const toolResults = Array.isArray(body.toolResults) ? body.toolResults : [];
      if (!message && !toolResults.length) return sendJson(res, 400, { error: "A mensagem é obrigatória." });
      const brain = normalizeAivaBrain(body.brain);
      const availability = await brainAvailability(client, brain);
      if (!availability.available) return sendJson(res, 503, { error: availability.reason, code: "AIVA_BRAIN_UNAVAILABLE" });
      const history = (Array.isArray(body.history) ? body.history : []).filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string").slice(-40).map(item => ({ role: item.role as "user" | "assistant", content: item.content.slice(0, 4000) }));
      const desktop = brain === "mark-ii" ? await desktopStatus(backend.client, user.id) : { capabilities: [] };

      return sendJson(res, 200, await runAivaCoreTurn(client, {
        userId: user.id, message, history, previousResponseId: body.previousResponseId,
        brain, context: body.context, source: "app", toolResults, toolsDisabled: body.toolsDisabled,
        desktopCapabilities: desktop.capabilities,
      }));
    }

    if (url.pathname === "/api/aiva/transcribe" && req.method === "POST") {
      const audio = await readBody(req, MAX_AUDIO_BYTES);
      if (!audio.length) return sendJson(res, 400, { error: "Não foi recebido áudio." });
      const mime = String(req.headers["content-type"] || "audio/webm").split(";")[0];
      const extension = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const transcription = await client.audio.transcriptions.create({
        file: await toFile(audio, `aiva-input.${extension}`, { type: mime }),
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
        language: "pt",
      });
      return sendJson(res, 200, { text: transcription.text });
    }

    if (url.pathname === "/api/aiva/speech" && req.method === "POST") {
      const raw = await readBody(req, MAX_JSON_BYTES);
      const body = JSON.parse(raw.toString("utf8")) as { text?: string; voice?: string };
      const text = body.text?.trim().slice(0, 4000);
      if (!text) return sendJson(res, 400, { error: "O texto é obrigatório." });
      const speech = await client.audio.speech.create({
        model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
        voice: normalizeRealtimeVoice(body.voice),
        input: text,
        instructions: AIVA_VOICE_INSTRUCTIONS,
        response_format: "mp3",
      });
      const buffer = Buffer.from(await speech.arrayBuffer());
      res.statusCode = 200;
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.end(buffer);
    }

    return sendJson(res, 404, { error: "Endpoint AIVA não encontrado." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[AIVA API]", message);
    return sendJson(res, message === "PAYLOAD_TOO_LARGE" ? 413 : 500, { error: url.pathname === "/api/aiva/tool" || url.pathname.startsWith("/api/aiva/desktop/") ? (message.includes("fetch failed") ? "Companion desligado. Inicia-o no Mac e associa o código." : message.slice(0, 240)) : "Não foi possível concluir o pedido da AIVA." });
  }
}
