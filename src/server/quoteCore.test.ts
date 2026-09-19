import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuoteTotals, formatQuoteReference, isGmailQuoteMessageDuplicate, normalizeQuoteItem, validateQuoteInput, validateStatusTransition } from "./quoteCore";

test("calcula projeto, recorrência, descontos, margem e taxa horária em cêntimos", () => {
  const totals = calculateQuoteTotals([
    normalizeQuoteItem({ name: "Website", pricingType: "project", quantity: 1, unitAmountCents: 200000, internalCostCents: 60000, estimatedHours: 40 }),
    normalizeQuoteItem({ name: "SEO", pricingType: "recurring", billingInterval: "quarterly", quantity: 1, unitAmountCents: 90000, internalCostCents: 15000, estimatedHours: 5 }),
  ], [{ label: "Desconto", type: "percentage", target: "all", value: 10, sortOrder: 0 }], 12);
  assert.equal(totals.projectSubtotalCents, 200000);
  assert.equal(totals.mrrCents, 30000);
  assert.equal(totals.initialTotalCents, 261000);
  assert.equal(totals.internalCostCents, 75000);
  assert.equal(totals.marginCents, 186000);
  assert.equal(totals.effectiveHourlyRateCents, 5800);
});

test("mantém performance separada da receita garantida", () => {
  const item = normalizeQuoteItem({ name: "Performance", pricingType: "performance", quantity: 1, unitAmountCents: 999999, performanceMetric: "Leads" });
  const totals = calculateQuoteTotals([item], []);
  assert.equal(totals.initialTotalCents, 0);
  assert.equal(totals.performanceItems.length, 1);
});

test("valida inputs, transições, referências e deduplicação Gmail", () => {
  assert.throws(() => validateQuoteInput({ companyName: "", title: "" }), /obrigatórios/);
  assert.equal(validateStatusTransition("quote", "draft", "ready"), "ready");
  assert.throws(() => validateStatusTransition("quote", "accepted", "draft"), /inválida/);
  assert.equal(formatQuoteReference(2026, 12), "AX-2026-0012");
  assert.equal(isGmailQuoteMessageDuplicate(["m1"], "m1"), true);
});
