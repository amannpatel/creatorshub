"use server";

import mongoose from "mongoose";
import { requireUser } from "../auth/session";
import { connectDB } from "../db";
import { CollaborationModel, PaymentModel } from "../models";
import { logActivity, oid, recomputeReceived, revalidateApp, serverError, validationError } from "../util";
import { paymentInput } from "@/lib/validation";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/lib/types";

async function ctx() {
  const user = await requireUser();
  await connectDB();
  return { user, userId: new mongoose.Types.ObjectId(user.id) };
}

async function afterPaymentChange(
  userId: mongoose.Types.ObjectId,
  collaborationId: mongoose.Types.ObjectId,
  message: string,
) {
  const received = await recomputeReceived(userId, collaborationId);
  const collab = await CollaborationModel.findOne({ _id: collaborationId, userId }, { amountMinor: 1, currency: 1 }).lean();
  let suffix = "";
  if (collab && collab.amountMinor > 0) {
    const left = collab.amountMinor - received;
    suffix = left <= 0 ? " · Fully paid" : ` · ${formatMoney(left, collab.currency)} outstanding`;
  }
  await logActivity(userId, collaborationId, "payment", message + suffix);
  revalidateApp();
}

export async function recordPayment(raw: unknown): Promise<ActionResult> {
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const collaborationId = oid(parsed.data.collaborationId);
    const collab = collaborationId
      ? await CollaborationModel.findOne({ _id: collaborationId, userId }, { currency: 1 }).lean()
      : null;
    if (!collab || !collaborationId) return { ok: false, error: "Collaboration not found." };
    const { amount, collaborationId: _ignored, ...rest } = parsed.data;
    // A payment always uses its collaboration's currency so totals never mix currencies.
    await PaymentModel.create({ ...rest, userId, collaborationId, amountMinor: amount, currency: collab.currency });
    await afterPaymentChange(userId, collaborationId, `Payment received: ${formatMoney(amount, collab.currency)}`);
    return { ok: true };
  } catch (err) {
    return serverError(err, "recordPayment");
  }
}

export async function updatePayment(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = paymentInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    const payment = _id ? await PaymentModel.findOne({ _id, userId }) : null;
    if (!payment) return { ok: false, error: "Payment not found." };
    const { amount, collaborationId: _ignored, ...rest } = parsed.data;
    payment.set({ ...rest, amountMinor: amount });
    await payment.save();
    await afterPaymentChange(userId, payment.collaborationId, `Payment edited: ${formatMoney(amount, payment.currency)}`);
    return { ok: true };
  } catch (err) {
    return serverError(err, "updatePayment");
  }
}

export async function deletePayment(id: string): Promise<ActionResult> {
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    const payment = _id ? await PaymentModel.findOneAndDelete({ _id, userId }).lean() : null;
    if (!payment) return { ok: false, error: "Payment not found." };
    await afterPaymentChange(
      userId,
      payment.collaborationId,
      `Payment removed: ${formatMoney(payment.amountMinor, payment.currency)}`,
    );
    return { ok: true };
  } catch (err) {
    return serverError(err, "deletePayment");
  }
}
