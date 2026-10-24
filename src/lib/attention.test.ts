import { describe, expect, it } from "vitest";
import { buildEvents, buildFocus } from "./attention";
import {
  defaultsForNewCollab,
  missingImportantDates,
  normalizeBrandKey,
  statusChangeEffects,
  statusFromDeliverables,
} from "./automation";
import type { Collaboration, Task } from "./types";

const today = "2026-10-24";
const settings = { followUpDays: 3, paymentTermsDays: 30 };

function collab(over: Partial<Collaboration> = {}): Collaboration {
  return {
    id: "c1",
    brandId: null,
    brandName: "Nike",
    title: "Reel",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    platforms: [],
    type: "paid",
    source: "email",
    description: "",
    notes: "",
    links: [],
    status: "confirmed",
    deliverables: [],
    currency: "INR",
    amountMinor: 0,
    receivedMinor: 0,
    invoiceNumber: "",
    invoiceUrl: "",
    invoiceSentOn: null,
    paymentNotes: "",
    isSample: false,
    createdAt: "",
    updatedAt: "",
    inquiryDate: null,
    responseDeadline: null,
    startDate: null,
    submissionDeadline: null,
    publishDate: null,
    paymentDueDate: null,
    followUpOn: null,
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return { id: "t1", title: "Task", dueDate: today, priority: "medium", done: false, completedAt: null, notes: "", collaborationId: null, collabLabel: null, createdAt: "", ...over };
}

describe("buildFocus", () => {
  it("asks for a reply on new leads", () => {
    const items = buildFocus([collab({ status: "new_lead", inquiryDate: today })], [], today);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "reply", title: "Reply to Nike", urgency: "today", action: { type: "mark_contacted" } });
  });

  it("surfaces due follow-ups but not future ones", () => {
    expect(buildFocus([collab({ status: "contacted", followUpOn: "2026-10-23" })], [], today)[0].kind).toBe("follow_up");
    expect(buildFocus([collab({ status: "contacted", followUpOn: "2026-10-26" })], [], today)).toHaveLength(0);
  });

  it("includes pending deliverables due within two days, ignoring submitted ones", () => {
    const c = collab({
      deliverables: [
        { id: "d1", title: "1 Reel", platform: "instagram", dueDate: "2026-10-25", status: "todo", notes: "" },
        { id: "d2", title: "1 Story", platform: "instagram", dueDate: "2026-10-25", status: "submitted", notes: "" },
        { id: "d3", title: "1 Post", platform: "instagram", dueDate: "2026-11-20", status: "todo", notes: "" },
      ],
    });
    const items = buildFocus([c], [], today);
    expect(items.map((i) => i.id)).toEqual(["deliv:c1:d1"]);
  });

  it("flags overdue payments with the outstanding amount and ranks them first", () => {
    const items = buildFocus(
      [
        collab({ id: "a", amountMinor: 25_000_00, receivedMinor: 5_000_00, paymentDueDate: "2026-10-20" }),
        collab({ id: "b", status: "new_lead", brandName: "Puma", inquiryDate: today }),
      ],
      [task({ dueDate: "2026-10-30" })],
      today,
    );
    expect(items[0]).toMatchObject({ kind: "payment", urgency: "overdue", title: "Chase ₹20,000 from Nike" });
    expect(items.some((i) => i.kind === "task")).toBe(false); // future task isn't in focus
  });

  it("suggests sending an invoice for completed, unpaid, un-invoiced work", () => {
    const items = buildFocus([collab({ status: "completed", amountMinor: 10_000_00 })], [], today);
    expect(items.map((i) => i.kind)).toContain("invoice");
    const invoiced = buildFocus([collab({ status: "completed", amountMinor: 10_000_00, invoiceSentOn: today })], [], today);
    expect(invoiced.map((i) => i.kind)).not.toContain("invoice");
  });

  it("includes overdue tasks and skips completed ones", () => {
    const items = buildFocus([], [task({ id: "x", dueDate: "2026-10-20" }), task({ id: "y", done: true })], today);
    expect(items.map((i) => i.id)).toEqual(["task:x"]);
    expect(items[0].urgency).toBe("overdue");
  });
});

describe("buildEvents", () => {
  it("returns dated items in range, sorted, excluding cancelled collaborations", () => {
    const events = buildEvents(
      [
        collab({ publishDate: "2026-10-28", paymentDueDate: "2026-11-10", amountMinor: 100 }),
        collab({ id: "x", status: "cancelled", publishDate: "2026-10-26" }),
      ],
      [task({ dueDate: "2026-10-25" })],
      today,
      "2026-10-31",
      today,
    );
    expect(events.map((e) => e.type)).toEqual(["task", "publish"]);
  });
});

describe("automation rules", () => {
  it("fills inquiry date and follow-up for contacted leads", () => {
    const out = defaultsForNewCollab({ status: "contacted", amountMinor: 0 }, today, settings);
    expect(out.patch).toEqual({ inquiryDate: today, followUpOn: "2026-10-27" });
  });

  it("derives payment due date from publish date + terms", () => {
    const out = defaultsForNewCollab({ status: "confirmed", amountMinor: 100, publishDate: "2026-11-01" }, today, settings);
    expect(out.patch.paymentDueDate).toBe("2026-12-01");
    expect(defaultsForNewCollab({ status: "confirmed", amountMinor: 0, publishDate: "2026-11-01" }, today, settings).patch.paymentDueDate).toBeUndefined();
  });

  it("schedules follow-ups when moving into conversation and clears them when confirmed", () => {
    expect(statusChangeEffects("new_lead", "contacted", {}, today, settings).patch).toEqual({ followUpOn: "2026-10-27" });
    expect(statusChangeEffects("negotiating", "confirmed", { followUpOn: "2026-10-27" }, today, settings).patch).toEqual({ followUpOn: null });
    expect(statusChangeEffects("contacted", "contacted", {}, today, settings).patch).toEqual({});
  });

  it("moves status based on deliverables, never closing automatically", () => {
    expect(statusFromDeliverables("confirmed", [{ status: "in_progress" }, { status: "todo" }])?.status).toBe("in_progress");
    expect(statusFromDeliverables("in_progress", [{ status: "submitted" }, { status: "approved" }])?.status).toBe("awaiting_approval");
    expect(statusFromDeliverables("awaiting_approval", [{ status: "changes_requested" }])?.status).toBe("in_progress");
    expect(statusFromDeliverables("awaiting_approval", [{ status: "published" }])).toBeNull();
    expect(statusFromDeliverables("confirmed", [])).toBeNull();
  });

  it("lists missing key dates only for confirmed work", () => {
    expect(missingImportantDates({ status: "confirmed", amountMinor: 100, deliverables: [] })).toEqual(["submissionDeadline", "publishDate", "paymentDueDate"]);
    expect(missingImportantDates({ status: "new_lead", amountMinor: 100, deliverables: [] })).toEqual([]);
  });

  it("normalises brand names for auto-association", () => {
    expect(normalizeBrandKey("Mamaearth Pvt. Ltd.")).toBe(normalizeBrandKey("mamaearth"));
    expect(normalizeBrandKey("H&M")).toBe("hm");
  });
});
