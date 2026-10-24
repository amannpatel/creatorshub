"use server";

import mongoose from "mongoose";
import { requireUser } from "../auth/session";
import { connectDB } from "../db";
import { ActivityModel, CollaborationModel, PaymentModel, TaskModel } from "../models";
import {
  ensureBrand,
  escapeRegex,
  logActivity,
  oid,
  revalidateApp,
  serverError,
  validationError,
} from "../util";
import {
  defaultsForNewCollab,
  statusChangeEffects,
  statusFromDeliverables,
} from "@/lib/automation";
import {
  COLLAB_STATUSES,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_META,
  STATUS_META,
  type CollabStatus,
  type DeliverableStatus,
} from "@/lib/constants";
import { addDays, todayIn } from "@/lib/dates";
import { collabInput, createCollabInput, deliverableInput } from "@/lib/validation";
import type { ActionResult, SessionUser } from "@/lib/types";
import { z } from "zod";

async function ctx() {
  const user = await requireUser();
  await connectDB();
  return { user, userId: new mongoose.Types.ObjectId(user.id), today: todayIn(user.settings.timezone) };
}

async function loadOwned(userId: mongoose.Types.ObjectId, id: string) {
  const _id = oid(id);
  if (!_id) return null;
  return CollaborationModel.findOne({ _id, userId });
}

function settingsOf(user: SessionUser) {
  return { followUpDays: user.settings.followUpDays, paymentTermsDays: user.settings.paymentTermsDays };
}

function defaultTitle(brandName: string, deliverables: { title: string }[]) {
  if (deliverables.length) return `${brandName} — ${deliverables.map((d) => d.title).join(", ")}`.slice(0, 200);
  return `${brandName} collaboration`;
}

export async function createCollaboration(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createCollabInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { user, userId, today } = await ctx();
    const { clientRequestId, allowDuplicate, amount, deliverables, ...input } = parsed.data;

    const existingRequest = await CollaborationModel.findOne({ userId, clientRequestId }, { _id: 1 }).lean();
    if (existingRequest) return { ok: true, data: { id: String(existingRequest._id) } };

    const brandId = await ensureBrand(userId, input.brandName, {
      contactName: input.contactName,
      email: input.contactEmail,
      phone: input.contactPhone,
    });
    const title = input.title || defaultTitle(input.brandName, deliverables);

    if (!allowDuplicate) {
      const dup = await CollaborationModel.findOne(
        {
          userId,
          brandId,
          title: { $regex: `^${escapeRegex(title)}$`, $options: "i" },
          status: { $nin: ["completed", "cancelled"] },
        },
        { _id: 1 },
      ).lean();
      if (dup) {
        return {
          ok: false,
          error: `An open collaboration "${title}" with ${input.brandName} already exists.`,
          duplicateId: String(dup._id),
        };
      }
    }

    const auto = defaultsForNewCollab({ ...input, amountMinor: amount }, today, settingsOf(user));
    const doc = await CollaborationModel.create({
      ...input,
      ...auto.patch,
      title,
      userId,
      brandId,
      amountMinor: amount,
      receivedMinor: 0,
      deliverables: deliverables.map(({ id: _ignored, ...d }) => d),
      platforms: [...new Set([...input.platforms, ...deliverables.flatMap((d) => (d.platform ? [d.platform] : []))])],
      clientRequestId,
    });
    await logActivity(
      userId,
      doc._id,
      "created",
      `Added as ${STATUS_META[input.status].label}${auto.notes.length ? ` · ${auto.notes.join(" · ")}` : ""}`,
    );
    revalidateApp();
    return { ok: true, data: { id: String(doc._id) } };
  } catch (err) {
    if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
      return { ok: false, error: "This collaboration was already saved." };
    }
    return serverError(err, "createCollaboration");
  }
}

