"use server";

import mongoose from "mongoose";
import { requireUser } from "../auth/session";
import { connectDB } from "../db";
import {
  ActivityModel,
  BrandModel,
  CollaborationModel,
  PaymentModel,
  TaskModel,
  UserModel,
} from "../models";
import { escapeRegex, revalidateApp, serverError, validationError } from "../util";
import { settingsInput } from "@/lib/validation";
import { STATUS_META, type CollabStatus } from "@/lib/constants";
import type { ActionResult, SearchHit } from "@/lib/types";

export async function updateSettings(raw: unknown): Promise<ActionResult> {
  const parsed = settingsInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const me = await requireUser();
    await connectDB();
    const { name, ...settings } = parsed.data;
    await UserModel.updateOne({ _id: me.id }, { $set: { name, settings } });
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "updateSettings");
  }
}

/** Removes only records created by the optional seed script (flagged `isSample`). */
export async function clearSampleData(): Promise<ActionResult<{ removed: number }>> {
  try {
    const me = await requireUser();
    await connectDB();
    const userId = new mongoose.Types.ObjectId(me.id);
    const filter = { userId, isSample: true };
    const results = await Promise.all([
      CollaborationModel.deleteMany(filter),
      PaymentModel.deleteMany(filter),
      TaskModel.deleteMany(filter),
      ActivityModel.deleteMany(filter),
      BrandModel.deleteMany(filter),
    ]);
    revalidateApp();
    return { ok: true, data: { removed: results.reduce((n, r) => n + r.deletedCount, 0) } };
  } catch (err) {
    return serverError(err, "clearSampleData");
  }
}

export async function searchEverything(query: string): Promise<SearchHit[]> {
  const me = await requireUser();
  const q = String(query ?? "").trim().slice(0, 80);
  if (q.length < 1) return [];
  await connectDB();
  const userId = new mongoose.Types.ObjectId(me.id);
  const rx = { $regex: escapeRegex(q), $options: "i" };

  const [collabs, brands, tasks] = await Promise.all([
    CollaborationModel.find(
      {
        userId,
        $or: [
          { brandName: rx },
          { title: rx },
          { contactName: rx },
          { contactEmail: rx },
          { notes: rx },
          { description: rx },
          { invoiceNumber: rx },
        ],
      },
      { brandName: 1, title: 1, status: 1 },
    )
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean(),
    BrandModel.find({ userId, $or: [{ name: rx }, { contactName: rx }, { email: rx }] }, { name: 1, contactName: 1 })
      .limit(5)
      .lean(),
    TaskModel.find({ userId, title: rx }, { title: 1, done: 1, dueDate: 1 }).sort({ done: 1, dueDate: 1 }).limit(5).lean(),
  ]);

  return [
    ...collabs.map((c) => ({
      id: String(c._id),
      kind: "collaboration" as const,
      title: c.title,
      subtitle: `${c.brandName} · ${STATUS_META[c.status as CollabStatus]?.label ?? c.status}`,
      href: `/collaborations/${c._id}`,
    })),
    ...brands.map((b) => ({
      id: String(b._id),
      kind: "brand" as const,
      title: b.name,
      subtitle: b.contactName || "Brand",
      href: `/brands/${b._id}`,
    })),
    ...tasks.map((t) => ({
      id: String(t._id),
      kind: "task" as const,
      title: t.title,
      subtitle: t.done ? "Completed task" : t.dueDate ? `Task · due ${t.dueDate}` : "Task",
      href: "/tasks",
    })),
  ];
}
