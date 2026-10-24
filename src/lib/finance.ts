import type { CollabStatus, PaymentStatus } from "./constants";
import { addTo, type MoneyByCurrency } from "./money";
import { endOfMonth, startOfMonth, type DateOnly } from "./dates";

export interface PaymentInput {
  status: CollabStatus;
  amountMinor: number;
  receivedMinor: number;
  paymentDueDate: DateOnly | null;
}

export interface PaymentState {
  paymentStatus: PaymentStatus;
  outstandingMinor: number;
  isOverdue: boolean;
}

/**
 * Payment status is derived, never stored, so it can't drift from the actual payment records.
 * - No agreed amount (barter/gifted/unknown)  -> "none"
 * - Received >= agreed                       -> "paid"
 * - Past due date with balance left          -> "overdue"
 * - Some received                            -> "partial"
 * - Otherwise                                -> "unpaid"
 * Cancelled collaborations are never overdue and carry no expected balance.
 */
export function paymentState(c: PaymentInput, today: DateOnly): PaymentState {
  const amount = Math.max(0, c.amountMinor || 0);
  const received = Math.max(0, c.receivedMinor || 0);
  if (amount === 0) return { paymentStatus: "none", outstandingMinor: 0, isOverdue: false };

  const outstanding = Math.max(0, amount - received);
  if (outstanding === 0) return { paymentStatus: "paid", outstandingMinor: 0, isOverdue: false };

  if (c.status === "cancelled") {
    return { paymentStatus: received > 0 ? "partial" : "none", outstandingMinor: 0, isOverdue: false };
  }

  const isOverdue = !!c.paymentDueDate && c.paymentDueDate < today;
  return {
    paymentStatus: isOverdue ? "overdue" : received > 0 ? "partial" : "unpaid",
    outstandingMinor: outstanding,
    isOverdue,
  };
}

export interface FinanceCollab extends PaymentInput {
  currency: string;
}

export interface FinanceSummary {
  contracted: MoneyByCurrency;
  received: MoneyByCurrency;
  outstanding: MoneyByCurrency;
  overdue: MoneyByCurrency;
  overdueCount: number;
  expectedThisMonth: MoneyByCurrency;
  receivedThisMonth: MoneyByCurrency;
}

/**
 * `received` is summed from the payment records themselves (the source of truth), while balances
 * use each collaboration's recomputed `receivedMinor`.
 */
export function summarizeFinances(
  collabs: FinanceCollab[],
  payments: { amountMinor: number; currency: string; receivedOn: DateOnly }[],
  today: DateOnly,
): FinanceSummary {
  const summary: FinanceSummary = {
    contracted: {},
    received: {},
    outstanding: {},
    overdue: {},
    overdueCount: 0,
    expectedThisMonth: {},
    receivedThisMonth: {},
  };
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  for (const c of collabs) {
    if (c.status !== "cancelled") addTo(summary.contracted, c.currency, c.amountMinor);
    const st = paymentState(c, today);
    addTo(summary.outstanding, c.currency, st.outstandingMinor);
    if (st.isOverdue) {
      summary.overdueCount++;
      addTo(summary.overdue, c.currency, st.outstandingMinor);
    }
    if (
      st.outstandingMinor > 0 &&
      c.paymentDueDate &&
      c.paymentDueDate >= monthStart &&
      c.paymentDueDate <= monthEnd
    ) {
      addTo(summary.expectedThisMonth, c.currency, st.outstandingMinor);
    }
  }
  for (const p of payments) {
    addTo(summary.received, p.currency, p.amountMinor);
    if (p.receivedOn >= monthStart && p.receivedOn <= monthEnd) {
      addTo(summary.receivedThisMonth, p.currency, p.amountMinor);
    }
  }
  return summary;
}
