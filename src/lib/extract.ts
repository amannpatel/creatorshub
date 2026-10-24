/**
 * Deterministic (rule-based, non-AI) extraction of collaboration details from a pasted email,
 * DM or chat. It recognises common patterns; anything it misses is left blank for review.
 */
import type { CollabType, Platform, Source } from "./constants";
import { addDays, diffDays, isDateOnly, type DateOnly } from "./dates";
import { parseAmountToMinor } from "./money";

export interface ExtractedDeliverable {
  title: string;
  platform: Platform | null;
}

export interface ExtractionResult {
  brandName: string | null;
  title: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  platforms: Platform[];
  deliverables: ExtractedDeliverable[];
  amountMinor: number | null;
  currency: string | null;
  /** True when an amount was found but no currency symbol/code was present. */
  currencyAssumed: boolean;
  type: CollabType | null;
  source: Source | null;
  responseDeadline: DateOnly | null;
  startDate: DateOnly | null;
  submissionDeadline: DateOnly | null;
  publishDate: DateOnly | null;
  paymentDueDate: DateOnly | null;
  actions: string[];
  links: string[];
}

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|me|aol|proton|protonmail|zoho|rediffmail|gmx|mail)\./i;

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, single: 1, couple: 2 };

const STOP_BRAND = new Set([
  "the", "our", "your", "my", "a", "an", "team", "you", "us", "we", "this", "that", "hi", "hello", "dear",
  "regards", "thanks", "instagram", "youtube", "linkedin", "whatsapp", "email", "india", "today",
]);

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function makeDate(y: number, m: number, d: number): DateOnly | null {
  const s = `${y}-${pad(m)}-${pad(d)}`;
  return isDateOnly(s) ? s : null;
}

/** Infers the year for "15 Nov": this year, unless that is well in the past. */
function withInferredYear(m: number, d: number, today: DateOnly): DateOnly | null {
  const year = Number(today.slice(0, 4));
  const candidate = makeDate(year, m, d);
  if (!candidate) return null;
  return diffDays(today, candidate) < -60 ? makeDate(year + 1, m, d) : candidate;
}

interface FoundDate {
  date: DateOnly;
  index: number;
}

