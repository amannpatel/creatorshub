import type { Tone } from "./constants";

/** Full class strings so Tailwind can detect them. */
export const TONE_BADGE: Record<Tone, string> = {
  violet: "bg-violet-500/12 text-violet-700 dark:text-violet-300 ring-violet-500/20",
  sky: "bg-sky-500/12 text-sky-700 dark:text-sky-300 ring-sky-500/20",
  amber: "bg-amber-500/14 text-amber-800 dark:text-amber-300 ring-amber-500/25",
  emerald: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20",
  blue: "bg-blue-500/12 text-blue-700 dark:text-blue-300 ring-blue-500/20",
  orange: "bg-orange-500/12 text-orange-700 dark:text-orange-300 ring-orange-500/20",
  green: "bg-green-500/12 text-green-700 dark:text-green-300 ring-green-500/20",
  zinc: "bg-zinc-500/12 text-zinc-700 dark:text-zinc-300 ring-zinc-500/20",
  red: "bg-red-500/12 text-red-700 dark:text-red-300 ring-red-500/25",
  pink: "bg-pink-500/12 text-pink-700 dark:text-pink-300 ring-pink-500/20",
};

export const TONE_DOT: Record<Tone, string> = {
  violet: "bg-violet-500",
  sky: "bg-sky-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  orange: "bg-orange-500",
  green: "bg-green-500",
  zinc: "bg-zinc-400",
  red: "bg-red-500",
  pink: "bg-pink-500",
};

export const URGENCY_TONE = {
  overdue: "red",
  today: "orange",
  soon: "amber",
  later: "zinc",
} as const satisfies Record<string, Tone>;
