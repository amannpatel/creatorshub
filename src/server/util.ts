import "server-only";
import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActivityModel, BrandModel, CollaborationModel, PaymentModel } from "./models";
import { normalizeBrandKey } from "@/lib/automation";
import type { ActionResult, ActivityKind } from "@/lib/types";

export function oid(id: string | null | undefined): mongoose.Types.ObjectId | null {
  return id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function validationError(error: z.ZodError): ActionResult<never> {
  const flat = z.flattenError(error);
  const first = error.issues[0];
  return {
    ok: false,
    error: first ? `${first.path.length ? `${first.path.join(".")}: ` : ""}${first.message}` : "Invalid input",
    fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
  };
}

export function serverError(err: unknown, context: string): ActionResult<never> {
  // Log only the error type/message — never request payloads, which may hold financial data.
  console.error(`[${context}]`, err instanceof Error ? `${err.name}: ${err.message}` : "Unknown error");
  return { ok: false, error: "Something went wrong. Please try again." };
}

export function revalidateApp() {
  revalidatePath("/", "layout");
}

export async function logActivity(
  userId: mongoose.Types.ObjectId,
  collaborationId: mongoose.Types.ObjectId | null,
  kind: ActivityKind,
  message: string,
) {
  await ActivityModel.create({ userId, collaborationId, kind, message: message.slice(0, 2000) });
}

/** Finds the user's brand by normalised name, creating it if needed. */
export async function ensureBrand(
  userId: mongoose.Types.ObjectId,
  name: string,
  contact: { contactName?: string; email?: string; phone?: string } = {},
): Promise<mongoose.Types.ObjectId> {
  const nameKey = normalizeBrandKey(name);
  const brand = await BrandModel.findOneAndUpdate(
    { userId, nameKey },
    {
      $setOnInsert: {
        userId,
        nameKey,
        name: name.trim(),
        contactName: contact.contactName ?? "",
        email: contact.email ?? "",
        phone: contact.phone ?? "",
      },
    },
    { upsert: true, returnDocument: "after", projection: { _id: 1 } },
  ).lean();
  return brand!._id as mongoose.Types.ObjectId;
}

/** Received amount is always recomputed from the payment records (never incremented blindly). */
export async function recomputeReceived(
  userId: mongoose.Types.ObjectId,
  collaborationId: mongoose.Types.ObjectId,
): Promise<number> {
  const [agg] = await PaymentModel.aggregate<{ total: number }>([
    { $match: { userId, collaborationId } },
    { $group: { _id: null, total: { $sum: "$amountMinor" } } },
  ]);
  const total = agg?.total ?? 0;
  await CollaborationModel.updateOne({ _id: collaborationId, userId }, { $set: { receivedMinor: total } });
  return total;
}
