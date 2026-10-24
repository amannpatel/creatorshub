import { describe, expect, it } from "vitest";
import { paymentState, summarizeFinances, type FinanceCollab } from "./finance";

const today = "2026-10-24";
const base: FinanceCollab = { status: "confirmed", amountMinor: 50_000_00, receivedMinor: 0, paymentDueDate: null, currency: "INR" };

describe("paymentState", () => {
  it("treats collaborations without an agreed amount as no fee", () => {
    expect(paymentState({ ...base, amountMinor: 0 }, today)).toEqual({ paymentStatus: "none", outstandingMinor: 0, isOverdue: false });
  });

  it("is unpaid, then partial, then paid only when the full amount arrives", () => {
    expect(paymentState(base, today).paymentStatus).toBe("unpaid");
    const partial = paymentState({ ...base, receivedMinor: 20_000_00 }, today);
    expect(partial).toEqual({ paymentStatus: "partial", outstandingMinor: 30_000_00, isOverdue: false });
    expect(paymentState({ ...base, receivedMinor: 49_999_99 }, today).paymentStatus).toBe("partial");
    expect(paymentState({ ...base, receivedMinor: 50_000_00 }, today).paymentStatus).toBe("paid");
  });

  it("never reports a negative balance on overpayment", () => {
    expect(paymentState({ ...base, receivedMinor: 60_000_00 }, today)).toEqual({ paymentStatus: "paid", outstandingMinor: 0, isOverdue: false });
  });

  it("is overdue only after the due date with a balance left", () => {
    expect(paymentState({ ...base, paymentDueDate: "2026-10-24" }, today).isOverdue).toBe(false);
    const overdue = paymentState({ ...base, paymentDueDate: "2026-10-23", receivedMinor: 10_000_00 }, today);
    expect(overdue).toEqual({ paymentStatus: "overdue", outstandingMinor: 40_000_00, isOverdue: true });
    expect(paymentState({ ...base, paymentDueDate: "2026-10-01", receivedMinor: 50_000_00 }, today).isOverdue).toBe(false);
  });

  it("never marks cancelled collaborations as overdue or expected", () => {
    const st = paymentState({ ...base, status: "cancelled", paymentDueDate: "2026-09-01" }, today);
    expect(st.isOverdue).toBe(false);
    expect(st.outstandingMinor).toBe(0);
  });
});

describe("summarizeFinances", () => {
  it("aggregates per currency from real payment records", () => {
    const collabs: FinanceCollab[] = [
      { ...base, receivedMinor: 20_000_00, paymentDueDate: "2026-10-10" }, // overdue 30k
      { ...base, amountMinor: 25_000_00, paymentDueDate: "2026-10-30" }, // expected this month
      { ...base, amountMinor: 10_000_00, status: "cancelled" },
      { ...base, amountMinor: 500_00, currency: "USD", receivedMinor: 500_00 },
    ];
    const payments = [
      { amountMinor: 20_000_00, currency: "INR", receivedOn: "2026-10-05" },
      { amountMinor: 500_00, currency: "USD", receivedOn: "2026-09-12" },
    ];
    const s = summarizeFinances(collabs, payments, today);
    expect(s.contracted).toEqual({ INR: 75_000_00, USD: 500_00 });
    expect(s.received).toEqual({ INR: 20_000_00, USD: 500_00 });
    expect(s.outstanding).toEqual({ INR: 55_000_00 });
    expect(s.overdue).toEqual({ INR: 30_000_00 });
    expect(s.overdueCount).toBe(1);
    expect(s.expectedThisMonth).toEqual({ INR: 55_000_00 });
    expect(s.receivedThisMonth).toEqual({ INR: 20_000_00 });
  });
});
