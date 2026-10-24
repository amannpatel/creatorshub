"use server";

import mongoose from "mongoose";
import { requireUser } from "../auth/session";
import { connectDB } from "../db";
import { CollaborationModel, TaskModel } from "../models";
import { logActivity, oid, revalidateApp, serverError, validationError } from "../util";
import { taskInput } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

async function ctx() {
  const user = await requireUser();
  await connectDB();
  return { user, userId: new mongoose.Types.ObjectId(user.id) };
}

async function ownedCollabId(userId: mongoose.Types.ObjectId, id: string | null) {
  const _id = oid(id);
  if (!_id) return null;
  const exists = await CollaborationModel.exists({ _id, userId });
  return exists ? _id : null;
}

export async function createTask(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = taskInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const collaborationId = await ownedCollabId(userId, parsed.data.collaborationId);
    const task = await TaskModel.create({ ...parsed.data, collaborationId, userId });
    if (collaborationId) await logActivity(userId, collaborationId, "task", `Task added: ${task.title}`);
    revalidateApp();
    return { ok: true, data: { id: String(task._id) } };
  } catch (err) {
    return serverError(err, "createTask");
  }
}

export async function updateTask(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = taskInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    if (!_id) return { ok: false, error: "Task not found." };
    const collaborationId = await ownedCollabId(userId, parsed.data.collaborationId);
    const res = await TaskModel.updateOne({ _id, userId }, { $set: { ...parsed.data, collaborationId } });
    if (res.matchedCount === 0) return { ok: false, error: "Task not found." };
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "updateTask");
  }
}

export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    if (!_id) return { ok: false, error: "Task not found." };
    const task = await TaskModel.findOneAndUpdate(
      { _id, userId },
      { $set: { done: !!done, completedAt: done ? new Date() : null } },
      { returnDocument: "after" },
    ).lean();
    if (!task) return { ok: false, error: "Task not found." };
    if (done && task.collaborationId) {
      await logActivity(userId, task.collaborationId, "task", `Completed: ${task.title}`);
    }
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "toggleTask");
  }
}

export async function deleteTask(id: string): Promise<ActionResult> {
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    if (!_id) return { ok: false, error: "Task not found." };
    await TaskModel.deleteOne({ _id, userId });
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "deleteTask");
  }
}
