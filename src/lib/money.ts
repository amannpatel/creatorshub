export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const DEFAULT_CURRENCY: Currency = "INR";

/** All supported currencies use 2 minor digits (paise, cents...). */
const MINOR_DIGITS = 2;

export function isCurrency(value: unknown): value is Currency {
  return typeof value === "string" && (CURRENCIES as readonly string[]).includes(value);
}

/**
 * Parses a user-entered amount ("25,000", "1500.5", "₹ 2,000.75") into integer minor units
 * without going through floating point arithmetic. Returns null for invalid input.
 */
export function parseAmountToMinor(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const raw = typeof input === "number" ? input.toString() : input;
  const cleaned = raw.replace(/[₹$€£,\s]/g, "").replace(/^(INR|USD|EUR|GBP|AED|SGD|AUD|CAD|Rs\.?)/i, "");
  if (cleaned === "") return null;
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(MINOR_DIGITS, "0");
  const minor = whole * 10 ** MINOR_DIGITS + Number(fraction || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

export function minorToInputString(minor: number | null | undefined): string {
  if (!minor) return "";
  const whole = Math.trunc(minor / 100);
  const fraction = Math.abs(minor % 100);
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}

export function formatMoney(
  minor: number,
  currency: string = DEFAULT_CURRENCY,
  opts: { compact?: boolean } = {},
): string {
  const value = minor / 10 ** MINOR_DIGITS;
  const locale = currency === "INR" ? "en-IN" : "en-US";
  const hasFraction = minor % 100 !== 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      minimumFractionDigits: opts.compact || !hasFraction ? 0 : 2,
      maximumFractionDigits: opts.compact ? 1 : hasFraction ? 2 : 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

/** Sums of money grouped by currency, so different currencies are never mixed. */
export type MoneyByCurrency = Record<string, number>;

export function addTo(map: MoneyByCurrency, currency: string, minor: number) {
  if (!minor) return;
  map[currency] = (map[currency] ?? 0) + minor;
}

/** Returns entries with the preferred currency first. */
export function moneyEntries(map: MoneyByCurrency, preferred: string): [string, number][] {
  return Object.entries(map)
    .filter(([, v]) => v !== 0)
    .sort(([a], [b]) => (a === preferred ? -1 : b === preferred ? 1 : a.localeCompare(b)));
}
