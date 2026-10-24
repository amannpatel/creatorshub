"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { connectDB } from "../db";
import { LoginAttemptModel, UserModel } from "../models";
import { createSession, deleteSession, requireUser } from "../auth/session";
import { signupsExplicitlyAllowed } from "../env";
import { serverError, validationError } from "../util";
import { changePasswordInput, loginInput, signupInput } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

const BCRYPT_COST = 12;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Used to keep timing similar when the email doesn't exist.
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5mY0m6x7xX9C1Yb3tG0d0FQnqv6m5uK";

export async function canSignUp(): Promise<boolean> {
  if (signupsExplicitlyAllowed()) return true;
  await connectDB();
  return (await UserModel.estimatedDocumentCount()) === 0;
}

export async function signup(raw: unknown): Promise<ActionResult> {
  const parsed = signupInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    if (!(await canSignUp())) {
      return { ok: false, error: "Sign-ups are closed. This workspace already has an owner." };
    }
    const { name, email, password } = parsed.data;
    const exists = await UserModel.exists({ email: email.toLowerCase() });
    if (exists) return { ok: false, error: "An account with this email already exists." };
    const user = await UserModel.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
    });
    await createSession(String(user._id), user.sessionVersion ?? 0);
    return { ok: true };
  } catch (err) {
    return serverError(err, "signup");
  }
}

export async function login(raw: unknown): Promise<ActionResult> {
  const parsed = loginInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const email = parsed.data.email.toLowerCase();
  const key = `login:${email}`;
  try {
    await connectDB();
    const attempt = await LoginAttemptModel.findOne({ key }).lean();
    if (attempt && attempt.count >= MAX_ATTEMPTS && attempt.expiresAt > new Date()) {
      return { ok: false, error: `Too many attempts. Try again in ${LOCK_MINUTES} minutes.` };
    }
    const user = await UserModel.findOne({ email }).lean();
    const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      await LoginAttemptModel.updateOne(
        { key },
        { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + LOCK_MINUTES * 60_000) } },
        { upsert: true },
      );
      return { ok: false, error: "Incorrect email or password." };
    }
    await LoginAttemptModel.deleteOne({ key });
    await createSession(String(user._id), user.sessionVersion ?? 0);
    return { ok: true };
  } catch (err) {
    return serverError(err, "login");
  }
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function changePassword(raw: unknown): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = changePasswordInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const user = await UserModel.findById(me.id);
    if (!user || !(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash))) {
      return { ok: false, error: "Current password is incorrect." };
    }
    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_COST);
    user.sessionVersion = (user.sessionVersion ?? 0) + 1; // signs out other devices
    await user.save();
    await createSession(String(user._id), user.sessionVersion);
    return { ok: true };
  } catch (err) {
    return serverError(err, "changePassword");
  }
}
