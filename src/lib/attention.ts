import {
  ACTIVE_STATUSES,
  DELIVERABLE_PENDING,
  FOLLOW_UP_STATUSES,
  type TaskPriority,
} from "./constants";
import { addDays, diffDays, urgencyOf, type DateOnly, type Urgency } from "./dates";
import { paymentState } from "./finance";
import { formatMoney } from "./money";
import type { Collaboration, Task } from "./types";

export type FocusKind = "task" | "reply" | "follow_up" | "deliverable" | "submission" | "payment" | "invoice";

export type FocusAction =
  | { type: "complete_task"; taskId: string }
  | { type: "mark_contacted"; collaborationId: string }
  | { type: "log_follow_up"; collaborationId: string }
  | { type: "deliverable_submitted"; collaborationId: string; deliverableId: string }
  | { type: "record_payment"; collaborationId: string }
  | { type: "mark_invoiced"; collaborationId: string };

export interface FocusItem {
  id: string;
  kind: FocusKind;
  title: string;
  /** Why this item is shown — keeps automation transparent. */
  reason: string;
  dueDate: DateOnly | null;
  urgency: Urgency;
  score: number;
  collaborationId: string | null;
  action: FocusAction | null;
}

type CollabLike = Pick<
  Collaboration,
  | "id"
  | "brandName"
  | "title"
  | "status"
  | "inquiryDate"
  | "responseDeadline"
  | "startDate"
  | "submissionDeadline"
  | "publishDate"
  | "paymentDueDate"
  | "followUpOn"
  | "deliverables"
  | "amountMinor"
  | "receivedMinor"
  | "currency"
  | "invoiceSentOn"
  | "invoiceNumber"
>;
type TaskLike = Pick<Task, "id" | "title" | "dueDate" | "priority" | "done" | "collaborationId" | "collabLabel">;

const URGENCY_SCORE: Record<Urgency, number> = { overdue: 300, today: 200, soon: 100, later: 0 };
const KIND_SCORE: Record<FocusKind, number> = {
  payment: 30,
  deliverable: 28,
  submission: 26,
  reply: 22,
  invoice: 18,
  follow_up: 15,
  task: 10,
};
const PRIORITY_SCORE: Record<TaskPriority, number> = { high: 20, medium: 8, low: 0 };

/** How far ahead deliverables/payments start appearing in Today's Focus. */
export const FOCUS_LOOKAHEAD_DAYS = 2;

function score(kind: FocusKind, urgency: Urgency, due: DateOnly | null, today: DateOnly, extra = 0) {
  const overdueDays = due && urgency === "overdue" ? Math.min(30, diffDays(due, today)) : 0;
  return URGENCY_SCORE[urgency] + KIND_SCORE[kind] + overdueDays + extra;
}

export function buildFocus(collabs: CollabLike[], tasks: TaskLike[], today: DateOnly): FocusItem[] {
  const items: FocusItem[] = [];
  const horizon = addDays(today, FOCUS_LOOKAHEAD_DAYS);
  const push = (item: Omit<FocusItem, "urgency" | "score">, extra = 0) => {
    const urgency = item.dueDate ? urgencyOf(item.dueDate, today) : "today";
    items.push({ ...item, urgency, score: score(item.kind, urgency, item.dueDate, today, extra) });
  };

  for (const t of tasks) {
    if (t.done || !t.dueDate || t.dueDate > today) continue;
    push(
      {
        id: `task:${t.id}`,
        kind: "task",
        title: t.title,
        reason: t.collabLabel ? `Task · ${t.collabLabel}` : "Task",
        dueDate: t.dueDate,
        collaborationId: t.collaborationId,
        action: { type: "complete_task", taskId: t.id },
      },
      PRIORITY_SCORE[t.priority],
    );
  }

  for (const c of collabs) {
    if (c.status === "new_lead") {
      const due = c.responseDeadline ?? c.inquiryDate ?? today;
      push({
        id: `reply:${c.id}`,
        kind: "reply",
        title: `Reply to ${c.brandName}`,
        reason: c.responseDeadline ? "New lead · response deadline" : "New lead awaiting your reply",
        dueDate: due,
        collaborationId: c.id,
        action: { type: "mark_contacted", collaborationId: c.id },
      });
    }

    if (FOLLOW_UP_STATUSES.includes(c.status) && c.followUpOn && c.followUpOn <= today) {
      push({
        id: `follow:${c.id}`,
        kind: "follow_up",
        title: c.status === "awaiting_approval" ? `Check approval with ${c.brandName}` : `Follow up with ${c.brandName}`,
        reason: "Follow-up date reached",
        dueDate: c.followUpOn,
        collaborationId: c.id,
        action: { type: "log_follow_up", collaborationId: c.id },
      });
    }

    const inFlight = ACTIVE_STATUSES.includes(c.status);
    if (inFlight) {
      for (const d of c.deliverables) {
        if (!DELIVERABLE_PENDING.includes(d.status)) continue;
        const due = d.dueDate ?? c.submissionDeadline;
        if (!due || due > horizon) continue;
        push({
          id: `deliv:${c.id}:${d.id}`,
          kind: "deliverable",
          title: `${d.status === "changes_requested" ? "Revise" : "Submit"} ${d.title} for ${c.brandName}`,
          reason: d.status === "changes_requested" ? "Brand requested changes" : "Deliverable due",
          dueDate: due,
          collaborationId: c.id,
          action: { type: "deliverable_submitted", collaborationId: c.id, deliverableId: d.id },
        });
      }
      if (
        c.deliverables.length === 0 &&
        c.status !== "awaiting_approval" &&
        c.submissionDeadline &&
        c.submissionDeadline <= horizon
      ) {
        push({
          id: `submit:${c.id}`,
          kind: "submission",
          title: `Submit content for ${c.brandName}`,
          reason: "Content submission deadline",
          dueDate: c.submissionDeadline,
          collaborationId: c.id,
          action: null,
        });
      }
    }

    const pay = paymentState(c, today);
    if (pay.outstandingMinor > 0 && c.paymentDueDate && c.paymentDueDate <= horizon) {
      const amount = formatMoney(pay.outstandingMinor, c.currency);
      push({
        id: `pay:${c.id}`,
        kind: "payment",
        title: pay.isOverdue ? `Chase ${amount} from ${c.brandName}` : `${amount} due from ${c.brandName}`,
        reason: pay.isOverdue ? "Payment overdue" : "Payment due soon",
        dueDate: c.paymentDueDate,
        collaborationId: c.id,
        action: { type: "record_payment", collaborationId: c.id },
      });
    }

    if (c.status === "completed" && pay.outstandingMinor > 0 && !c.invoiceSentOn) {
      push({
        id: `invoice:${c.id}`,
        kind: "invoice",
        title: `Send invoice to ${c.brandName}`,
        reason: "Collaboration completed, invoice not marked as sent",
        dueDate: null,
        collaborationId: c.id,
        action: { type: "mark_invoiced", collaborationId: c.id },
      });
    }
  }

  return items.sort(
    (a, b) => b.score - a.score || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
  );
}

