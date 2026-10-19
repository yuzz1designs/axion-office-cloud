import type { BillingInterval, Quote, QuoteAdjustment, QuoteItem } from "../types/quotes";
import { calculateQuoteTotals } from "../server/quoteCore";

export type QuoteDocumentDraft = Partial<Quote> & { items: QuoteItem[]; adjustments: QuoteAdjustment[] };
export const BILLING_LABELS: Record<BillingInterval, string> = { monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual" };
const months: Record<BillingInterval, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };

// Explicitly select client-facing fields: never pass internal notes, costs or margins to the PDF renderer.
export function quoteDocumentModel(draft: QuoteDocumentDraft, issuedOn: string) {
  const totals = calculateQuoteTotals(draft.items, draft.adjustments, draft.commitmentMonths || 0);
  const items = draft.items.filter((item) => item.included).sort((a, b) => a.sortOrder - b.sortOrder).map((item) => ({
    name: item.name || "Serviço", description: item.description, category: item.category,
    pricingType: item.pricingType, quantity: item.quantity,
    amountCents: Math.round(item.quantity * item.unitAmountCents),
    interval: item.billingInterval || "monthly" as BillingInterval,
    monthlyCents: Math.round(item.quantity * item.unitAmountCents / months[item.billingInterval || "monthly"]),
    performance: [item.performanceMetric, item.performanceRate != null ? `Taxa: ${item.performanceRate}` : "", item.performanceBasis ? `Base: ${item.performanceBasis}` : "", item.attributionMethod ? `Atribuição: ${item.attributionMethod}` : "", item.performanceConditions].filter(Boolean).join("\n"),
  }));
  return {
    reference: draft.reference || "RASCUNHO", title: draft.title || "Proposta comercial", company: draft.companyName || "Cliente por indicar",
    contact: [draft.contactName, draft.contactEmail].filter(Boolean).join(" · "),
    summary: draft.summary || "", paymentTerms: draft.paymentTerms || "Condições de pagamento por definir.", notes: draft.clientNotes || "",
    issuedOn, validUntil: draft.validUntil || "", commitmentMonths: draft.commitmentMonths || 0, currency: draft.currency || "EUR",
    projectItems: items.filter((item) => item.pricingType === "project"), recurringItems: items.filter((item) => item.pricingType === "recurring"), performanceItems: items.filter((item) => item.pricingType === "performance"),
    projectCents: totals.projectSubtotalCents, firstCycleCents: Object.values(totals.recurringByInterval).reduce((a, b) => a + b, 0),
    discountsCents: totals.discountsCents, discountLabels: draft.adjustments.filter((item) => item.value > 0).map((item) => item.label).join("; "),
    initialNetCents: totals.initialTotalCents,
    monthlyNetCents: totals.mrrCents,
    firstYearCents: Math.max(0, totals.projectSubtotalCents + 12 * totals.mrrCents - totals.discountsCents),
  };
}
export type QuoteDocumentModel = ReturnType<typeof quoteDocumentModel>;
