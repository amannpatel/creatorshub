import "server-only";
import mongoose from "mongoose";
import { connectDB } from "./db";
import {
  ActivityModel,
  BrandModel,
  CollaborationModel,
  PaymentModel,
  TaskModel,
  type ActivityDoc,
  type BrandDoc,
  type CollaborationDoc,
  type PaymentDoc,
  type TaskDoc,
} from "./models";
import { toActivity, toBrand, toCollaboration, toPayment, toTask } from "./mappers";
import { escapeRegex, oid } from "./util";
import { buildEvents, buildFocus } from "@/lib/attention";
import {
  ACTIVE_STATUSES,
  COLLAB_STATUSES,
  COLLAB_TYPES,
  PAYMENT_STATUSES,
  PIPELINE_STATUSES,
  PLATFORMS,
  type CollabStatus,
  type PaymentStatus,
} from "@/lib/constants";
import { addDays, endOfMonth, isDateOnly, monthGrid, startOfMonth, todayIn, type DateOnly } from "@/lib/dates";
import { paymentState, summarizeFinances } from "@/lib/finance";
import { addTo, type MoneyByCurrency } from "@/lib/money";
import type { Collaboration, SessionUser, Task } from "@/lib/types";

const asCollabs = (docs: unknown[]) => (docs as CollaborationDoc[]).map(toCollaboration);

async function base(user: SessionUser) {
  await connectDB();
  return { userId: new mongoose.Types.ObjectId(user.id), today: todayIn(user.settings.timezone) };
}

/** Collaborations that can still need attention (open, or completed with money outstanding). */
const attentionFilter = (userId: mongoose.Types.ObjectId) => ({
  userId,
  $or: [
    { status: { $nin: ["completed", "cancelled"] } },
    { status: "completed", $expr: { $gt: ["$amountMinor", "$receivedMinor"] } },
  ],
});

async function collabLabels(userId: mongoose.Types.ObjectId, ids: (mongoose.Types.ObjectId | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean).map(String))].map((id) => new mongoose.Types.ObjectId(id));
  if (!unique.length) return new Map<string, string>();
  const docs = await CollaborationModel.find({ userId, _id: { $in: unique } }, { brandName: 1, title: 1 }).lean();
  return new Map(docs.map((d) => [String(d._id), d.brandName]));
}

async function tasksWithLabels(userId: mongoose.Types.ObjectId, docs: unknown[]): Promise<Task[]> {
  const tasks = docs as TaskDoc[];
  const labels = await collabLabels(userId, tasks.map((t) => t.collaborationId));
  return tasks.map((t) => toTask(t, t.collaborationId ? labels.get(String(t.collaborationId)) ?? null : null));
}

/* -------------------------------- Dashboard ------------------------------- */

export async function getDashboard(user: SessionUser) {
  const { userId, today } = await base(user);
  const [openDocs, moneyDocs, taskDocs, paymentDocs, activityDocs, newLeadCount] = await Promise.all([
    CollaborationModel.find(attentionFilter(userId)).sort({ updatedAt: -1 }).limit(500).lean(),
    CollaborationModel.find(
      { userId },
      { status: 1, amountMinor: 1, receivedMinor: 1, paymentDueDate: 1, currency: 1 },
    ).lean(),
    TaskModel.find({ userId, done: false }).sort({ dueDate: 1 }).limit(500).lean(),
    PaymentModel.find({ userId }, { amountMinor: 1, currency: 1, receivedOn: 1 }).lean(),
    ActivityModel.find({ userId }).sort({ createdAt: -1 }).limit(12).lean(),
    CollaborationModel.countDocuments({ userId, status: "new_lead" }),
  ]);
  const collabs = asCollabs(openDocs);
  const tasks = await tasksWithLabels(userId, taskDocs);
  const focus = buildFocus(collabs, tasks, today);
  const upcoming = buildEvents(collabs, tasks, addDays(today, 1), addDays(today, 14), today).filter((e) => !e.done);
  const finance = summarizeFinances(
    moneyDocs.map((c) => ({
      status: c.status as CollabStatus,
      amountMinor: c.amountMinor ?? 0,
      receivedMinor: c.receivedMinor ?? 0,
      paymentDueDate: c.paymentDueDate ?? null,
      currency: c.currency ?? "INR",
    })),
    paymentDocs.map((p) => ({ amountMinor: p.amountMinor, currency: p.currency, receivedOn: p.receivedOn })),
    today,
  );
  const activityCollabs = await collabLabels(userId, activityDocs.map((a) => a.collaborationId));
  const activity = (activityDocs as ActivityDoc[]).map((a) => ({
    ...toActivity(a),
    collabLabel: a.collaborationId ? activityCollabs.get(String(a.collaborationId)) ?? null : null,
  }));
  return {
    today,
    focus,
    upcoming,
    finance,
    activity,
    counts: {
      active: collabs.filter((c) => ACTIVE_STATUSES.includes(c.status)).length,
      newLeads: newLeadCount,
      pipeline: collabs.filter((c) => PIPELINE_STATUSES.includes(c.status)).length,
      dueThisWeek: buildEvents(collabs, tasks, today, addDays(today, 7), today).filter(
        (e) => !e.done && e.type !== "follow_up" && e.type !== "start",
      ).length,
      total: moneyDocs.length,
    },
    hasSample: openDocs.some((d) => d.isSample),
  };
}

