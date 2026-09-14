import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AivaToolCall, AivaToolResult } from "../lib/aivaTools";
import { runAivaCoreTurn, type AivaCoreTurnInput } from "./aivaCore";
import { currentDateTime } from "./aivaContextTools";
import { getGoogleWorkspaceState } from "./googleWorkspaceApi";

type CoreResult = Awaited<ReturnType<typeof runAivaCoreTurn>>;
type TurnRunner = (input: AivaCoreTurnInput) => Promise<CoreResult>;

interface DiscordConversation {
  id: string;
  previousResponseId?: string;
  updatedAt: number;
}

const DISCORD_TOOLS = new Set(["get_date_time", "list_tasks"]);

async function listTasks(client: SupabaseClient, userId: string, date: string) {
  const google = getGoogleWorkspaceState(userId).tasks || [];
  const { data, error } = await client.from("tasks").select("id,title,due_date,due_time,completed,priority")
    .eq("assignee_user_id", userId).eq("due_date", date).order("due_time");
  if (error) throw new Error(`AIVA_TASKS_FAILED:${error.message}`);
  const platform = (data || []).map((task) => ({ id: task.id, title: task.title, date: task.due_date, time: task.due_time ? String(task.due_time).slice(0, 5) : undefined, completed: task.completed, priority: task.priority, source: "AXION" }));
  return [...platform, ...google.filter((task) => !date || task.dueDate === date).map((task) => ({ id: task.id, title: task.title, date: task.dueDate, time: task.dueTime, completed: task.completed, priority: task.priority, source: "Google Tasks" }))];
}

export class AivaDiscordChannel {
  private readonly conversations = new Map<string, DiscordConversation>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly runTurn: TurnRunner,
    private readonly timeoutMs = 25_000,
  ) {}

  static fromEnvironment(client: SupabaseClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("AIVA_NOT_CONFIGURED");
    const openai = new OpenAI({ apiKey });
    return new AivaDiscordChannel(client, (input) => runAivaCoreTurn(openai, input));
  }

  conversationId(key: string) {
    return this.conversations.get(key)?.id;
  }

  async respond(key: string, userId: string, message: string) {
    const now = Date.now();
    for (const [storedKey, conversation] of this.conversations) {
      if (now - conversation.updatedAt > 30 * 60_000) this.conversations.delete(storedKey);
    }
    const conversation = this.conversations.get(key) || { id: randomUUID(), updatedAt: now };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      let result = await this.runTurn({ userId, message, previousResponseId: conversation.previousResponseId, brain: "mark-i", context: `discord:${conversation.id}`, source: "discord", availableToolNames: DISCORD_TOOLS, signal: controller.signal });
      for (let pass = 0; result.toolCalls.length && pass < 6; pass += 1) {
        const toolResults: AivaToolResult[] = [];
        for (const call of result.toolCalls) toolResults.push(await this.executeTool(userId, call));
        result = await this.runTurn({ userId, previousResponseId: result.responseId, brain: "mark-i", context: `discord:${conversation.id}`, source: "discord", toolResults, availableToolNames: DISCORD_TOOLS, signal: controller.signal });
      }
      conversation.previousResponseId = result.responseId;
      conversation.updatedAt = Date.now();
      this.conversations.set(key, conversation);
      return result.text || "Não consegui gerar uma resposta.";
    } finally {
      clearTimeout(timeout);
    }
  }

  private async executeTool(userId: string, call: AivaToolCall): Promise<AivaToolResult> {
    try {
      if (call.name === "get_date_time") return { callId: call.id, ok: true, output: currentDateTime() };
      if (call.name === "list_tasks") {
        const date = typeof call.arguments.date === "string" && call.arguments.date ? call.arguments.date : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
        return { callId: call.id, ok: true, output: { tasks: await listTasks(this.client, userId, date), date } };
      }
      return { callId: call.id, ok: false, output: { error: "Ferramenta indisponível neste canal." } };
    } catch (error) {
      return { callId: call.id, ok: false, output: { error: error instanceof Error ? error.message : "A ferramenta falhou." } };
    }
  }
}
