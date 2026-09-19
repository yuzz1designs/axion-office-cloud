import type { BillingInterval, PricingType, Quote, QuoteAdjustment, QuoteItem, QuoteRequestStatus, QuoteStatus, QuoteTotals } from "../types/quotes";

const intervals: BillingInterval[] = ["monthly", "quarterly", "semiannual", "annual"];
const pricingTypes: PricingType[] = ["project", "recurring", "performance"];
const requestTransitions: Record<QuoteRequestStatus, QuoteRequestStatus[]> = {
  new: ["reviewing", "qualified", "discarded"], reviewing: ["new", "qualified", "discarded"],
  qualified: ["reviewing", "converted", "discarded"], converted: [], discarded: ["reviewing"],
};
const quoteTransitions: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ["ready", "cancelled"], ready: ["draft", "sent", "cancelled"], sent: ["accepted", "rejected", "expired", "cancelled"],
  accepted: [], rejected: ["draft"], expired: ["draft"], cancelled: ["draft"],
};

const text = (value: unknown) => String(value ?? "").trim();
const cents = (value: unknown) => { const amount = Number(value); return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0; };

export function validateStatusTransition(kind: "request" | "quote", from: QuoteRequestStatus | QuoteStatus, to: QuoteRequestStatus | QuoteStatus) {
  const allowed = kind === "request" ? requestTransitions[from as QuoteRequestStatus] : quoteTransitions[from as QuoteStatus];
  if (from !== to && !allowed?.includes(to as never)) throw new Error("Transição de estado inválida.");
  return to;
}

export function normalizeQuoteItem(raw: Partial<QuoteItem>, index = 0): QuoteItem {
  const pricingType = raw.pricingType as PricingType;
  if (!pricingTypes.includes(pricingType)) throw new Error("Tipo de preço inválido.");
  const name = text(raw.name);
  if (!name) throw new Error("Cada linha do orçamento precisa de um nome.");
  const billingInterval = pricingType === "recurring" ? raw.billingInterval as BillingInterval : null;
  if (pricingType === "recurring" && !intervals.includes(billingInterval as BillingInterval)) throw new Error("Seleciona a periodicidade da linha recorrente.");
  return {
    ...(raw.id ? { id: raw.id } : {}), category: text(raw.category), name, description: text(raw.description), pricingType,
    quantity: Math.max(0.01, Number(raw.quantity) || 1), unitAmountCents: cents(raw.unitAmountCents), billingInterval,
    performanceMetric: text(raw.performanceMetric), performanceRate: raw.performanceRate == null ? null : Number(raw.performanceRate),
    performanceBasis: text(raw.performanceBasis), attributionMethod: text(raw.attributionMethod), performanceConditions: text(raw.performanceConditions),
    estimatedHours: raw.estimatedHours == null ? null : Math.max(0, Number(raw.estimatedHours)),
    internalCostCents: raw.internalCostCents == null ? null : cents(raw.internalCostCents),
    externalCostCents: raw.externalCostCents == null ? null : cents(raw.externalCostCents), included: raw.included !== false,
    sortOrder: Number.isInteger(raw.sortOrder) ? Number(raw.sortOrder) : index,
  };
}

export function normalizeAdjustment(raw: Partial<QuoteAdjustment>, index = 0): QuoteAdjustment {
  if (!["percentage", "fixed", "first_cycle", "waive_item"].includes(String(raw.type))) throw new Error("Tipo de ajuste inválido.");
  return { ...(raw.id ? { id: raw.id } : {}), label: text(raw.label) || "Ajuste", type: raw.type!, target: raw.target || "initial", value: Math.max(0, Number(raw.value) || 0), metadata: raw.metadata || {}, sortOrder: Number.isInteger(raw.sortOrder) ? Number(raw.sortOrder) : index };
}

const lineTotal = (item: QuoteItem) => Math.round(item.quantity * item.unitAmountCents);
const recurringMonths: Record<BillingInterval, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

export function calculateQuoteTotals(items: QuoteItem[], adjustments: QuoteAdjustment[], commitmentMonths = 0): QuoteTotals {
  const active = items.filter((item) => item.included);
  const projectSubtotalCents = active.filter((item) => item.pricingType === "project").reduce((sum, item) => sum + lineTotal(item), 0);
  const recurringByInterval = Object.fromEntries(intervals.map((interval) => [interval, active.filter((item) => item.pricingType === "recurring" && item.billingInterval === interval).reduce((sum, item) => sum + lineTotal(item), 0)])) as Record<BillingInterval, number>;
  const mrrCents = Math.round(intervals.reduce((sum, interval) => sum + recurringByInterval[interval] / recurringMonths[interval], 0));
  const recurringFirstCycle = Object.values(recurringByInterval).reduce((sum, value) => sum + value, 0);
  const initialBase = projectSubtotalCents + recurringFirstCycle;
  const discountsCents = Math.min(initialBase, adjustments.reduce((sum, adjustment) => {
    if (adjustment.type === "percentage") return sum + Math.round(initialBase * Math.min(adjustment.value, 100) / 100);
    if (adjustment.type === "fixed" || adjustment.type === "first_cycle") return sum + Math.round(adjustment.value);
    return sum;
  }, 0));
  const initialTotalCents = Math.max(0, initialBase - discountsCents);
  const contractedRecurringCents = commitmentMonths > 0 ? mrrCents * commitmentMonths : mrrCents;
  const internalCostCents = active.reduce((sum, item) => sum + Math.round(item.quantity * ((item.internalCostCents || 0) + (item.externalCostCents || 0))), 0);
  const marginCents = initialTotalCents - internalCostCents;
  const totalHours = active.reduce((sum, item) => sum + (item.estimatedHours || 0) * item.quantity, 0);
  return { projectSubtotalCents, recurringByInterval, mrrCents, discountsCents, initialTotalCents, contractedRecurringCents, internalCostCents, marginCents, marginPercent: initialTotalCents ? marginCents / initialTotalCents * 100 : null, effectiveHourlyRateCents: totalHours ? Math.round(initialTotalCents / totalHours) : null, performanceItems: active.filter((item) => item.pricingType === "performance") };
}

export function validateQuoteInput(raw: Partial<Quote>) {
  const companyName = text(raw.companyName); const title = text(raw.title);
  if (!companyName || !title) throw new Error("Empresa e título são obrigatórios.");
  const items = (raw.items || []).map(normalizeQuoteItem);
  const adjustments = (raw.adjustments || []).map(normalizeAdjustment);
  return { ...raw, companyName, title, contactName: text(raw.contactName), contactEmail: text(raw.contactEmail).toLowerCase(), summary: text(raw.summary), currency: text(raw.currency || "EUR").toUpperCase(), paymentTerms: text(raw.paymentTerms), clientNotes: text(raw.clientNotes), internalNotes: text(raw.internalNotes), commitmentMonths: raw.commitmentMonths == null ? null : Math.max(0, Math.round(Number(raw.commitmentMonths))), items, adjustments };
}

export function formatQuoteReference(year: number, sequence: number) { return `AX-${year}-${String(sequence).padStart(4, "0")}`; }
export function isGmailQuoteMessageDuplicate(existingIds: string[], messageId: string) { return existingIds.includes(messageId); }