/** Lightweight count for the notification bell. */
export async function getAttentionCount(user: SessionUser) {
  const { userId, today } = await base(user);
  const [docs, taskDocs] = await Promise.all([
    CollaborationModel.find(attentionFilter(userId)).limit(500).lean(),
    TaskModel.find({ userId, done: false, dueDate: { $ne: null, $lte: today } }).limit(500).lean(),
  ]);
  const focus = buildFocus(asCollabs(docs), await tasksWithLabels(userId, taskDocs), today);
  return focus.filter((f) => f.urgency === "overdue" || f.urgency === "today");
}

/* ------------------------------ Collaborations ----------------------------- */

export interface CollabFilters {
  q?: string;
  status?: string;
  platform?: string;
  type?: string;
  payment?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export type CollabListItem = Collaboration & {
  paymentStatus: PaymentStatus;
  outstandingMinor: number;
  nextDate: DateOnly | null;
};

function nextRelevantDate(c: Collaboration, today: DateOnly): DateOnly | null {
  const candidates = [
    c.status === "new_lead" ? c.responseDeadline : null,
    c.submissionDeadline,
    c.publishDate,
    c.followUpOn,
    c.receivedMinor < c.amountMinor ? c.paymentDueDate : null,
    ...c.deliverables.map((d) => d.dueDate),
  ].filter((d): d is DateOnly => !!d);
  if (!candidates.length) return null;
  const overdueOrUpcoming = candidates.sort();
  return overdueOrUpcoming.find((d) => d >= addDays(today, -30)) ?? overdueOrUpcoming[overdueOrUpcoming.length - 1];
}

export async function listCollaborations(user: SessionUser, f: CollabFilters) {
  const { userId, today } = await base(user);
  const query: Record<string, unknown> = { userId };

  if (f.status === "active") query.status = { $in: ACTIVE_STATUSES };
  else if (f.status === "pipeline") query.status = { $in: PIPELINE_STATUSES };
  else if (f.status === "closed") query.status = { $in: ["completed", "cancelled"] };
  else if (f.status === "open") query.status = { $nin: ["completed", "cancelled"] };
  else if (f.status && (COLLAB_STATUSES as readonly string[]).includes(f.status)) query.status = f.status;

  if (f.platform && (PLATFORMS as readonly string[]).includes(f.platform)) query.platforms = f.platform;
  if (f.type && (COLLAB_TYPES as readonly string[]).includes(f.type)) query.type = f.type;
  if (f.from && isDateOnly(f.from)) query.inquiryDate = { ...(query.inquiryDate as object), $gte: f.from };
  if (f.to && isDateOnly(f.to)) query.inquiryDate = { ...(query.inquiryDate as object), $lte: f.to };

  const q = f.q?.trim().slice(0, 80);
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    query.$or = [
      { brandName: rx },
      { title: rx },
      { contactName: rx },
      { contactEmail: rx },
      { notes: rx },
      { description: rx },
      { status: q.toLowerCase().replace(/\s+/g, "_") },
    ];
  }

  const docs = await CollaborationModel.find(query).sort({ updatedAt: -1 }).limit(1000).lean();
  let items: CollabListItem[] = asCollabs(docs).map((c) => {
    const pay = paymentState(c, today);
    return { ...c, paymentStatus: pay.paymentStatus, outstandingMinor: pay.outstandingMinor, nextDate: nextRelevantDate(c, today) };
  });

  if (f.payment && (PAYMENT_STATUSES as readonly string[]).includes(f.payment)) {
    items = items.filter((c) => c.paymentStatus === f.payment);
  }

