import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FinanceMember,
  FinanceClient,
  FinancePayment,
  FinancePaymentInput,
  FinancePayload,
  FinanceProject,
  PaymentTransaction,
  RevenueEntry,
  RevenueEntryInput,
} from "../types/finance";
import { calculateFinanceSummary, calculateMonthlyRevenue, prepareRevenueSettlement, validateFinancePaymentInput, validateRevenueInput } from "./financeCore";

type Row = Record<string, any>;

function paymentFromRow(row: Row, members = new Map<string, string>(), projects = new Map<string, string>()): FinancePayment {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency,
    billingType: row.billing_type,
    chargeDay: row.charge_day,
    chargeDate: row.charge_date,
    nextChargeDate: row.next_charge_date,
    paymentMethod: row.payment_method || "",
    status: row.status,
    autoRenew: Boolean(row.auto_renew),
    responsibleUserId: row.responsible_user_id,
    responsibleName: members.get(row.responsible_user_id) || "",
    projectId: row.project_id,
    projectName: projects.get(row.project_id) || "",
    notes: row.notes || "",
    websiteUrl: row.website_url || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transactionFromRow(row: Row): PaymentTransaction {
  return {
    id: row.id,
    paymentId: row.payment_id,
    paymentName: row.payment_name,
    expectedAmount: Number(row.expected_amount),
    actualAmount: row.actual_amount == null ? null : Number(row.actual_amount),
    currency: row.currency,
    paidAt: row.paid_at,
    expectedDate: row.expected_date,
    status: row.status,
    notes: row.notes || "",
    receiptFileId: row.receipt_file_id,
    createdAt: row.created_at,
  };
}

function paymentRow(input: FinancePaymentInput) {
  return {
    name: input.name,
    provider: input.provider,
    category: input.category,
    amount: input.amount,
    currency: input.currency,
    billing_type: input.billingType,
    charge_day: input.chargeDay || null,
    charge_date: input.chargeDate || null,
    next_charge_date: input.nextChargeDate,
    payment_method: input.paymentMethod,
    status: input.status,
    auto_renew: input.autoRenew,
    responsible_user_id: input.responsibleUserId || null,
    project_id: input.projectId || null,
    notes: input.notes || "",
    website_url: input.websiteUrl || "",
    updated_at: new Date().toISOString(),
  };
}

export class SupabaseFinanceStore {
  constructor(private readonly client: SupabaseClient) {}

  private async workspaceId(userId: string) {
    const { data, error } = await this.client.from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    if (error || !data) throw new Error("FINANCE_WORKSPACE_NOT_FOUND");
    return data.workspace_id as string;
  }

  private async validateClient(workspaceId: string, clientId?: string | null) {
    if (!clientId) return;
    const { data, error } = await this.client.from("clients").select("id").eq("workspace_id", workspaceId).eq("id", clientId).maybeSingle();
    if (error || !data) throw new Error("FINANCE_INVALID_CLIENT");
  }

  async load(userId: string, referenceDate?: string): Promise<FinancePayload> {
    const workspaceId = await this.workspaceId(userId);
    const [paymentResult, transactionResult, projectResult, memberResult, clientResult, revenueResult] = await Promise.all([
      this.client.from("payment_schedules").select("*").eq("workspace_id", workspaceId).order("next_charge_date"),
      this.client.from("payment_transactions").select("*").eq("workspace_id", workspaceId).order("expected_date", { ascending: false }),
      this.client.from("projects").select("id,name,client_id").eq("workspace_id", workspaceId).order("name"),
      this.client.from("profiles").select("user_id,display_name,preferred_name,email").eq("workspace_id", workspaceId).order("display_name"),
      this.client.from("clients").select("id,company").eq("workspace_id", workspaceId).order("company"),
      this.client.from("revenue_entries").select("*").eq("workspace_id", workspaceId).order("due_date", { ascending: true }),
    ]);
    const failure = [paymentResult.error, transactionResult.error, projectResult.error, memberResult.error, clientResult.error, revenueResult.error].find(Boolean);
    if (failure) throw new Error(`FINANCE_READ_FAILED:${failure.message}`);

    const members: FinanceMember[] = (memberResult.data || []).map((row: Row) => ({
      userId: row.user_id,
      name: row.preferred_name || row.display_name || row.email,
      email: row.email,
    }));
    const projects: FinanceProject[] = (projectResult.data || []).map((row: Row) => ({ id: row.id, name: row.name }));
    const clients: FinanceClient[] = (clientResult.data || []).map((row: Row) => ({ id: row.id, name: row.company }));
    const memberNames = new Map(members.map((member) => [member.userId, member.name]));
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const clientNames = new Map(clients.map((client) => [client.id, client.name]));
    const payments = (paymentResult.data || []).map((row: Row) => paymentFromRow(row, memberNames, projectNames));
    const transactions = (transactionResult.data || []).map(transactionFromRow);
    const revenues: RevenueEntry[] = (revenueResult.data || []).map((row: Row) => ({
      id: row.id,
      payerName: row.payer_name || "",
      description: row.description,
      amount: Number(row.amount),
      actualAmount: row.received_amount == null ? null : Number(row.received_amount),
      currency: row.currency,
      dueDate: row.due_date,
      receivedDate: row.received_date,
      status: row.status,
      projectId: row.project_id,
      projectName: projectNames.get(row.project_id) || "",
      clientId: row.client_id,
      clientName: clientNames.get(row.client_id) || "",
      notes: row.notes || "",
      createdAt: row.created_at,
    }));
    const summary = calculateFinanceSummary(payments, transactions, referenceDate);
    summary.monthlyRevenue = calculateMonthlyRevenue(revenues, referenceDate || new Date().toISOString().slice(0, 10));

    return { payments, transactions, projects, members, clients, revenues, summary };
  }

  async createRevenue(userId: string, rawInput: Partial<RevenueEntryInput>) {
    const workspaceId = await this.workspaceId(userId);
    const input = validateRevenueInput(rawInput);
    await this.validateClient(workspaceId, input.clientId);
    const { error } = await this.client.from("revenue_entries").insert({
      workspace_id: workspaceId, created_by: userId, source: "vencimento",
      payer_name: input.payerName, description: input.description, amount: input.amount,
      currency: input.currency, due_date: input.dueDate, status: input.status,
      project_id: input.projectId || null, notes: input.notes || "", received_date: null,
      client_id: input.clientId || null,
    });
    if (error) throw new Error(`FINANCE_REVENUE_CREATE_FAILED:${error.message}`);
    return this.load(userId);
  }

  async updateRevenue(userId: string, revenueId: string, patch: Partial<RevenueEntryInput>) {
    const workspaceId = await this.workspaceId(userId);
    const { data, error } = await this.client.from("revenue_entries").select("*").eq("id", revenueId).eq("workspace_id", workspaceId).single();
    if (error || !data) throw new Error("FINANCE_REVENUE_NOT_FOUND");
    const input = validateRevenueInput({ payerName: data.payer_name, description: data.description, amount: Number(data.amount), currency: data.currency, dueDate: data.due_date, status: data.status, projectId: data.project_id, clientId: data.client_id, notes: data.notes, ...patch });
    await this.validateClient(workspaceId, input.clientId);
    const { error: updateError } = await this.client.from("revenue_entries").update({ payer_name: input.payerName, description: input.description, amount: input.amount, currency: input.currency, due_date: input.dueDate, status: input.status, project_id: input.projectId || null, client_id: input.clientId || null, notes: input.notes || "", updated_at: new Date().toISOString() }).eq("id", revenueId).eq("workspace_id", workspaceId);
    if (updateError) throw new Error(`FINANCE_REVENUE_UPDATE_FAILED:${updateError.message}`);
    return this.load(userId);
  }

  async removeRevenue(userId: string, revenueId: string) {
    const workspaceId = await this.workspaceId(userId);
    const { error } = await this.client.from("revenue_entries").delete().eq("id", revenueId).eq("workspace_id", workspaceId);
    if (error) throw new Error(`FINANCE_REVENUE_DELETE_FAILED:${error.message}`);
    return this.load(userId);
  }

  async markRevenueReceived(userId: string, revenueId: string, actualAmount: number, receivedAt?: string) {
    const workspaceId = await this.workspaceId(userId);
    const { data, error } = await this.client.from("revenue_entries").select("*").eq("id", revenueId).eq("workspace_id", workspaceId).single();
    if (error || !data) throw new Error("FINANCE_REVENUE_NOT_FOUND");
    if (data.status === "received") throw new Error("FINANCE_REVENUE_ALREADY_RECEIVED");
    const entry: RevenueEntry = { id: data.id, payerName: data.payer_name, description: data.description, amount: Number(data.amount), actualAmount: data.received_amount, currency: data.currency, dueDate: data.due_date, receivedDate: data.received_date, status: data.status, projectId: data.project_id, clientId: data.client_id, notes: data.notes, createdAt: data.created_at };
    const settlement = prepareRevenueSettlement(entry, actualAmount, receivedAt);
    const { error: updateError } = await this.client.from("revenue_entries").update({ status: settlement.status, received_amount: settlement.actualAmount, received_date: settlement.receivedDate, updated_at: new Date().toISOString() }).eq("id", revenueId).eq("workspace_id", workspaceId).neq("status", "received");
    if (updateError) throw new Error(`FINANCE_REVENUE_SETTLEMENT_FAILED:${updateError.message}`);
    return this.load(userId);
  }

  async create(userId: string, rawInput: Partial<FinancePaymentInput>) {
    const workspaceId = await this.workspaceId(userId);
    const input = validateFinancePaymentInput(rawInput);
    const { error } = await this.client.from("payment_schedules").insert({
      ...paymentRow(input),
      workspace_id: workspaceId,
      created_by: userId,
    });
    if (error) throw new Error(`FINANCE_CREATE_FAILED:${error.message}`);
    return this.load(userId);
  }

  async update(userId: string, paymentId: string, patch: Partial<FinancePaymentInput>) {
    const workspaceId = await this.workspaceId(userId);
    const { data, error } = await this.client.from("payment_schedules")
      .select("*")
      .eq("id", paymentId)
      .eq("workspace_id", workspaceId)
      .single();
    if (error || !data) throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    const current = paymentFromRow(data);
    const input = validateFinancePaymentInput({ ...current, ...patch });
    const { error: updateError } = await this.client.from("payment_schedules")
      .update(paymentRow(input))
      .eq("id", paymentId)
      .eq("workspace_id", workspaceId);
    if (updateError) throw new Error(`FINANCE_UPDATE_FAILED:${updateError.message}`);
    return this.load(userId);
  }

  async remove(userId: string, paymentId: string) {
    const workspaceId = await this.workspaceId(userId);
    const { error } = await this.client.from("payment_schedules")
      .delete()
      .eq("id", paymentId)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(`FINANCE_DELETE_FAILED:${error.message}`);
    return this.load(userId);
  }

  async markPaid(userId: string, paymentId: string, expectedDate: string, actualAmount?: number, notes = "") {
    const workspaceId = await this.workspaceId(userId);
    const { data, error } = await this.client.from("payment_schedules")
      .select("amount")
      .eq("id", paymentId)
      .eq("workspace_id", workspaceId)
      .single();
    if (error || !data) throw new Error("FINANCE_PAYMENT_NOT_FOUND");
    const amount = actualAmount == null ? Number(data.amount) : Number(actualAmount);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("FINANCE_INVALID_AMOUNT");
    const { error: settlementError } = await this.client.rpc("mark_payment_paid", {
      target_payment_id: paymentId,
      target_expected_date: expectedDate,
      actor_user_id: userId,
      paid_amount: amount,
      payment_date: new Date().toISOString(),
      payment_notes: notes.trim(),
    });
    if (settlementError) throw new Error(`FINANCE_SETTLEMENT_FAILED:${settlementError.message}`);
    return this.load(userId);
  }
}
