/**
 * Calendar dates (deadlines, due dates) are stored as "YYYY-MM-DD" strings. They represent a day
 * on the user's calendar, independent of timezone, and compare correctly as strings.
 * "Today" is always computed in the user's configured timezone.
 */
export type DateOnly = string;

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !DATE_ONLY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function todayIn(timeZone: string, now: Date = new Date()): DateOnly {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function toUtc(d: DateOnly): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function fromUtc(dt: Date): DateOnly {
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: DateOnly, days: number): DateOnly {
  const dt = toUtc(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return fromUtc(dt);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: DateOnly, to: DateOnly): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function startOfMonth(d: DateOnly): DateOnly {
  return `${d.slice(0, 7)}-01`;
}

export function endOfMonth(d: DateOnly): DateOnly {
  const dt = toUtc(startOfMonth(d));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  dt.setUTCDate(0);
  return fromUtc(dt);
}

export function addMonths(d: DateOnly, months: number): DateOnly {
  const dt = toUtc(startOfMonth(d));
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return fromUtc(dt);
}

/** 0 = Monday ... 6 = Sunday */
export function weekdayMondayFirst(d: DateOnly): number {
  return (toUtc(d).getUTCDay() + 6) % 7;
}

/** Calendar grid (Monday-first) covering the month of `d`, always whole weeks. */
export function monthGrid(d: DateOnly): DateOnly[] {
  const first = startOfMonth(d);
  const last = endOfMonth(d);
  const start = addDays(first, -weekdayMondayFirst(first));
  const end = addDays(last, 6 - weekdayMondayFirst(last));
  const days: DateOnly[] = [];
  for (let cur = start; cur <= end; cur = addDays(cur, 1)) days.push(cur);
  return days;
}

export function formatDateOnly(
  d: DateOnly,
  style: "short" | "medium" | "long" | "weekday" | "month" = "medium",
): string {
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    short: { day: "numeric", month: "short" },
    medium: { day: "numeric", month: "short", year: "numeric" },
    long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
    weekday: { weekday: "short", day: "numeric", month: "short" },
    month: { month: "long", year: "numeric" },
  };
  return new Intl.DateTimeFormat("en-IN", { ...options[style], timeZone: "UTC" }).format(toUtc(d));
}

export function relativeDayLabel(d: DateOnly, today: DateOnly): string {
  const diff = diffDays(today, d);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff} days overdue`;
  if (diff < 7) return `In ${diff} days`;
  return formatDateOnly(d, "short");
}

export type Urgency = "overdue" | "today" | "soon" | "later";

export function urgencyOf(d: DateOnly | null | undefined, today: DateOnly, soonWindow = 3): Urgency {
  if (!d) return "later";
  const diff = diffDays(today, d);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= soonWindow) return "soon";
  return "later";
}

export function formatTimestamp(date: Date | string, timeZone: string, withTime = true): string {
  const dt = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : { year: "numeric" }),
  }).format(dt);
}

export function timeAgo(date: Date | string, now: Date = new Date()): string {
  const dt = typeof date === "string" ? new Date(date) : date;
  const secs = Math.round((now.getTime() - dt.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return dt.toISOString().slice(0, 10);
}