  if (f.sort === "deadline") {
    items.sort((a, b) => (a.nextDate ?? "9999").localeCompare(b.nextDate ?? "9999"));
  } else if (f.sort === "amount") {
    items.sort((a, b) => b.amountMinor - a.amountMinor);
  } else if (f.sort === "created") {
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  return { items, today };
}

export async function getCollaborationDetail(user: SessionUser, id: string) {
  const { userId, today } = await base(user);
  const _id = oid(id);
  if (!_id) return null;
  const doc = await CollaborationModel.findOne({ _id, userId }).lean();
  if (!doc) return null;
  const [paymentDocs, taskDocs, activityDocs] = await Promise.all([
    PaymentModel.find({ userId, collaborationId: _id }).sort({ receivedOn: -1, createdAt: -1 }).lean(),
    TaskModel.find({ userId, collaborationId: _id }).sort({ done: 1, dueDate: 1 }).lean(),
    ActivityModel.find({ userId, collaborationId: _id }).sort({ createdAt: -1 }).limit(100).lean(),
  ]);
  const collab = toCollaboration(doc as CollaborationDoc);
  return {
    today,
    collab,
    payment: paymentState(collab, today),
    payments: (paymentDocs as PaymentDoc[]).map((p) => toPayment(p, collab)),
    tasks: (taskDocs as TaskDoc[]).map((t) => toTask(t, collab.brandName)),
    activity: (activityDocs as ActivityDoc[]).map(toActivity),
    focus: buildFocus([collab], [], today),
  };
}

/* ---------------------------------- Tasks --------------------------------- */

export async function listTasks(user: SessionUser) {
  const { userId, today } = await base(user);
  const [open, done] = await Promise.all([
    TaskModel.find({ userId, done: false }).sort({ dueDate: 1, createdAt: -1 }).limit(1000).lean(),
    TaskModel.find({ userId, done: true }).sort({ completedAt: -1 }).limit(100).lean(),
  ]);
  return { today, tasks: await tasksWithLabels(userId, [...open, ...done]) };
}

/* -------------------------------- Payments -------------------------------- */

export interface PaymentFilters {
  month?: string;
  brand?: string;
  status?: string;
}

export async function getPaymentsPage(user: SessionUser, f: PaymentFilters) {
  const { userId, today } = await base(user);
  const [collabDocs, paymentDocs] = await Promise.all([
    CollaborationModel.find({ userId, amountMinor: { $gt: 0 } }).sort({ paymentDueDate: 1 }).lean(),
    PaymentModel.find({ userId }).sort({ receivedOn: -1, createdAt: -1 }).limit(2000).lean(),
  ]);
  const collabs = asCollabs(collabDocs);
  const byId = new Map(collabs.map((c) => [c.id, c]));
  // Payments may belong to collaborations whose amount was later cleared; look those up too.
  const missing = paymentDocs.filter((p) => !byId.has(String(p.collaborationId))).map((p) => p.collaborationId);
  if (missing.length) {
    const extra = await CollaborationModel.find({ userId, _id: { $in: missing } }).lean();
    for (const c of asCollabs(extra)) byId.set(c.id, c);
  }

  const allPayments = (paymentDocs as PaymentDoc[]).map((p) => {
    const c = byId.get(String(p.collaborationId));
    return toPayment(p, c ? { brandName: c.brandName, title: c.title } : undefined);
  });
  const summary = summarizeFinances(collabs, allPayments, today);

  const brandQuery = f.brand?.trim().toLowerCase();
  const month = f.month && /^\d{4}-\d{2}$/.test(f.month) ? f.month : null;

  const receivables = collabs
    .map((c) => ({ ...c, ...paymentState(c, today) }))
    .filter((c) => c.paymentStatus !== "none")
    .filter((c) => (!f.status || f.status === "all" ? c.paymentStatus !== "paid" : c.paymentStatus === f.status))
    .filter((c) => !brandQuery || c.brandName.toLowerCase().includes(brandQuery))
    .filter((c) => !month || (c.paymentDueDate ?? "").startsWith(month))
    .sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || (a.paymentDueDate ?? "9999").localeCompare(b.paymentDueDate ?? "9999"));

  const payments = allPayments
    .filter((p) => !brandQuery || p.brandName.toLowerCase().includes(brandQuery))
    .filter((p) => !month || p.receivedOn.startsWith(month));

  const filteredTotal: MoneyByCurrency = {};
  for (const p of payments) addTo(filteredTotal, p.currency, p.amountMinor);

  return { today, summary, receivables, payments, filteredTotal };
}

/* --------------------------------- Brands --------------------------------- */

export interface BrandStats {
  count: number;
  active: number;
  contracted: MoneyByCurrency;
  received: MoneyByCurrency;
  lastActivity: string | null;
}

