import assert from "node:assert/strict";
import test from "node:test";
import type { FinancePayment, PaymentTransaction } from "../types/finance";
import { advancePaymentDate, calculateFinanceSummary, validateFinancePaymentInput, validateRevenueInput, prepareRevenueSettlement } from "./financeCore";
import * as financeCore from "./financeCore";

const payment = (overrides: Partial<FinancePayment>): FinancePayment => ({
  id: "payment-1",
  name: "Software AXION",
  provider: "Fornecedor",
  category: "Software",
  amount: 100,
  currency: "EUR",
  billingType: "monthly_fixed",
  chargeDay: 10,
  nextChargeDate: "2026-09-10",
  paymentMethod: "Cartão",
  status: "active",
  autoRenew: true,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  ...overrides,
});

test("avança cobranças mensais e anuais sem produzir datas inválidas", () => {
  assert.equal(advancePaymentDate("2026-01-31", "monthly_fixed"), "2026-02-28");
  assert.equal(advancePaymentDate("2024-02-29", "annual"), "2025-02-28");
  assert.equal(advancePaymentDate("2026-09-04", "one_time"), null);
});

test("calcula previsto, pago, pendente, recorrência e atrasos para o mês", () => {
  const payments = [
    payment({ id: "monthly", amount: 100, nextChargeDate: "2026-09-10" }),
    payment({ id: "annual", amount: 1200, billingType: "annual", nextChargeDate: "2026-09-15" }),
    payment({ id: "variable", amount: 80, billingType: "monthly_variable", nextChargeDate: "2026-10-01" }),
    payment({ id: "once", amount: 50, billingType: "one_time", nextChargeDate: "2026-09-20" }),
    payment({ id: "late", amount: 20, billingType: "one_time", nextChargeDate: "2026-08-31" }),
  ];
  const transactions: PaymentTransaction[] = [{
    id: "transaction-1",
    paymentId: "variable",
    paymentName: "Variável",
    expectedAmount: 80,
    actualAmount: 95,
    currency: "EUR",
    paidAt: "2026-09-02T10:00:00Z",
    expectedDate: "2026-09-01",
    status: "paid",
    createdAt: "2026-09-02T10:00:00Z",
  }];

  assert.deepEqual(calculateFinanceSummary(payments, transactions, "2026-09-04"), {
    monthlyRevenue: 0,
    expectedThisMonth: 1430,
    paidThisMonth: 95,
    outstandingThisMonth: 1350,
    monthlyRecurringCost: 280,
    annualEquivalent: 3360,
    upcomingCount: 4,
    overdueCount: 1,
  });
});

test("valida os campos essenciais de um pagamento", () => {
  assert.throws(() => validateFinancePaymentInput({ name: "", amount: -1 }), /Nome e fornecedor/);
  assert.equal(validateFinancePaymentInput({
    name: "Supabase",
    provider: "Supabase",
    category: "Hosting & Cloud",
    amount: 25,
    currency: "eur",
    billingType: "monthly_variable",
    nextChargeDate: "2026-09-18",
    paymentMethod: "Cartão",
    status: "active",
    autoRenew: true,
  }).currency, "EUR");
});

test("liquida com valor real e avança a próxima cobrança", () => {
  const settle = (financeCore as typeof financeCore & {
    preparePaymentSettlement: (payment: FinancePayment, amount: number, paidAt: string, notes?: string) => any;
  }).preparePaymentSettlement;
  assert.equal(typeof settle, "function");

  const result = settle(payment({ billingType: "monthly_variable", nextChargeDate: "2026-09-30" }), 137.42, "2026-09-04T12:00:00Z", "Valor confirmado");
  assert.equal(result.transaction.actualAmount, 137.42);
  assert.equal(result.transaction.expectedDate, "2026-09-30");
  assert.equal(result.paymentUpdate.nextChargeDate, "2026-10-30");
  assert.equal(result.paymentUpdate.status, "active");

  const once = settle(payment({ billingType: "one_time" }), 100, "2026-09-04T12:00:00Z");
  assert.equal(once.paymentUpdate.status, "completed");
  assert.equal(once.paymentUpdate.nextChargeDate, undefined);
});

test("valida um vencimento e confirma o valor real como revenue", () => {
  const input = validateRevenueInput({
    payerName: "Cliente AXION", description: "Website", amount: 1200,
    currency: "eur", dueDate: "2026-09-15", projectId: "project-1", clientId: "client-1", notes: "Fatura 12",
  });
  assert.equal(input.currency, "EUR");
  assert.equal(input.status, "pending");
  assert.equal(input.clientId, "client-1");
  assert.throws(() => validateRevenueInput({ payerName: "", description: "", amount: -1 }), /Cliente.*descrição/);

  const settled = prepareRevenueSettlement({ ...input, id: "revenue-1", receivedDate: null, actualAmount: null, createdAt: "2026-09-01T00:00:00Z" }, 1250, "2026-09-04T12:00:00Z");
  assert.equal(settled.status, "received");
  assert.equal(settled.actualAmount, 1250);
  assert.equal(settled.receivedDate, "2026-09-04");
});

test("revenue mensal usa o valor efetivamente recebido", () => {
  assert.equal(financeCore.calculateMonthlyRevenue([
    { amount: 1200, actualAmount: 1250, receivedDate: "2026-09-04", status: "received" },
  ], "2026-09-10"), 1250);
});
