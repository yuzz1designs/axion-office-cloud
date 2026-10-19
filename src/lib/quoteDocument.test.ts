import assert from "node:assert/strict";
import test from "node:test";
import { normalizeQuoteItem, calculateQuoteTotals } from "../server/quoteCore";
import { quoteDocumentModel, type QuoteDocumentDraft } from "./quoteDocument";

const draft: QuoteDocumentDraft = {
  companyName: "São João & Filhos", title: "Website", reference: "AX-2026-0042", internalNotes: "CONFIDENTIAL_INTERNAL_NOTES",
  items: [
    normalizeQuoteItem({ name: "Website", pricingType: "project", quantity: 2, unitAmountCents: 100000, internalCostCents: 60000, estimatedHours: 30 }),
    normalizeQuoteItem({ name: "SEO", pricingType: "recurring", billingInterval: "quarterly", quantity: 1, unitAmountCents: 90000 }),
    normalizeQuoteItem({ name: "Performance", pricingType: "performance", unitAmountCents: 999999, performanceRate: 5, performanceBasis: "Receita" }),
    normalizeQuoteItem({ name: "Excluded", pricingType: "project", unitAmountCents: 999999, included: false }),
  ], adjustments: [{ label: "Desconto", type: "percentage", target: "all", value: 10, sortOrder: 0 }],
};

test("PDF uses the same totals as the Office, without adding tax or counting performance", () => {
  const model = quoteDocumentModel(draft, "2026-10-19");
  const totals = calculateQuoteTotals(draft.items, draft.adjustments);
  assert.equal(model.initialNetCents, totals.initialTotalCents);
  assert.equal(model.monthlyNetCents, totals.mrrCents);
  assert.equal(model.firstCycleCents, 90000);
  assert.equal(model.discountsCents, 29000);
  assert.equal(model.firstYearCents, 531000);
  assert.equal(model.projectItems.length, 1);
  assert.equal(model.recurringItems[0].interval, "quarterly");
  assert.equal(model.performanceItems[0].performance, "Taxa: 5\nBase: Receita");
  assert.equal("vatRate" in model, false);
});

test("document model contains no internal notes, costs, margins or hours", () => {
  const json = JSON.stringify(quoteDocumentModel(draft, "2026-10-19"));
  for (const forbidden of ["CONFIDENTIAL_INTERNAL_NOTES", "internalCost", "externalCost", "estimatedHours", "margin", "Excluded"]) assert.equal(json.includes(forbidden), false);
});

test("regenerating reflects unsaved changes and preserves Unicode client data", () => {
  const first = quoteDocumentModel(draft, "2026-10-19");
  const next = quoteDocumentModel({ ...draft, companyName: "Clínica Coração", items: draft.items.map((item) => item.name === "Website" ? { ...item, unitAmountCents: 150000 } : item) }, "2026-10-20");
  assert.equal(next.company, "Clínica Coração");
  assert.equal(next.projectCents - first.projectCents, 100000);
  assert.equal(next.issuedOn, "2026-10-20");
});

test("empty drafts have safe labels and zero totals", () => {
  const model = quoteDocumentModel({ items: [], adjustments: [] }, "2026-10-19");
  assert.equal(model.reference, "RASCUNHO");
  assert.equal(model.initialNetCents, 0);
  assert.equal(model.monthlyNetCents, 0);
  assert.equal(model.firstYearCents, 0);
});