export async function listBrands(user: SessionUser, q?: string) {
  const { userId } = await base(user);
  const filter: Record<string, unknown> = { userId };
  if (q?.trim()) filter.name = { $regex: escapeRegex(q.trim().slice(0, 80)), $options: "i" };
  const [brandDocs, collabDocs] = await Promise.all([
    BrandModel.find(filter).sort({ name: 1 }).limit(1000).lean(),
    CollaborationModel.find(
      { userId, brandId: { $ne: null } },
      { brandId: 1, status: 1, amountMinor: 1, receivedMinor: 1, currency: 1, updatedAt: 1 },
    ).lean(),
  ]);
  const stats = new Map<string, BrandStats>();
  for (const c of collabDocs) {
    const key = String(c.brandId);
    const s = stats.get(key) ?? { count: 0, active: 0, contracted: {}, received: {}, lastActivity: null };
    s.count++;
    if (ACTIVE_STATUSES.includes(c.status as CollabStatus)) s.active++;
    if (c.status !== "cancelled") addTo(s.contracted, c.currency ?? "INR", c.amountMinor ?? 0);
    addTo(s.received, c.currency ?? "INR", c.receivedMinor ?? 0);
    const updated = c.updatedAt ? new Date(c.updatedAt).toISOString() : null;
    if (updated && (!s.lastActivity || updated > s.lastActivity)) s.lastActivity = updated;
    stats.set(key, s);
  }
  return (brandDocs as (BrandDoc & { createdAt?: Date })[]).map((b) => ({
    ...toBrand(b),
    stats: stats.get(String(b._id)) ?? { count: 0, active: 0, contracted: {}, received: {}, lastActivity: null },
  }));
}

export async function getBrandDetail(user: SessionUser, id: string) {
  const { userId, today } = await base(user);
  const _id = oid(id);
  if (!_id) return null;
  const brand = await BrandModel.findOne({ _id, userId }).lean();
  if (!brand) return null;
  const docs = await CollaborationModel.find({ userId, brandId: _id }).sort({ createdAt: -1 }).lean();
  const collabs = asCollabs(docs).map((c) => ({ ...c, ...paymentState(c, today) }));
  const contracted: MoneyByCurrency = {};
  const received: MoneyByCurrency = {};
  const outstanding: MoneyByCurrency = {};
  for (const c of collabs) {
    if (c.status !== "cancelled") addTo(contracted, c.currency, c.amountMinor);
    addTo(received, c.currency, c.receivedMinor);
    addTo(outstanding, c.currency, c.outstandingMinor);
  }
  return { today, brand: toBrand(brand as BrandDoc), collabs, totals: { contracted, received, outstanding } };
}

/* -------------------------------- Calendar -------------------------------- */

export async function getCalendar(user: SessionUser, monthParam?: string) {
  const { userId, today } = await base(user);
  const anchor = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? `${monthParam}-01` : startOfMonth(today);
  const grid = monthGrid(anchor);
  const from = grid[0];
  const to = grid[grid.length - 1];
  const [collabDocs, taskDocs] = await Promise.all([
    CollaborationModel.find({ userId, status: { $ne: "cancelled" } }).limit(2000).lean(),
    TaskModel.find({ userId, dueDate: { $gte: from, $lte: to } }).lean(),
  ]);
  const tasks = await tasksWithLabels(userId, taskDocs);
  const events = buildEvents(asCollabs(collabDocs), tasks, from, to, today);
  return { today, anchor, grid, monthEnd: endOfMonth(anchor), events };
}

/* --------------------------------- Export --------------------------------- */

export async function exportAll(user: SessionUser) {
  const { userId } = await base(user);
  const [collabs, payments, tasks, brands] = await Promise.all([
    CollaborationModel.find({ userId }).sort({ createdAt: 1 }).lean(),
    PaymentModel.find({ userId }).sort({ receivedOn: 1 }).lean(),
    TaskModel.find({ userId }).sort({ createdAt: 1 }).lean(),
    BrandModel.find({ userId }).sort({ name: 1 }).lean(),
  ]);
  const collabList = asCollabs(collabs);
  const byId = new Map(collabList.map((c) => [c.id, c]));
  return {
    exportedAt: new Date().toISOString(),
    collaborations: collabList,
    payments: (payments as PaymentDoc[]).map((p) => {
      const c = byId.get(String(p.collaborationId));
      return toPayment(p, c ? { brandName: c.brandName, title: c.title } : undefined);
    }),
    tasks: (tasks as TaskDoc[]).map((t) => toTask(t, t.collaborationId ? byId.get(String(t.collaborationId))?.brandName ?? null : null)),
    brands: (brands as BrandDoc[]).map(toBrand),
  };
}
