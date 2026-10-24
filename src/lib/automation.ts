/**
 * Predictable, rule-based automations. Every rule here is pure and covered by tests so the app's
 * "smart" behaviour stays transparent.
 */
import { DELIVERABLE_PENDING, FOLLOW_UP_STATUSES, type CollabStatus, type DeliverableStatus } from "./constants";
import { addDays, type DateOnly } from "./dates";
import type { CollabDates } from "./types";

export interface AutomationSettings {
  followUpDays: number;
  paymentTermsDays: number;
}

export interface AutomationOutcome {
  patch: Partial<CollabDates>;
  /** Human-readable notes logged to the timeline so the user knows what changed and why. */
  notes: string[];
}

/** Dates to set automatically when a collaboration is created. */
export function defaultsForNewCollab(
  input: Partial<CollabDates> & { status: CollabStatus; amountMinor: number },
  today: DateOnly,
  settings: AutomationSettings,
): AutomationOutcome {
  const patch: Partial<CollabDates> = {};
  const notes: string[] = [];
  if (!input.inquiryDate) patch.inquiryDate = today;

  if (FOLLOW_UP_STATUSES.includes(input.status) && !input.followUpOn) {
    patch.followUpOn = addDays(today, settings.followUpDays);
    notes.push(`Follow-up scheduled in ${settings.followUpDays} days`);
  }

  const paymentDue = suggestPaymentDueDate(input, settings);
  if (paymentDue) {
    patch.paymentDueDate = paymentDue;
    notes.push(`Payment due date set ${settings.paymentTermsDays} days after delivery`);
  }
  return { patch, notes };
}

export function suggestPaymentDueDate(
  c: Partial<CollabDates> & { amountMinor: number },
  settings: AutomationSettings,
): DateOnly | null {
  if (c.paymentDueDate || c.amountMinor <= 0) return null;
  const base = c.publishDate ?? c.submissionDeadline;
  return base ? addDays(base, settings.paymentTermsDays) : null;
}

/** Side effects of moving a collaboration from one status to another. */
export function statusChangeEffects(
  prev: CollabStatus,
  next: CollabStatus,
  current: Partial<CollabDates>,
  today: DateOnly,
  settings: AutomationSettings,
): AutomationOutcome {
  const patch: Partial<CollabDates> = {};
  const notes: string[] = [];
  if (prev === next) return { patch, notes };

  if (FOLLOW_UP_STATUSES.includes(next)) {
    // Moving forward in the conversation resets the follow-up clock.
    const nextFollowUp = addDays(today, settings.followUpDays);
    if (!current.followUpOn || current.followUpOn <= today || !FOLLOW_UP_STATUSES.includes(prev)) {
      patch.followUpOn = nextFollowUp;
      notes.push(`Follow-up scheduled for ${nextFollowUp}`);
    }
  } else if (current.followUpOn) {
    patch.followUpOn = null;
  }
  return { patch, notes };
}

/** Key dates worth having once a collaboration is confirmed. */
export function missingImportantDates(
  c: Partial<CollabDates> & { status: CollabStatus; amountMinor: number; deliverables: { dueDate: DateOnly | null }[] },
): (keyof CollabDates)[] {
  if (!["confirmed", "in_progress", "awaiting_approval"].includes(c.status)) return [];
  const missing: (keyof CollabDates)[] = [];
  const deliverablesDated = c.deliverables.length > 0 && c.deliverables.every((d) => d.dueDate);
  if (!c.submissionDeadline && !deliverablesDated) missing.push("submissionDeadline");
  if (!c.publishDate) missing.push("publishDate");
  if (c.amountMinor > 0 && !c.paymentDueDate) missing.push("paymentDueDate");
  return missing;
}

export const DELIVERABLE_SUGGESTIONS: { title: string; platform: "instagram" | "youtube" | "linkedin" }[] = [
  { title: "Instagram Reel", platform: "instagram" },
  { title: "Instagram Story", platform: "instagram" },
  { title: "Instagram Post", platform: "instagram" },
  { title: "YouTube Integration", platform: "youtube" },
  { title: "YouTube Short", platform: "youtube" },
  { title: "LinkedIn Post", platform: "linkedin" },
];

/**
 * Suggests the collaboration status implied by its deliverables:
 * - work started on a confirmed collaboration       -> in progress
 * - everything submitted while confirmed/in progress -> awaiting approval
 * Never moves a collaboration backwards or closes it automatically.
 */
export function statusFromDeliverables(
  status: CollabStatus,
  deliverables: { status: DeliverableStatus }[],
): { status: CollabStatus; note: string } | null {
  if (deliverables.length === 0) return null;
  const pending = deliverables.filter((d) => DELIVERABLE_PENDING.includes(d.status));
  if ((status === "confirmed" || status === "in_progress") && pending.length === 0) {
    const allDone = deliverables.every((d) => d.status === "approved" || d.status === "published");
    if (!allDone) {
      return { status: "awaiting_approval", note: "Moved to Awaiting approval — all deliverables submitted" };
    }
    return null;
  }
  if (status === "confirmed" && deliverables.some((d) => d.status !== "todo")) {
    return { status: "in_progress", note: "Moved to In progress — work started on a deliverable" };
  }
  if (status === "awaiting_approval" && deliverables.some((d) => d.status === "changes_requested")) {
    return { status: "in_progress", note: "Moved back to In progress — changes requested" };
  }
  return null;
}

export function normalizeBrandKey(name: string): string {
  const key = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(pvt|private|ltd|limited|inc|llp|llc|co)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return key || name.trim().toLowerCase();
}
