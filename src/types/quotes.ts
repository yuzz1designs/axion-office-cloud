export type QuoteRequestStatus = "new" | "reviewing" | "qualified" | "converted" | "discarded";
export type QuoteStatus = "draft" | "ready" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";
export type PricingType = "project" | "recurring" | "performance";
export type BillingInterval = "monthly" | "quarterly" | "semiannual" | "annual";

export interface QuoteRequest {
  id: string; clientId?: string | null; source: string; status: QuoteRequestStatus;
  companyName: string; contactName: string; contactEmail: string; contactPhone: string;
  subject: string; requestSummary: string; serviceInterests: string[]; budgetText: string;
  deadlineText: string; notes: string; ownerUserId?: string | null; gmailMessageId?: string | null;
  gmailThreadId?: string | null; gmailReceivedAt?: string | null; classificationConfidence?: number | null;
  createdAt: string; updatedAt: string;
}

export interface QuoteItem {
  id?: string; category: string; name: string; description: string; pricingType: PricingType;
  quantity: number; unitAmountCents: number; billingInterval?: BillingInterval | null;
  performanceMetric?: string; performanceRate?: number | null; performanceBasis?: string;
  attributionMethod?: string; performanceConditions?: string; estimatedHours?: number | null;
  internalCostCents?: number | null; externalCostCents?: number | null; included: boolean; sortOrder: number;
}

export interface QuoteAdjustment {
  id?: string; label: string; type: "percentage" | "fixed" | "first_cycle" | "waive_item";
  target: "initial" | "recurring" | "all"; value: number; metadata?: Record<string, unknown>; sortOrder: number;
}

export interface Quote {
  id: string; requestId?: string | null; clientId?: string | null; reference: string; status: QuoteStatus;
  companyName: string; contactName: string; contactEmail: string; title: string; summary: string;
  currency: string; validUntil?: string | null; commitmentMonths?: number | null; paymentTerms: string;
  clientNotes: string; internalNotes: string; ownerUserId?: string | null; items: QuoteItem[];
  adjustments: QuoteAdjustment[]; createdBy: string; sentAt?: string | null; acceptedAt?: string | null;
  rejectedAt?: string | null; createdAt: string; updatedAt: string;
}

export interface QuoteService {
  id: string; name: string; category: string; description: string; pricingType: PricingType;
  defaultAmountCents?: number | null; defaultBillingInterval?: BillingInterval | null;
  estimatedHours?: number | null; internalCostCents?: number | null; active: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
}

export interface QuoteTotals {
  projectSubtotalCents: number; recurringByInterval: Record<BillingInterval, number>;
  mrrCents: number; discountsCents: number; initialTotalCents: number;
  contractedRecurringCents: number; internalCostCents: number; marginCents: number;
  marginPercent: number | null; effectiveHourlyRateCents: number | null; performanceItems: QuoteItem[];
}

export interface QuotesPayload { requests: QuoteRequest[]; quotes: Quote[]; services: QuoteService[]; }