export async function updateCollaboration(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = collabInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { user, userId, today } = await ctx();
    const doc = await loadOwned(userId, id);
    if (!doc) return { ok: false, error: "Collaboration not found." };
    const { amount, deliverables, ...input } = parsed.data;
    const prevStatus = doc.status as CollabStatus;
    const messages: string[] = [];

    if (input.brandName.trim().toLowerCase() !== doc.brandName.trim().toLowerCase()) {
      doc.brandId = await ensureBrand(userId, input.brandName, {
        contactName: input.contactName,
        email: input.contactEmail,
        phone: input.contactPhone,
      });
    }
    if (amount !== doc.amountMinor) messages.push("Agreed amount updated");

    doc.set({ ...input, title: input.title || doc.title, amountMinor: amount });
    // Keep ids of existing deliverables so their history stays stable.
    doc.set(
      "deliverables",
      deliverables.map(({ id: delivId, ...d }) => (delivId && mongoose.isValidObjectId(delivId) ? { _id: delivId, ...d } : d)),
    );

    if (prevStatus !== input.status) {
      const effects = statusChangeEffects(prevStatus, input.status, { followUpOn: input.followUpOn }, today, settingsOf(user));
      doc.set(effects.patch);
      messages.unshift(`Status: ${STATUS_META[prevStatus].label} → ${STATUS_META[input.status].label}`, ...effects.notes);
    }
    await doc.save();
    await logActivity(userId, doc._id, prevStatus !== input.status ? "status" : "updated", messages.length ? messages.join(" · ") : "Details updated");
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "updateCollaboration");
  }
}

export async function setCollabStatus(id: string, status: string): Promise<ActionResult> {
  const parsed = z.enum(COLLAB_STATUSES).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Unknown status." };
  try {
    const { user, userId, today } = await ctx();
    const doc = await loadOwned(userId, id);
    if (!doc) return { ok: false, error: "Collaboration not found." };
    const prev = doc.status as CollabStatus;
    if (prev === parsed.data) return { ok: true };
    const effects = statusChangeEffects(prev, parsed.data, { followUpOn: doc.followUpOn }, today, settingsOf(user));
    doc.set({ status: parsed.data, ...effects.patch });
    await doc.save();
    await logActivity(
      userId,
      doc._id,
      "status",
      [`Status: ${STATUS_META[prev].label} → ${STATUS_META[parsed.data].label}`, ...effects.notes].join(" · "),
    );
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "setCollabStatus");
  }
}

export async function deleteCollaboration(id: string): Promise<ActionResult> {
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    if (!_id) return { ok: false, error: "Collaboration not found." };
    const res = await CollaborationModel.deleteOne({ _id, userId });
    if (res.deletedCount === 0) return { ok: false, error: "Collaboration not found." };
    await Promise.all([
      PaymentModel.deleteMany({ userId, collaborationId: _id }),
      TaskModel.deleteMany({ userId, collaborationId: _id }),
      ActivityModel.deleteMany({ userId, collaborationId: _id }),
    ]);
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "deleteCollaboration");
  }
}

const noteSchema = z.string().trim().min(1, "Write something first").max(2000);

export async function addCollabNote(id: string, note: string): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(note);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const doc = await loadOwned(userId, id);
    if (!doc) return { ok: false, error: "Collaboration not found." };
    await logActivity(userId, doc._id, "note", parsed.data);
    doc.set("updatedAt", new Date());
    await doc.save();
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "addCollabNote");
  }
}

/** Records that a follow-up happened and schedules the next one. */
export async function logFollowUp(id: string, note?: string): Promise<ActionResult> {
  try {
    const { user, userId, today } = await ctx();
    const doc = await loadOwned(userId, id);
    if (!doc) return { ok: false, error: "Collaboration not found." };
    const next = addDays(today, user.settings.followUpDays);
    doc.followUpOn = next;
    await doc.save();
    const extra = note?.trim() ? ` — ${note.trim().slice(0, 500)}` : "";
    await logActivity(userId, doc._id, "follow_up", `Followed up. Next follow-up ${next}${extra}`);
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "logFollowUp");
  }
}

