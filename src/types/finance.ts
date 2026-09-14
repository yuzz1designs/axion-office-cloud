export const FINANCE_CATEGORIES = [
  "IA",
  "Hosting & Cloud",
  "Software",
  "Marketing",
  "Domínios",
  "Comunicação",
  "Design",
  "Produtividade",
  "Contabilidade",
  "Outros",
] as const;

export type FinanceCategory = typeof FINANCE_CATEGORIES[number];
export type BillingType = "monthly_fixed" | "annual" | "monthly_variable" | "one_time";
export type FinancePaymentStatus = "active" | "paused" | "completed" | "cancelled";
export type TransactionStatus = "planned" | "paid" | "overdue" | "cancelled";

export interface FinanceProject {
  id: string;
  name: string;
  clientName?: string;
}

export interface FinanceMember {
  userId: string;
  name: string;
  email: string;
}

export interface FinanceClient {
  id: string;
  name: string;
}

export interface FinancePayment {
  id: string;
  name: string;
  provider: string;
  category: FinanceCategory;
  amount: number;
  currency: string;
  billingType: BillingType;
  chargeDay?: number | null;
  chargeDate?: string | null;
  nextChargeDate: string;
  paymentMethod: string;
  status: FinancePaymentStatus;
  autoRenew: boolean;
  responsibleUserId?: string | null;
  responsibleName?: string;
  projectId?: string | null;
  projectName?: string;
  clientId?: string | null;
  clientName?: string;
  notes?: string;
  websiteUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTransaction {
  id: string;
  paymentId?: string | null;
  paymentName: string;
  expectedAmount: number;
  actualAmount?: number | null;
  currency: string;
  paidAt?: string | null;
  expectedDate: string;
  status: TransactionStatus;
  notes?: string;
  receiptFileId?: string | null;
  createdAt: string;
}

export interface FinanceSummary {
  monthlyRevenue: number;
  expectedThisMonth: number;
  paidThisMonth: number;
  outstandingThisMonth: number;
  monthlyRecurringCost: number;
  annualEquivalent: number;
  upcomingCount: number;
  overdueCount: number;
}

export interface RevenueEntry {
  id: string;
  payerName: string;
  description: string;
  amount: number;
  actualAmount?: number | null;
  currency: string;
  dueDate: string;
  receivedDate?: string | null;
  status: "received" | "pending" | "cancelled";
  projectId?: string | null;
  clientId?: string | null;
  projectName?: string;
  clientName?: string;
  notes?: string;
  createdAt: string;
}

export interface RevenueEntryInput {
  payerName: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: "received" | "pending" | "cancelled";
  projectId?: string | null;
  clientId?: string | null;
  notes?: string;
}

export interface FinancePayload {
  payments: FinancePayment[];
  transactions: PaymentTransaction[];
  projects: FinanceProject[];
  members: FinanceMember[];
  clients: FinanceClient[];
  revenues: RevenueEntry[];
  summary: FinanceSummary;
}

export interface FinancePaymentInput {
  name: string;
  provider: string;
  category: FinanceCategory;
  amount: number;
  currency: string;
  billingType: BillingType;
  chargeDay?: number | null;
  chargeDate?: string | null;
  nextChargeDate: string;
  paymentMethod: string;
  status: FinancePaymentStatus;
  autoRenew: boolean;
  responsibleUserId?: string | null;
  projectId?: string | null;
  notes?: string;
  websiteUrl?: string;
}
