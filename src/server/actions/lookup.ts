"use server";

import mongoose from "mongoose";
import { requireUser } from "../auth/session";
import { connectDB } from "../db";
import { BrandModel, CollaborationModel } from "../models";
import { STATUS_META, type CollabStatus } from "@/lib/constants";
import type { CollabOption } from "@/lib/types";

/** Options for "related collaboration" pickers in task/payment dialogs. */
export async function listCollabOptions(): Promise<CollabOption[]> {
  const user = await requireUser();
  await connectDB();
  const docs = await CollaborationModel.find(
    { userId: new mongoose.Types.ObjectId(user.id) },
    { brandName: 1, title: 1, status: 1, currency: 1, amountMinor: 1, receivedMinor: 1 },
  )
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean();
  return docs.map((d) => ({
    id: String(d._id),
    label: `${d.brandName} — ${d.title}`,
    status: STATUS_META[d.status as CollabStatus]?.label ?? d.status,
    currency: d.currency ?? "INR",
    outstandingMinor: Math.max(0, (d.amountMinor ?? 0) - (d.receivedMinor ?? 0)),
  }));
}

export async function listBrandNames(): Promise<string[]> {
  const user = await requireUser();
  await connectDB();
  const docs = await BrandModel.find({ userId: new mongoose.Types.ObjectId(user.id) }, { name: 1 })
    .sort({ updatedAt: -1 })
    .limit(500)
    .lean();
  return docs.map((d) => d.name);
}