export type EventType = "response" | "start" | "submission" | "publish" | "payment" | "follow_up" | "deliverable" | "task";

export interface CalendarEvent {
  id: string;
  date: DateOnly;
  type: EventType;
  title: string;
  subtitle: string;
  href: string;
  done: boolean;
}

export const EVENT_META: Record<EventType, { label: string; tone: string }> = {
  response: { label: "Reply by", tone: "violet" },
  start: { label: "Campaign start", tone: "sky" },
  submission: { label: "Submission", tone: "orange" },
  deliverable: { label: "Deliverable", tone: "orange" },
  publish: { label: "Publish", tone: "pink" },
  payment: { label: "Payment due", tone: "emerald" },
  follow_up: { label: "Follow-up", tone: "amber" },
  task: { label: "Task", tone: "blue" },
};

/** All dated items within [from, to], used by the calendar and "Upcoming deadlines". */
export function buildEvents(
  collabs: CollabLike[],
  tasks: TaskLike[],
  from: DateOnly,
  to: DateOnly,
  today: DateOnly,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const inRange = (d: DateOnly | null | undefined): d is DateOnly => !!d && d >= from && d <= to;

  for (const c of collabs) {
    if (c.status === "cancelled") continue;
    const href = `/collaborations/${c.id}`;
    const closed = c.status === "completed";
    const add = (type: EventType, date: DateOnly | null, title: string, done = closed) => {
      if (inRange(date)) events.push({ id: `${type}:${c.id}:${date}:${title}`, date, type, title, subtitle: c.brandName, href, done });
    };
    if (c.status === "new_lead") add("response", c.responseDeadline, `Reply to ${c.brandName}`, false);
    add("start", c.startDate, c.title);
    if (c.deliverables.length === 0) add("submission", c.submissionDeadline, `Submit: ${c.title}`);
    add("publish", c.publishDate, `Publish: ${c.title}`);
    if (FOLLOW_UP_STATUSES.includes(c.status)) add("follow_up", c.followUpOn, `Follow up: ${c.brandName}`, false);
    const pay = paymentState(c, today);
    if (c.paymentDueDate && c.amountMinor > 0) {
      const shown = pay.outstandingMinor > 0 ? pay.outstandingMinor : c.amountMinor;
      add("payment", c.paymentDueDate, `${formatMoney(shown, c.currency)} payment`, pay.outstandingMinor === 0);
    }
    for (const d of c.deliverables) {
      add("deliverable", d.dueDate ?? c.submissionDeadline, d.title, !DELIVERABLE_PENDING.includes(d.status));
    }
  }
  for (const t of tasks) {
    if (inRange(t.dueDate)) {
      events.push({
        id: `task:${t.id}`,
        date: t.dueDate,
        type: "task",
        title: t.title,
        subtitle: t.collabLabel ?? "Personal task",
        href: t.collaborationId ? `/collaborations/${t.collaborationId}` : "/tasks",
        done: t.done,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || Number(a.done) - Number(b.done));
}
