/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PaymentStatus = "pending" | "scheduled" | "paid" | "overdue";
export type SaaSCategory = "AI Tools" | "E-commerce" | "Design & Creative" | "Infra & Cloud" | "Productivity & Ops";
export type PaymentStreamType = "all" | "saas" | "clients";

export interface SaaSSubscription {
  id: string;
  serviceName: string;
  provider: string;
  category: SaaSCategory;
  iconName: string;
  amount: number;
  currency: "EUR" | "USD";
  dueDate: string; // YYYY-MM-DD
  billingCycle: "monthly" | "yearly" | "quarterly";
  paymentMethod: string;
  status: PaymentStatus;
  executiveRole: string;
  assignedUser: {
    name: string;
    role: string;
    avatar?: string;
  };
  paidDate?: string;
  autoRenew: boolean;
  notes?: string;
  websiteUrl?: string;
}

export interface ClientPayment {
  id: string;
  invoiceNumber: string;
  clientName: string;
  projectName: string;
  description: string;
  amount: number;
  taxRate: number; // e.g. 0.23
  totalAmount: number;
  currency: "EUR";
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  status: PaymentStatus;
  paymentMethod: string;
  milestone: string;
  contactPerson: {
    name: string;
    email: string;
    phone?: string;
  };
  hasReceipt: boolean;
  receiptNumber?: string;
  notes?: string;
}

export interface TreasurySummary {
  totalPendingSaaS: number;
  totalPendingClients: number;
  totalPaidThisMonth: number;
  projectedNetBalance: number;
  upcomingCount7Days: number;
  overdueCount: number;
}
