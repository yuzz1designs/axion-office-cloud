import {
  FINANCE_CATEGORIES,
  type BillingType,
  type FinancePayment,
  type FinancePaymentInput,
  type FinanceSummary,
  type PaymentTransaction,
  type RevenueEntry,
  type RevenueEntryInput,
} from "../types/finance";

const BILLING_TYPES: BillingType[] = ["monthly_fixed", "annual", "monthly_variable", "one_time"];
const PAYMENT_STATUSES = ["active", "paused", "completed", "cancelled"] as const;

interface RevenueEntryLike {
  amount: number;
  actualAmount?: number | null;
  receivedDate?: string | null;
  status: "received" | "pending" | "cancelled";
}

export function calculateMonthlyRevenue(entries: RevenueEntryLike[], date: string): number {
  const month = date.slice(0, 7);
  return entries
    .filter((entry) => entry.status === "received" && entry.receivedDate?.startsWith(month))
    .reduce((total, entry) => total + Number(entry.actualAmount ?? entry.amount), 0);
}

function dateParts(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("Data de cobrança inválida.");
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function isoDate(year: number, month: number, day: number) {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export function advancePaymentDate(date: string, billingType: BillingType): string | null {
  if (billingType === "one_time") return null;
  const { year, month, day } = dateParts(date);
  if (billingType === "annual") return isoDate(year + 1, month, day);
  const nextMonth = month === 12 ? 1 : month + 1;
  return isoDate(month === 12 ? year + 1 : year, nextMonth, day);
}

export function calculateFinanceSummary(
  payments: FinancePayment[],
  transactions: PaymentTransaction[],
  referenceDate = new Date().toISOString().slice(0, 10),
): FinanceSummary {
  const month = referenceDate.slice(0, 7);
  const active = payments.filter((payment) => payment.status === "active");
  const dueThisMonth = active.filter((payment) => payment.nextChargeDate.startsWith(month));
  const dueKeys = new Set(dueThisMonth.map((payment) => `${payment.id}:${payment.nextChargeDate}`));
  const historicalExpected = transactions.filter((transaction) =>
    transaction.expectedDate.startsWith(month)
    && !dueKeys.has(`${transaction.paymentId}:${transaction.expectedDate}`));
  const paidKeys = new Set(transactions
    .filter((transaction) => transaction.status === "paid")
    .map((transaction) => `${transaction.paymentId}:${transaction.expectedDate}`));
  const unpaid = dueThisMonth.filter((payment) => !paidKeys.has(`${payment.id}:${payment.nextChargeDate}`));
  const activeUnpaid = active.filter((payment) => !paidKeys.has(`${payment.id}:${payment.nextChargeDate}`));
  const monthlyRecurringCost = active.reduce((total, payment) => {
    if (payment.billingType === "annual") return total + payment.amount / 12;
    if (payment.billingType === "one_time") return total;
    return total + payment.amount;
  }, 0);

  return {
    monthlyRevenue: 0,
    expectedThisMonth: dueThisMonth.reduce((total, payment) => total + payment.amount, 0)
      + historicalExpected.reduce((total, transaction) => total + transaction.expectedAmount, 0),
    paidThisMonth: transactions
      .filter((transaction) => transaction.status === "paid" && transaction.paidAt?.startsWith(month))
      .reduce((total, transaction) => total + Number(transaction.actualAmount || 0), 0),
    outstandingThisMonth: unpaid.reduce((total, payment) => total + payment.amount, 0),
    monthlyRecurringCost,
    annualEquivalent: monthlyRecurringCost * 12,
    upcomingCount: activeUnpaid.filter((payment) => payment.nextChargeDate >= referenceDate).length,
    overdueCount: activeUnpaid.filter((payment) => payment.nextChargeDate < referenceDate).length,
  };
}

export function validateFinancePaymentInput(input: Partial<FinancePaymentInput>): FinancePaymentInput {
  const name = String(input.name || "").trim();
  const provider = String(input.provider || "").trim();
  if (!name || !provider) throw new Error("Nome e fornecedor são obrigatórios.");
  if (!FINANCE_CATEGORIES.includes(input.category as never)) throw new Error("Categoria inválida.");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("O valor deve ser igual ou superior a zero.");
  if (!BILLING_TYPES.includes(input.billingType as BillingType)) throw new Error("Tipo de cobrança inválido.");
  if (!PAYMENT_STATUSES.includes(input.status as typeof PAYMENT_STATUSES[number])) throw new Error("Estado inválido.");
  const nextChargeDate = String(input.nextChargeDate || "");
  dateParts(nextChargeDate);
  const chargeDay = input.chargeDay == null ? null : Number(input.chargeDay);
  if (chargeDay !== null && (!Number.isInteger(chargeDay) || chargeDay < 1 || chargeDay > 31)) {
    throw new Error("O dia de cobrança deve estar entre 1 e 31.");
  }

  return {
    name,
    provider,
    category: input.category!,
    amount,
    currency: String(input.currency || "EUR").trim().toUpperCase().slice(0, 3),
    billingType: input.billingType!,
    chargeDay,
    chargeDate: input.chargeDate || null,
    nextChargeDate,
    paymentMethod: String(input.paymentMethod || "").trim(),
    status: input.status!,
    autoRenew: input.billingType === "one_time" ? false : Boolean(input.autoRenew),
    responsibleUserId: input.responsibleUserId || null,
    projectId: input.projectId || null,
    notes: String(input.notes || "").trim(),
    websiteUrl: String(input.websiteUrl || "").trim(),
  };
}

export function validateRevenueInput(input: Partial<RevenueEntryInput>): RevenueEntryInput {
  const payerName = String(input.payerName || "").trim();
  const description = String(input.description || "").trim();
  if (!payerName || !description) throw new Error("Cliente/pagador e descrição são obrigatórios.");
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("O valor deve ser igual ou superior a zero.");
  const dueDate = String(input.dueDate || "");
  dateParts(dueDate);
  const status = input.status || "pending";
  if (!["pending", "received", "cancelled"].includes(status)) throw new Error("Estado do vencimento inválido.");
  return {
    payerName,
    description,
    amount,
    currency: String(input.currency || "EUR").trim().toUpperCase().slice(0, 3),
    dueDate,
    status,
    projectId: input.projectId || null,
    clientId: input.clientId || null,
    notes: String(input.notes || "").trim(),
  };
}

export function prepareRevenueSettlement(entry: RevenueEntry, actualAmount: number, receivedAt = new Date().toISOString()) {
  const amount = Number(actualAmount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("O valor recebido deve ser igual ou superior a zero.");
  return { status: "received" as const, actualAmount: amount, receivedDate: receivedAt.slice(0, 10) };
}

export function preparePaymentSettlement(
  payment: FinancePayment,
  actualAmount: number,
  paidAt = new Date().toISOString(),
  notes = "",
) {
  const amount = Number(actualAmount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("O valor real deve ser igual ou superior a zero.");
  const nextChargeDate = advancePaymentDate(payment.nextChargeDate, payment.billingType);
  return {
    transaction: {
      paymentId: payment.id,
      paymentName: payment.name,
      expectedAmount: payment.amount,
      actualAmount: amount,
      currency: payment.currency,
      paidAt,
      expectedDate: payment.nextChargeDate,
      status: "paid" as const,
      notes: notes.trim(),
    },
    paymentUpdate: nextChargeDate
      ? { nextChargeDate, status: "active" as const }
      : { status: "completed" as const },
  };
}
