import type { AivaBrainId } from "./aivaBrain";
import { MAC_TOOLS, COMPUTER_CONFIRM_TOOLS } from "./aivaCapabilities";

export type AivaToolPolicy = "automatic" | "confirm";
export type AivaSection = "overview" | "clients" | "database" | "documents" | "calendar" | "payments" | "aiva" | "settings" | "profile" | "notifications";

export interface AivaToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AivaToolResult {
  callId: string;
  ok: boolean;
  output: Record<string, unknown>;
}

type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  policy: AivaToolPolicy;
};

const object = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const string = (description: string, values?: string[]) => ({ type: "string", description, ...(values ? { enum: values } : {}) });

export const AIVA_TOOL_DEFINITIONS: ToolDefinition[] = [
  { name: "get_date_time", description: "Obtém data, hora e timezone reais. Usa antes de calcular datas relativas.", parameters: object({}), policy: "automatic" },
  { name: "search_web", description: "Pesquisa informação atual na web e devolve fontes reais.", parameters: object({ query: string("Pesquisa") }, ["query"]), policy: "automatic" },
  { name: "get_weather", description: "Previsão real para location (cidade) incluindo horas locais e precipitação. Pergunta a cidade quando desconhecida.", parameters: object({ location: string("Cidade") }, ["location"]), policy: "automatic" },
  ...Object.entries(MAC_TOOLS).map(([name, description]) => ({ name, description, parameters: object(macParameters(name), ["computer_close_window", "computer_quit_application"].includes(name) ? ["application"] : name === "run_shell_command" ? ["command", "cwd"] : []), policy: COMPUTER_CONFIRM_TOOLS.has(name) ? "confirm" as const : "automatic" as const })),
  { name: "navigate_to_section", description: "Abre um módulo do AXION OFFICE.", parameters: object({ section: string("Módulo", ["overview", "clients", "database", "documents", "calendar", "payments", "aiva", "settings", "profile", "notifications"]) }, ["section"]), policy: "automatic" },
  { name: "open_client", description: "Abre a ficha de um cliente pelo nome.", parameters: object({ query: string("Nome ou parte do nome do cliente") }, ["query"]), policy: "automatic" },
  { name: "open_document", description: "Abre um documento no depósito pelo nome.", parameters: object({ query: string("Nome ou parte do nome do documento") }, ["query"]), policy: "automatic" },
  { name: "open_meeting", description: "Abre uma reunião ou evento pelo respetivo ID.", parameters: object({ meetingId: string("ID devolvido por list_calendar") }, ["meetingId"]), policy: "automatic" },
  { name: "set_hands_free", description: "Liga ou desliga o modo Hands Free.", parameters: object({ enabled: { type: "boolean" } }, ["enabled"]), policy: "automatic" },
  { name: "set_aiva_brain", description: "Alterna o cérebro da AIVA entre Mark I e Mark II.", parameters: object({ brain: string("Cérebro", ["mark-i", "mark-ii"]) }, ["brain"]), policy: "automatic" },
  { name: "consult_active_brain", description: "Encaminha raciocínio complexo para o cérebro ativo. Uso interno da voz Realtime.", parameters: object({ query: string("Pedido completo do utilizador") }, ["query"]), policy: "automatic" },
  { name: "list_clients", description: "Consulta os clientes reais do AXION OFFICE.", parameters: object({ query: string("Filtro opcional") }), policy: "automatic" },
  { name: "list_documents", description: "Consulta documentos reais da pasta AXION / DOCS.", parameters: object({ query: string("Filtro opcional") }), policy: "automatic" },
  { name: "list_tasks", description: "Consulta tarefas sincronizadas com Google Tasks.", parameters: object({ date: string("Data YYYY-MM-DD opcional") }), policy: "automatic" },
  { name: "create_task", description: "Cria uma tarefa no Google Tasks AXION OFFICE.", parameters: object({ title: string("Título"), date: string("Data YYYY-MM-DD"), time: string("Hora HH:MM"), notes: string("Notas opcionais"), estimatedMinutes: { type: "number" } }, ["title", "date"]), policy: "automatic" },
  { name: "list_calendar", description: "Consulta reuniões e eventos sincronizados com Google Calendar.", parameters: object({ date: string("Data YYYY-MM-DD opcional") }), policy: "automatic" },
  { name: "list_payments", description: "Consulta pagamentos, vencimentos e totais financeiros no Supabase.", parameters: object({ status: string("Filtro opcional") }), policy: "automatic" },
  { name: "mark_payment_paid", description: "Marca uma despesa como paga. Exige confirmação explícita.", parameters: object({ paymentId: string("ID do pagamento"), actualAmount: { type: "number" } }, ["paymentId", "actualAmount"]), policy: "confirm" },
  { name: "delete_client", description: "Elimina uma ficha de cliente. Exige confirmação explícita.", parameters: object({ clientId: string("ID do cliente") }, ["clientId"]), policy: "confirm" },
];

