"use server";

import mongoose from "mongoose";
import { requireUser } from "../auth/session";
import { connectDB } from "../db";
import { BrandModel, CollaborationModel } from "../models";
import { oid, revalidateApp, serverError, validationError } from "../util";
import { normalizeBrandKey } from "@/lib/automation";
import { brandInput } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

async function ctx() {
  const user = await requireUser();
  await connectDB();
  return { userId: new mongoose.Types.ObjectId(user.id) };
}

export async function createBrand(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = brandInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const nameKey = normalizeBrandKey(parsed.data.name);
    const existing = await BrandModel.findOne({ userId, nameKey }, { _id: 1 }).lean();
    if (existing) return { ok: false, error: "This brand already exists.", duplicateId: String(existing._id) };
    const brand = await BrandModel.create({ ...parsed.data, nameKey, userId });
    revalidateApp();
    return { ok: true, data: { id: String(brand._id) } };
  } catch (err) {
    return serverError(err, "createBrand");
  }
}

export async function updateBrand(id: string, raw: unknown): Promise<ActionResult> {
  const parsed = brandInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    const brand = _id ? await BrandModel.findOne({ _id, userId }) : null;
    if (!brand || !_id) return { ok: false, error: "Brand not found." };
    const nameKey = normalizeBrandKey(parsed.data.name);
    if (nameKey !== brand.nameKey) {
      const clash = await BrandModel.exists({ userId, nameKey, _id: { $ne: _id } });
      if (clash) return { ok: false, error: "Another brand already uses this name." };
    }
    const renamed = brand.name !== parsed.data.name;
    brand.set({ ...parsed.data, nameKey });
    await brand.save();
    if (renamed) {
      await CollaborationModel.updateMany({ userId, brandId: _id }, { $set: { brandName: parsed.data.name } });
    }
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "updateBrand");
  }
}

/** Deleting a brand keeps its collaborations (they retain the brand name) but unlinks them. */
export async function deleteBrand(id: string): Promise<ActionResult> {
  try {
    const { userId } = await ctx();
    const _id = oid(id);
    if (!_id) return { ok: false, error: "Brand not found." };
    const res = await BrandModel.deleteOne({ _id, userId });
    if (res.deletedCount === 0) return { ok: false, error: "Brand not found." };
    await CollaborationModel.updateMany({ userId, brandId: _id }, { $set: { brandId: null } });
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return serverError(err, "deleteBrand");
  }
}