export function findDates(text: string, today: DateOnly): FoundDate[] {
  const found: FoundDate[] = [];
  const add = (date: DateOnly | null, index: number) => {
    if (date) found.push({ date, index });
  };
  let m: RegExpExecArray | null;

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
  while ((m = iso.exec(text))) add(makeDate(+m[1], +m[2], +m[3]), m.index);

  // Day-first numeric dates (common in India): 15/11/2026, 15-11-26, 15.11
  const numeric = /\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g;
  while ((m = numeric.exec(text))) {
    if (/\d{4}-$/.test(text.slice(Math.max(0, m.index - 5), m.index))) continue;
    const d = +m[1];
    const mo = +m[2];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    if (!m[3] && !/[/]/.test(m[0])) continue; // avoid "1.5" style numbers
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null;
    add(y ? makeDate(y, mo, d) : withInferredYear(mo, d, today), m.index);
  }

  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?,?(?:\\s+(\\d{4}))?\\b`, "gi");
  while ((m = dayMonth.exec(text))) {
    const mo = MONTHS[m[2].toLowerCase()];
    add(m[3] ? makeDate(+m[3], mo, +m[1]) : withInferredYear(mo, +m[1], today), m.index);
  }

  const monthDay = new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "gi");
  while ((m = monthDay.exec(text))) {
    const mo = MONTHS[m[1].toLowerCase()];
    add(m[3] ? makeDate(+m[3], mo, +m[2]) : withInferredYear(mo, +m[2], today), m.index);
  }

  const relative = /\b(today|tonight|tomorrow|day after tomorrow|next week|end of (?:the )?week|end of (?:the )?month|in (\d{1,2}) days?|within (\d{1,2}) days?)\b/gi;
  while ((m = relative.exec(text))) {
    const word = m[1].toLowerCase();
    // "payment within 30 days" describes payment terms, handled separately.
    if (word.startsWith("within") && /pay|invoice|credit|net/i.test(text.slice(Math.max(0, m.index - 40), m.index))) continue;
    let date: DateOnly | null = null;
    if (word === "today" || word === "tonight") date = today;
    else if (word === "tomorrow") date = addDays(today, 1);
    else if (word === "day after tomorrow") date = addDays(today, 2);
    else if (word === "next week") date = addDays(today, 7);
    else if (word.startsWith("end of") && word.includes("week")) {
      const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      date = addDays(today, 6 - dow);
    } else if (word.startsWith("end of")) {
      const [y, mo] = today.split("-").map(Number);
      date = makeDate(mo === 12 ? y + 1 : y, mo === 12 ? 1 : mo + 1, 1);
      date = date ? addDays(date, -1) : null;
    } else if (m[2] || m[3]) date = addDays(today, +(m[2] ?? m[3]));
    add(date, m.index);
  }

  const weekday = new RegExp(`\\b(?:by|on|this|next|before|till|until)\\s+(?:this\\s+|next\\s+)?(${WEEKDAYS.join("|")})\\b`, "gi");
  while ((m = weekday.exec(text))) {
    const target = WEEKDAYS.indexOf(m[1].toLowerCase());
    const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
    let delta = (target - dow + 7) % 7;
    if (delta === 0) delta = 7;
    add(addDays(today, delta), m.index);
  }

  // Keep one entry per position (overlapping patterns), first match wins.
  const seen = new Set<number>();
  return found
    .sort((a, b) => a.index - b.index)
    .filter((f) => {
      for (let i = f.index - 3; i <= f.index + 3; i++) if (seen.has(i)) return false;
      seen.add(f.index);
      return true;
    });
}

type DateRole = "responseDeadline" | "startDate" | "submissionDeadline" | "publishDate" | "paymentDueDate";

const ROLE_PATTERNS: [DateRole, RegExp][] = [
  ["paymentDueDate", /\b(payment|paid|pay out|payout|invoice|remittance|transfer)\b/i],
  ["publishDate", /\b(go(?:es)? live|live on|publish|post(?:ed|ing)? (?:on|by)|launch|upload(?:ed)? (?:on|by)|release)\b/i],
  ["submissionDeadline", /\b(submit|submission|draft|deliver|share (?:the )?(?:content|draft|video|reel)|send (?:the |us )?(?:content|draft|video)|script|first cut|deadline)\b/i],
  ["responseDeadline", /\b(reply|respond|response|revert|let (?:us|me) know|confirm|get back|interested|availability)\b/i],
  ["startDate", /\b(start|kick ?off|begin|commence|campaign runs? from)\b/i],
];

function classifyDate(text: string, index: number): DateRole | null {
  const sentenceStart = Math.max(
    text.lastIndexOf(".", index - 1),
    text.lastIndexOf("\n", index - 1),
    text.lastIndexOf("!", index - 1),
    text.lastIndexOf("?", index - 1),
  );
  const before = text.slice(Math.max(sentenceStart + 1, index - 80), index);
  for (const [role, re] of ROLE_PATTERNS) if (re.test(before)) return role;
  return null;
}

interface FoundAmount {
  minor: number;
  currency: string | null;
  index: number;
  hinted: boolean;
}

function multiplier(suffix: string | undefined): number {
  if (!suffix) return 1;
  const s = suffix.toLowerCase();
  if (s === "k") return 1_000;
  if (s.startsWith("l")) return 100_000;
  if (s === "cr" || s.startsWith("crore")) return 10_000_000;
  if (s === "m" || s === "mn" || s.startsWith("million")) return 1_000_000;
  return 1;
}

const CURRENCY_TOKENS: Record<string, string> = {
  "₹": "INR", rs: "INR", "rs.": "INR", inr: "INR", rupees: "INR",
  $: "USD", usd: "USD", "us$": "USD", "€": "EUR", eur: "EUR", "£": "GBP", gbp: "GBP", aed: "AED",
};

export function findAmounts(text: string): FoundAmount[] {
  const out: FoundAmount[] = [];
  const num = "(\\d{1,3}(?:,\\d{2,3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)";
  const suffix = "\\s*(k|K|lakhs?|lacs?|L|cr|crores?|mn|million|M)?\\b";
  const prefixed = new RegExp(`(₹|rs\\.?|inr|us\\$|\\$|usd|€|eur|£|gbp|aed)\\s*${num}${suffix}`, "gi");
  const postfixed = new RegExp(`\\b${num}${suffix}\\s*(inr|rupees|usd|eur|gbp|aed|/-)`, "gi");
  const hinted = new RegExp(`\\b(budget|fee|compensation|pay(?:ing|out)?|offer(?:ing)?|amount|honorarium|remuneration|commercials?)\\b[^\\d\\n]{0,25}${num}${suffix}`, "gi");
  let m: RegExpExecArray | null;
  const ctxHint = (i: number) => /budget|fee|compensation|pay|offer|amount|honorarium|remuneration|commercial/i.test(text.slice(Math.max(0, i - 60), i));

  while ((m = prefixed.exec(text))) {
    const base = parseAmountToMinor(m[2]);
    if (base === null) continue;
    out.push({ minor: base * multiplier(m[3]), currency: CURRENCY_TOKENS[m[1].toLowerCase()] ?? "INR", index: m.index, hinted: ctxHint(m.index) });
  }
  while ((m = postfixed.exec(text))) {
    const base = parseAmountToMinor(m[1]);
    if (base === null) continue;
    const token = m[3].toLowerCase();
    out.push({ minor: base * multiplier(m[2]), currency: token === "/-" ? "INR" : CURRENCY_TOKENS[token] ?? null, index: m.index, hinted: ctxHint(m.index) });
  }
  while ((m = hinted.exec(text))) {
    const start = m.index + m[0].length;
    if (out.some((a) => Math.abs(a.index - (start - 20)) < 30)) continue;
    const base = parseAmountToMinor(m[2]);
    if (base === null) continue;
    const total = base * multiplier(m[3]);
    if (total < 100_00) continue; // ignore tiny numbers like "fee for 2 reels"
    out.push({ minor: total, currency: null, index: m.index, hinted: true });
  }
  return out.filter((a) => a.minor > 0);
}

const DELIVERABLE_RE =
  /\b(\d{1,2}|a|an|one|two|three|four|five|six|single|couple of)?\s*(?:x\s*)?(dedicated\s+)?(instagram|insta|ig|youtube|yt|linkedin|tiktok|facebook|fb)?\s*(reels?|stor(?:y|ies)|static posts?|carousel(?: posts?)?|posts?|shorts?|integrations?|videos?|vlogs?|tweets?|threads?|live sessions?|lives?|blog posts?|articles?|unboxing(?: videos?)?|reviews?)\b/gi;

function platformFromWord(word: string | undefined): Platform | null {
  if (!word) return null;
  const w = word.toLowerCase();
  if (["instagram", "insta", "ig"].includes(w)) return "instagram";
  if (["youtube", "yt"].includes(w)) return "youtube";
  if (w === "linkedin") return "linkedin";
  if (w === "tiktok") return "tiktok";
  if (["facebook", "fb"].includes(w)) return "facebook";
  return null;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function findDeliverables(text: string, platforms: Platform[]): ExtractedDeliverable[] {
  const results = new Map<string, ExtractedDeliverable>();
  let m: RegExpExecArray | null;
  while ((m = DELIVERABLE_RE.exec(text))) {
    const countWord = m[1]?.toLowerCase();
    const kindRaw = m[4].toLowerCase();
    const hasExplicitContext = countWord || m[3] || m[2];
    // Avoid generic words ("post", "video", "review") without a count or platform in front.
    if (!hasExplicitContext && /^(posts?|videos?|reviews?|lives?|threads?|articles?)$/.test(kindRaw)) continue;
    const count = countWord ? (NUMBER_WORDS[countWord] ?? (countWord === "couple of" ? 2 : Number(countWord))) : 1;
    if (!Number.isFinite(count) || count < 1 || count > 20) continue;

    let platform = platformFromWord(m[3]);
    if (!platform) {
      if (/reel|stor|carousel/.test(kindRaw)) platform = "instagram";
      else if (/short|integration|vlog/.test(kindRaw)) platform = "youtube";
      else if (/tweet/.test(kindRaw)) platform = "x";
      else if (/blog|article/.test(kindRaw)) platform = "blog";
      else if (platforms.length === 1) platform = platforms[0];
    }
    let kind = kindRaw.replace(/s$/, "").replace(/stories|story/, "story");
    if (kind === "storie") kind = "story";
    const singular = titleCase(`${m[2] ? "dedicated " : ""}${kind}`);
    const plural = count > 1 ? (singular.endsWith("y") ? `${singular.slice(0, -1)}ies` : `${singular}s`) : singular;
    const platformLabel = platform === "instagram" ? "Instagram " : platform === "youtube" ? "YouTube " : platform === "linkedin" ? "LinkedIn " : "";
    const key = `${platform}:${kind}`;
    if (!results.has(key)) results.set(key, { title: `${count} ${platformLabel}${plural}`.trim(), platform });
  }
  return [...results.values()];
}

function findPlatforms(text: string): Platform[] {
  const set = new Set<Platform>();
  if (/\b(instagram|insta|ig|reels?|stories)\b/i.test(text)) set.add("instagram");
  if (/\b(youtube|yt|shorts|youtube integration)\b/i.test(text)) set.add("youtube");
  if (/\blinkedin\b/i.test(text)) set.add("linkedin");
  if (/\b(twitter|tweets?|x\.com)\b/i.test(text)) set.add("x");
  if (/\btiktok\b/i.test(text)) set.add("tiktok");
  if (/\bfacebook\b/i.test(text)) set.add("facebook");
  if (/\bpodcast\b/i.test(text)) set.add("podcast");
  if (/\bblog\b/i.test(text)) set.add("blog");
  return [...set];
}

function cleanBrand(raw: string): string | null {
  const words = raw
    .trim()
    .replace(/[.,:;!?'"]+$/, "")
    .split(/\s+/)
    .filter(Boolean);
  while (words.length && STOP_BRAND.has(words[0].toLowerCase())) words.shift();
  while (words.length && STOP_BRAND.has(words[words.length - 1].toLowerCase())) words.pop();
  const name = words.join(" ").trim();
  if (name.length < 2 || name.length > 60) return null;
  return name;
}

function brandFromDomain(email: string | null): string | null {
  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || FREE_MAIL.test(domain)) return null;
  const parts = domain.split(".");
  const root = parts.length > 2 && ["co", "com", "org", "net"].includes(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];
  if (!root) return null;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function findBrand(text: string, email: string | null): string | null {
  const cap = "([A-Z][\\w&'’-]*(?:\\s+(?:&\\s+)?[A-Z][\\w&'’-]*){0,3})";
  const patterns = [
    new RegExp(`\\b(?:on behalf of|representing|brand partnerships? (?:at|for)|marketing (?:team )?(?:at|for)|reaching out from)\\s+${cap}`),
    new RegExp(`\\b(?:I am|I'm|this is)\\s+[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?\\s*(?:,\\s*[\\w\\s]+?\\s*)?(?:from|at|with)\\s+${cap}`),
    new RegExp(`\\b(?:team|here)\\s+(?:at|from)\\s+${cap}`),
    new RegExp(`\\b(?:collaborat(?:e|ion) with|partner(?:ship)? with|campaign for|launch of)\\s+${cap}`),
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const b = cleanBrand(m[1]);
      if (b) return b;
    }
  }
  return brandFromDomain(email);
}

