import type { AivaBrainId } from "../../lib/aivaBrain";
import type { AivaSection, AivaToolCall, AivaToolResult } from "../../lib/aivaTools";
import { isMacTool, COMPUTER_CONFIRM_TOOLS } from "../../lib/aivaCapabilities";

export interface AivaActionHost {
  navigate: (section: AivaSection) => void;
  openClient?: (query: string) => void;
  openDocument?: (query: string) => void;
  openMeeting?: (meetingId: string) => void;
  setHandsFree?: (enabled: boolean) => Promise<void> | void;
  setBrain?: (brain: AivaBrainId) => Promise<void> | void;
  consultBrain?: (query: string) => Promise<string | undefined>;
  brain?: AivaBrainId;
  confirm?: (message: string) => boolean;
  fetch?: typeof fetch;
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "A ação não foi concluída.");
  return data;
}

export async function executeAivaToolCall(call: AivaToolCall, host: AivaActionHost): Promise<AivaToolResult> {
  const request = host.fetch ?? fetch;
  try {
    if (isMacTool(call.name) || ["get_date_time", "search_web", "get_weather"].includes(call.name)) {
      let approval: string | undefined;
      if (COMPUTER_CONFIRM_TOOLS.has(call.name)) {
        if (["computer_close_window", "computer_quit_application"].includes(call.name)) {
          const application = text(call.arguments.application);
          if (!application) throw new Error("Indica a aplicação que deve ser fechada.");
          await readJson(await request("/api/aiva/tool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "computer_screenshot", arguments: { application }, brain: host.brain }) }));
        }
        const details = call.name === "computer_type"
          ? `Escrever: ${String(call.arguments.text || "")}`
          : call.name === "computer_key"
            ? `Premir: ${[call.arguments.modifier, call.arguments.key].filter(Boolean).join(" + ")}`
            : call.name === "computer_close_window"
              ? `Fechar o separador, janela, pasta ou documento ativo em ${text(call.arguments.application)}`
              : call.name === "computer_quit_application"
                ? `Terminar ${text(call.arguments.application)}`
                : `Clicar na posição ${call.arguments.x}, ${call.arguments.y} (${call.arguments.button === "right" ? "botão direito" : "botão esquerdo"})`;
        const question = `Autorizar na aplicação observada pela AIVA?\n${details}`;
        if (!(host.confirm ? host.confirm(question) : window.confirm(question))) return { callId: call.id, ok: false, output: { cancelled: true } };
        const consent = await readJson(await request("/api/aiva/desktop/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: call.name, arguments: call.arguments }) }));
        approval = String(consent.approval);
      }
      const response = await request("/api/aiva/tool", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: call.name, arguments: call.arguments, brain: host.brain, approval }) });
      return { callId: call.id, ok: true, output: await readJson(response) };
    }
    switch (call.name) {
      case "navigate_to_section": {
        const section = text(call.arguments.section) as AivaSection;
        host.navigate(section);
        return { callId: call.id, ok: true, output: { opened: section } };
      }
      case "open_client": {
        const query = text(call.arguments.query);
        host.openClient?.(query);
        host.navigate("clients");
        return { callId: call.id, ok: true, output: { opened: "client", query } };
      }
      case "open_document": {
        const query = text(call.arguments.query);
        host.openDocument?.(query);
        host.navigate("documents");
        return { callId: call.id, ok: true, output: { opened: "document", query } };
      }
      case "open_meeting": {
        const meetingId = text(call.arguments.meetingId);
        host.openMeeting?.(meetingId);
        host.navigate("calendar");
        return { callId: call.id, ok: true, output: { opened: "meeting", meetingId } };
      }
      case "set_hands_free": {
        const enabled = call.arguments.enabled === true;
        await host.setHandsFree?.(enabled);
        return { callId: call.id, ok: true, output: { handsFree: enabled } };
      }
      case "set_aiva_brain": {
        const brain = call.arguments.brain === "mark-ii" ? "mark-ii" : "mark-i";
        if (!host.setBrain) throw new Error("Troca de cérebro indisponível.");
        await host.setBrain(brain);
        return { callId: call.id, ok: true, output: { brain } };
      }
      case "consult_active_brain": {
        if (host.consultBrain) return { callId: call.id, ok: true, output: { answer: await host.consultBrain(text(call.arguments.query)) } };
        const response = await request("/api/aiva/respond", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text(call.arguments.query), brain: host.brain || "mark-i", toolsDisabled: true }) });
        const data = await readJson(response);
        return { callId: call.id, ok: true, output: { answer: data.text } };
      }
      case "list_clients": {
        const data = await readJson(await request("/api/clients"));
        const query = text(call.arguments.query).toLocaleLowerCase("pt");
        const clients = Array.isArray(data.clients) ? data.clients as Array<Record<string, unknown>> : [];
        return { callId: call.id, ok: true, output: { clients: clients.filter((client) => !query || text(client.name).toLocaleLowerCase("pt").includes(query)).slice(0, 20).map(({ id, name, status, accountManager }) => ({ id, name, status, accountManager })) } };
      }
      case "list_documents": {
        const data = await readJson(await request("/api/documents"));
        const query = text(call.arguments.query).toLocaleLowerCase("pt");
        const documents = Array.isArray(data.documents) ? data.documents as Array<Record<string, unknown>> : [];
        return { callId: call.id, ok: true, output: { documents: documents.filter((document) => !query || text(document.name).toLocaleLowerCase("pt").includes(query)).slice(0, 20).map(({ id, name, modifiedTime, webViewLink }) => ({ id, name, modifiedTime, webViewLink })) } };
      }
      case "list_tasks":
      case "list_calendar": {
        const data = await readJson(await request("/api/google/workspace/status"));
        const key = call.name === "list_tasks" ? "tasks" : "events";
        const date = text(call.arguments.date);
        const items = Array.isArray(data[key]) ? data[key] as Array<Record<string, unknown>> : [];
        const selected = items.filter((item) => !date || item.date === date).slice(0, 30).map((item) => key === "tasks"
          ? { id: item.id, title: item.title, date: item.dueDate || item.date, time: item.dueTime || item.time, completed: item.completed, priority: item.priority }
          : { id: item.id, title: item.title, date: item.date, time: item.time, endTime: item.endTime, status: item.status });
        return { callId: call.id, ok: true, output: { [key]: selected } };
      }
      case "create_task": {
        const response = await request("/api/google/workspace/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...call.arguments, dueDate: call.arguments.date, dueTime: call.arguments.time }) });
        const task = await readJson(response);
        window.dispatchEvent(new CustomEvent("axion:realtime", { detail: { table: "tasks" } }));
        return { callId: call.id, ok: true, output: { task } };
      }
      case "list_payments": {
        const data = await readJson(await request("/api/finance"));
        const payments = Array.isArray(data.payments) ? (data.payments as Array<Record<string, unknown>>).slice(0, 30).map(({ id, name, provider, amount, currency, nextChargeDate, status }) => ({ id, name, provider, amount, currency, nextChargeDate, status })) : [];
        const revenues = Array.isArray(data.revenues) ? (data.revenues as Array<Record<string, unknown>>).slice(0, 30).map(({ id, payerName, description, amount, actualAmount, currency, dueDate, receivedDate, status }) => ({ id, payerName, description, amount, actualAmount, currency, dueDate, receivedDate, status })) : [];
        return { callId: call.id, ok: true, output: { summary: data.summary, payments, revenues } };
      }
      case "mark_payment_paid": {
        if (!(host.confirm?.("Confirmar que este pagamento foi realizado?") ?? window.confirm("Confirmar que este pagamento foi realizado?"))) return { callId: call.id, ok: false, output: { cancelled: true } };
        const id = encodeURIComponent(text(call.arguments.paymentId));
        const finance = await readJson(await request("/api/finance"));
        const payment = (Array.isArray(finance.payments) ? finance.payments : []).find((item) => item && typeof item === "object" && String((item as Record<string, unknown>).id) === text(call.arguments.paymentId)) as Record<string, unknown> | undefined;
        if (!payment) throw new Error("Pagamento não encontrado.");
        const response = await request(`/api/finance/payments/${id}/mark-paid`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedDate: payment.nextChargeDate, actualAmount: call.arguments.actualAmount }) });
        return { callId: call.id, ok: true, output: await readJson(response) };
      }
      case "delete_client": {
        if (!(host.confirm?.("Confirmar a eliminação definitiva desta ficha de cliente?") ?? window.confirm("Confirmar a eliminação definitiva desta ficha de cliente?"))) return { callId: call.id, ok: false, output: { cancelled: true } };
        const id = encodeURIComponent(text(call.arguments.clientId));
        return { callId: call.id, ok: true, output: await readJson(await request(`/api/clients/${id}`, { method: "DELETE" })) };
      }
      default:
        return { callId: call.id, ok: false, output: { error: "Ferramenta não suportada." } };
    }
  } catch (error) {
    return { callId: call.id, ok: false, output: { error: error instanceof Error ? error.message : "A ação falhou." } };
  }
}
