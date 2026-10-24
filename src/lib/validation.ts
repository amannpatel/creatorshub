import { z } from "zod";
import {
  COLLAB_STATUSES,
  COLLAB_TYPES,
  DELIVERABLE_STATUSES,
  PAYMENT_METHODS,
  PLATFORMS,
  SOURCES,
  TASK_PRIORITIES,
} from "./constants";
import { isDateOnly, isValidTimeZone } from "./dates";
import { CURRENCIES, parseAmountToMinor } from "./money";

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

export const dateOnlyField = z.preprocess(
  emptyToNull,
  z.string().refine(isDateOnly, "Invalid date").nullable(),
);

export const requiredDateField = z.string().refine(isDateOnly, "Pick a date");

/** Accepts "25,000.50" or 25000.5 and converts to integer minor units. */
export const amountField = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : parseAmountToMinor(v as string | number) ?? Number.NaN),
  z.number({ error: "Enter a valid amount" }).int().min(0).max(1_000_000_000_00, "Amount is too large"),
);

const text = (max: number) => z.string().trim().max(max).default("");

/** Only http(s) links are stored, which prevents `javascript:` URLs from ever being rendered. */
export const httpUrl = z
  .string()
  .trim()
  .max(1000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full link starting with https://");

const optionalHttpUrl = z.union([z.literal(""), httpUrl]).default("");
const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email").max(254)]).default("");

export const deliverableInput = z.object({
  id: z.string().max(40).optional(),
  title: z.string().trim().min(1, "Describe the deliverable").max(160),
  platform: z.preprocess(emptyToNull, z.enum(PLATFORMS).nullable()).default(null),
  dueDate: dateOnlyField.default(null),
  status: z.enum(DELIVERABLE_STATUSES).default("todo"),
  notes: text(2000),
});
export type DeliverableInput = z.input<typeof deliverableInput>;

const collabDates = {
  inquiryDate: dateOnlyField.default(null),
  responseDeadline: dateOnlyField.default(null),
  startDate: dateOnlyField.default(null),
  submissionDeadline: dateOnlyField.default(null),
  publishDate: dateOnlyField.default(null),
  paymentDueDate: dateOnlyField.default(null),
  followUpOn: dateOnlyField.default(null),
};

export const collabInput = z.object({
  brandName: z.string().trim().min(1, "Brand name is required").max(120),
  title: text(200),
  contactName: text(120),
  contactEmail: optionalEmail,
  contactPhone: text(40),
  platforms: z.array(z.enum(PLATFORMS)).max(PLATFORMS.length).default([]),
  type: z.enum(COLLAB_TYPES).default("paid"),
  source: z.enum(SOURCES).default("manual"),
  description: text(5000),
  notes: text(10000),
  links: z.array(z.object({ label: text(80), url: httpUrl })).max(20).default([]),
  status: z.enum(COLLAB_STATUSES).default("new_lead"),
  ...collabDates,
  deliverables: z.array(deliverableInput).max(30).default([]),
  currency: z.enum(CURRENCIES).default("INR"),
  amount: amountField.default(0),
  invoiceNumber: text(80),
  invoiceUrl: optionalHttpUrl,
  paymentNotes: text(2000),
});
export type CollabInput = z.input<typeof collabInput>;

export const createCollabInput = collabInput.extend({
  clientRequestId: z.string().min(8).max(64),
  allowDuplicate: z.boolean().default(false),
});
export type CreateCollabInput = z.input<typeof createCollabInput>;

export const paymentInput = z.object({
  collaborationId: z.string().min(1),
  amount: amountField.refine((v) => v > 0, "Amount must be greater than zero"),
  receivedOn: requiredDateField,
  method: z.enum(PAYMENT_METHODS).default("bank_transfer"),
  reference: text(120),
  notes: text(2000),
});
export type PaymentInput = z.input<typeof paymentInput>;

export const taskInput = z.object({
  title: z.string().trim().min(1, "Give the task a title").max(200),
  dueDate: dateOnlyField.default(null),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  notes: text(2000),
  collaborationId: z.preprocess(emptyToNull, z.string().max(40).nullable()).default(null),
});
export type TaskInput = z.input<typeof taskInput>;

export const brandInput = z.object({
  name: z.string().trim().min(1, "Brand name is required").max(120),
  contactName: text(120),
  email: optionalEmail,
  phone: text(40),
  website: optionalHttpUrl,
  notes: text(5000),
});
export type BrandInput = z.input<typeof brandInput>;

export const settingsInput = z.object({
  name: z.string().trim().min(1).max(80),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
  currency: z.enum(CURRENCIES),
  followUpDays: z.coerce.number().int().min(1).max(30),
  paymentTermsDays: z.coerce.number().int().min(0).max(180),
});
export type SettingsInput = z.input<typeof settingsInput>;

export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Password is too long");

export const signupInput = z.object({
  name: z.string().trim().min(1, "Your name").max(80),
  email: z.email("Enter a valid email").max(254),
  password: passwordField,
});

export const loginInput = z.object({
  email: z.email("Enter a valid email").max(254),
  password: z.string().min(1, "Enter your password").max(128),
});

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordField,
});