function findContactName(text: string): string | null {
  const from = /^from:\s*"?([^"<\n@]+?)"?\s*</im.exec(text);
  if (from) return from[1].trim();
  const intro = /\b(?:I am|I'm|my name is|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/.exec(text);
  if (intro && !STOP_BRAND.has(intro[1].toLowerCase())) return intro[1];
  const sig = /\n\s*(?:best regards|kind regards|warm regards|regards|best|thanks|thank you|cheers|sincerely)[,!.]?\s*\n+\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:\n|$)/i.exec(text);
  if (sig) return sig[1];
  return null;
}

function findType(text: string, hasAmount: boolean): CollabType | null {
  if (/\b(affiliate|commission|referral code|discount code|per sale)\b/i.test(text)) return "affiliate";
  if (/\bbarter\b|in exchange for (?:the )?products?|product exchange/i.test(text)) return "barter";
  if (/\b(gifted|gifting|pr package|pr box|complimentary|send you (?:our|some) products?)\b/i.test(text) && !hasAmount) return "gifted";
  if (hasAmount || /\b(paid collaboration|paid partnership|budget|fee|compensation)\b/i.test(text)) return "paid";
  return null;
}

function findSource(text: string): Source | null {
  if (/^(from|subject|to):/im.test(text) || /@\w+\.\w+/.test(text.slice(0, 200))) return "email";
  if (/whatsapp|^\[\d{1,2}:\d{2}/im.test(text) || /^\d{1,2}\/\d{1,2}\/\d{2,4},? \d{1,2}:\d{2}/m.test(text)) return "whatsapp";
  if (/\b(dm|direct message|instagram dm)\b/i.test(text)) return "instagram_dm";
  return null;
}

function findActions(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim());
  const actions: string[] = [];
  for (const s of sentences) {
    if (/^(please|kindly|could you|can you|would you|let (?:us|me) know|share|send|confirm)\b/i.test(s) || /\b(please|kindly)\b/i.test(s)) {
      const trimmed = s.length > 160 ? `${s.slice(0, 157)}…` : s;
      if (!actions.includes(trimmed)) actions.push(trimmed);
    }
    if (actions.length >= 5) break;
  }
  return actions;
}