function macParameters(name: string): Record<string, unknown> {
  const fields: Record<string, Record<string, unknown>> = {
    open_application: { application: string("Nome da aplicação instalada") },
    open_website: { url: string("URL HTTP/HTTPS"), application: string("Browser opcional") },
    browser_search: { query: string("Pesquisa Google"), application: string("Browser opcional") },
    list_directory: { path: string("Pasta absoluta") }, create_directory: { path: string("Nova pasta absoluta") },
    organize_files: { path: string("Pasta a organizar"), strategy: string("Organização", ["type", "month"]), preview: { type: "boolean" } },
    computer_click: { x: { type: "number" }, y: { type: "number" }, button: string("Botão", ["left", "right"]) },
    computer_type: { text: string("Texto a escrever") },
    computer_key: { key: string("Tecla"), modifier: string("Modificador opcional", ["command", "shift", "option", "control"]) },
    computer_scroll: { deltaY: { type: "integer" }, deltaX: { type: "integer" } },
    computer_close_window: { application: string("Aplicação alvo, por exemplo Safari, Google Chrome, Finder ou TextEdit") },
    computer_quit_application: { application: string("Aplicação a terminar") },
    set_system_volume: { percent: { type: "integer", minimum: 0, maximum: 100 } },
    set_system_muted: { muted: { type: "boolean" } },
    write_clipboard: { text: string("Texto a copiar") }, show_notification: { text: string("Notificação") },
    find_file: { query: string("Nome procurado") },
    read_file: { path: string("Ficheiro absoluto") }, create_file: { path: string("Ficheiro absoluto"), text: string("Conteúdo") },
    copy_file: { path: string("Origem"), destination: string("Destino") }, move_file: { path: string("Origem"), destination: string("Destino") },
    open_file: { path: string("Ficheiro absoluto") }, reveal_file: { path: string("Ficheiro absoluto") },
    run_shell_command: { command: string("Comando shell"), cwd: string("Pasta de trabalho absoluta e autorizada") },
  };
  return fields[name] || {};
}

export function getAivaToolPolicy(name: string): AivaToolPolicy | undefined {
  return AIVA_TOOL_DEFINITIONS.find((tool) => tool.name === name)?.policy;
}

export function parseAivaToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value || "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error("AIVA_TOOL_ARGUMENTS_INVALID");
  }
}

export function getOpenAiTools(includeDelegation = false, responsesApi = true) {
  return AIVA_TOOL_DEFINITIONS.filter((tool) => includeDelegation || tool.name !== "consult_active_brain").map(({ name, description, parameters }) => ({ type: "function" as const, name, description, parameters, ...(responsesApi ? { strict: false } : {}) }));
}

export function isAivaBrain(value: unknown): value is AivaBrainId {
  return value === "mark-i" || value === "mark-ii";
}

const CONCISE_COMPLETION_TOOLS = new Set(["navigate_to_section", "open_client", "open_document", "open_meeting", "set_hands_free", "set_aiva_brain", "create_task", "mark_payment_paid", "delete_client", "computer_close_window", "computer_quit_application"]);

export function isConciseCompletionTool(name: string) {
  return name === "open_finder" || CONCISE_COMPLETION_TOOLS.has(name);
}