export async function markInvoiceSent(id: string): Promise<ActionResult> {
  try {
    const { userId, today } = await ctx();
    const doc = await loadOwned(userId, id);
    if (!doc) return { ok: false, error: "Collaboration not found." };
    doc.invoiceSentOn = today;
    await doc.save();
    await logActivity(userId, doc._id, "payment", `Invoice marked as sent${doc.invoiceNumber ? ` (${doc.invoiceNumber})` : ""}`);
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "markInvoiceSent");
  }
}

async function applyDeliverableAutomation(
  doc: NonNullable<Awaited<ReturnType<typeof loadOwned>>>,
  user: SessionUser,
  userId: mongoose.Types.ObjectId,
  today: string,
) {
  const suggestion = statusFromDeliverables(
    doc.status as CollabStatus,
    doc.deliverables.map((d) => ({ status: d.status as DeliverableStatus })),
  );
  if (!suggestion) return;
  const effects = statusChangeEffects(doc.status as CollabStatus, suggestion.status, { followUpOn: doc.followUpOn }, today, settingsOf(user));
  doc.set({ status: suggestion.status, ...effects.patch });
  await doc.save();
  await logActivity(userId, doc._id, "status", [suggestion.note, ...effects.notes].join(" · "));
}

export async function addDeliverable(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = deliverableInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const doc = await loadOwned(userId, id);
    if (!doc) return { ok: false, error: "Collaboration not found." };
    if (doc.deliverables.length >= 30) return { ok: false, error: "That's a lot of deliverables — 30 max." };
    const { id: _ignored, ...d } = parsed.data;
    doc.deliverables.push(d);
    if (d.platform && !doc.platforms.includes(d.platform)) doc.platforms.push(d.platform);
    await doc.save();
    await logActivity(userId, doc._id, "deliverable", `Deliverable added: ${d.title}`);
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "addDeliverable");
  }
}

export async function updateDeliverable(id: string, deliverableId: string, raw: unknown): Promise<ActionResult> {
  const parsed = deliverableInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { user, userId, today } = await ctx();
    const doc = await loadOwned(userId, id);
    const d = doc?.deliverables.id(deliverableId);
    if (!doc || !d) return { ok: false, error: "Deliverable not found." };
    const { id: _ignored, ...patch } = parsed.data;
    const statusChanged = d.status !== patch.status;
    d.set(patch);
    await doc.save();
    if (statusChanged) {
      await logActivity(userId, doc._id, "deliverable", `${patch.title}: ${DELIVERABLE_STATUS_META[patch.status].label}`);
      await applyDeliverableAutomation(doc, user, userId, today);
    }
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "updateDeliverable");
  }
}

export async function setDeliverableStatus(id: string, deliverableId: string, status: string): Promise<ActionResult> {
  const parsed = z.enum(DELIVERABLE_STATUSES).safeParse(status);
  if (!parsed.success) return { ok: false, error: "Unknown status." };
  try {
    const { user, userId, today } = await ctx();
    const doc = await loadOwned(userId, id);
    const d = doc?.deliverables.id(deliverableId);
    if (!doc || !d) return { ok: false, error: "Deliverable not found." };
    if (d.status === parsed.data) return { ok: true };
    d.status = parsed.data;
    await doc.save();
    await logActivity(userId, doc._id, "deliverable", `${d.title}: ${DELIVERABLE_STATUS_META[parsed.data].label}`);
    await applyDeliverableAutomation(doc, user, userId, today);
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "setDeliverableStatus");
  }
}

export async function removeDeliverable(id: string, deliverableId: string): Promise<ActionResult> {
  try {
    const { userId } = await ctx();
    const doc = await loadOwned(userId, id);
    const d = doc?.deliverables.id(deliverableId);
    if (!doc || !d) return { ok: false, error: "Deliverable not found." };
    const title = d.title;
    d.deleteOne();
    await doc.save();
    await logActivity(userId, doc._id, "deliverable", `Deliverable removed: ${title}`);
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "removeDeliverable");
  }
}