function findTitle(text: string, brand: string | null, deliverables: ExtractedDeliverable[]): string | null {
  const subject = /^subject:\s*(.+)$/im.exec(text);
  if (subject) {
    const s = subject[1].replace(/^((re|fwd?|fw)\s*:\s*)+/i, "").trim();
    if (s) return s.slice(0, 120);
  }
  const campaign = /\b(?:campaign|launch)\s+(?:called|named|titled)?\s*["“']([^"”']{3,60})["”']/i.exec(text) ||
    /\bfor (?:our|the|their)\s+([\w\s&'-]{3,40}?)\s+campaign\b/i.exec(text);
  if (campaign) return `${titleCase(campaign[1].trim())} campaign`;
  if (brand && deliverables.length) return `${brand} — ${deliverables.map((d) => d.title).join(", ")}`.slice(0, 120);
  if (brand) return `${brand} collaboration`;
  return null;
}

export function extractCollaboration(rawText: string, today: DateOnly, defaultCurrency = "INR"): ExtractionResult {
  const text = rawText.replace(/\r\n/g, "\n").slice(0, 20_000);

  const emails = [...text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)].map((m) => m[0].toLowerCase());
  const businessEmail = emails.find((e) => !FREE_MAIL.test(e.split("@")[1] ?? "")) ?? emails[0] ?? null;
  const phone = /(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,11}\d/.exec(text.replace(/\d{4}-\d{2}-\d{2}/g, ""));
  const phoneDigits = phone ? phone[0].replace(/[^\d+]/g, "") : null;
  const contactPhone = phoneDigits && phoneDigits.replace(/\D/g, "").length >= 10 ? phone![0].trim() : null;

  const platforms = findPlatforms(text);
  const deliverables = findDeliverables(text, platforms);
  for (const d of deliverables) if (d.platform && !platforms.includes(d.platform)) platforms.push(d.platform);

  const amounts = findAmounts(text);
  const best = amounts.find((a) => a.hinted && a.currency) ?? amounts.find((a) => a.currency) ?? amounts.find((a) => a.hinted) ?? null;

  const result: ExtractionResult = {
    brandName: findBrand(text, businessEmail),
    title: null,
    contactName: findContactName(text),
    contactEmail: businessEmail,
    contactPhone,
    platforms,
    deliverables,
    amountMinor: best?.minor ?? null,
    currency: best ? (best.currency ?? defaultCurrency) : null,
    currencyAssumed: !!best && !best.currency,
    type: findType(text, !!best),
    source: findSource(text),
    responseDeadline: null,
    startDate: null,
    submissionDeadline: null,
    publishDate: null,
    paymentDueDate: null,
    actions: findActions(text),
    links: [...new Set([...text.matchAll(/https?:\/\/[^\s<>"')]+/g)].map((m) => m[0].replace(/[.,]+$/, "")))].slice(0, 5),
  };
  result.title = findTitle(text, result.brandName, deliverables);

  const unassigned: DateOnly[] = [];
  for (const f of findDates(text, today)) {
    const role = classifyDate(text, f.index);
    if (role && !result[role]) result[role] = f.date;
    else if (!role) unassigned.push(f.date);
  }
  if (!result.submissionDeadline) {
    const next = unassigned.find((d) => d >= today);
    if (next) result.submissionDeadline = next;
  }

  const terms = /\b(?:payment|invoice|paid)\b[^.\n]{0,40}?\b(?:within|in|net)\s*(\d{1,3})\s*(?:working\s+|business\s+)?days?/i.exec(text) ||
    /\bnet[\s-]?(\d{1,3})\b/i.exec(text);
  if (terms && !result.paymentDueDate) {
    const base = result.publishDate ?? result.submissionDeadline;
    if (base) result.paymentDueDate = addDays(base, Number(terms[1]));
  }
  return result;
}
