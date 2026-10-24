import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "../db";
import { UserModel } from "../models";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from "./token";
import type { SessionUser } from "@/lib/types";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { DEFAULT_FOLLOW_UP_DAYS } from "@/lib/constants";

export async function createSession(userId: string, sessionVersion: number) {
  const token = await signSession({ userId, sessionVersion });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * Data Access Layer entry point: verifies the session cookie AND that the user still exists with a
 * matching session version. Memoised per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session || !mongoose.isValidObjectId(session.userId)) return null;
  await connectDB();
  const user = await UserModel.findById(session.userId).lean();
  if (!user || (user.sessionVersion ?? 0) !== session.sessionVersion) return null;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    settings: {
      timezone: user.settings?.timezone ?? DEFAULT_TIMEZONE,
      currency: user.settings?.currency ?? DEFAULT_CURRENCY,
      followUpDays: user.settings?.followUpDays ?? DEFAULT_FOLLOW_UP_DAYS,
      paymentTermsDays: user.settings?.paymentTermsDays ?? 30,
    },
  };
});

/** Use in pages and server actions. Redirects to /login when not authenticated. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
