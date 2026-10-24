export const COLLAB_STATUSES = [
  "new_lead",
  "contacted",
  "negotiating",
  "confirmed",
  "in_progress",
  "awaiting_approval",
  "completed",
  "cancelled",
] as const;
export type CollabStatus = (typeof COLLAB_STATUSES)[number];

export const STATUS_META: Record<
  CollabStatus,
  { label: string; tone: Tone; group: "pipeline" | "active" | "closed" }
> = {
  new_lead: { label: "New lead", tone: "violet", group: "pipeline" },
  contacted: { label: "Contacted", tone: "sky", group: "pipeline" },
  negotiating: { label: "Negotiating", tone: "amber", group: "pipeline" },
  confirmed: { label: "Confirmed", tone: "emerald", group: "active" },
  in_progress: { label: "In progress", tone: "blue", group: "active" },
  awaiting_approval: { label: "Awaiting approval", tone: "orange", group: "active" },
  completed: { label: "Completed", tone: "green", group: "closed" },
  cancelled: { label: "Cancelled / Lost", tone: "zinc", group: "closed" },
};

export const ACTIVE_STATUSES: CollabStatus[] = ["confirmed", "in_progress", "awaiting_approval"];
export const PIPELINE_STATUSES: CollabStatus[] = ["new_lead", "contacted", "negotiating"];
export const FOLLOW_UP_STATUSES: CollabStatus[] = ["contacted", "negotiating", "awaiting_approval"];

export type Tone =
  | "violet"
  | "sky"
  | "amber"
  | "emerald"
  | "blue"
  | "orange"
  | "green"
  | "zinc"
  | "red"
  | "pink";

export const PLATFORMS = [
  "instagram",
  "youtube",
  "linkedin",
  "x",
  "tiktok",
  "facebook",
  "blog",
  "podcast",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X / Twitter",
  tiktok: "TikTok",
  facebook: "Facebook",
  blog: "Blog",
  podcast: "Podcast",
  other: "Other",
};

export const COLLAB_TYPES = ["paid", "barter", "affiliate", "gifted", "other"] as const;
export type CollabType = (typeof COLLAB_TYPES)[number];
export const COLLAB_TYPE_LABEL: Record<CollabType, string> = {
  paid: "Paid",
  barter: "Barter",
  affiliate: "Affiliate",
  gifted: "Gifted",
  other: "Other",
};

export const SOURCES = ["email", "instagram_dm", "whatsapp", "referral", "manual", "other"] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = {
  email: "Email",
  instagram_dm: "Instagram DM",
  whatsapp: "WhatsApp",
  referral: "Referral",
  manual: "Manual",
  other: "Other",
};

export const DELIVERABLE_STATUSES = [
  "todo",
  "in_progress",
  "submitted",
  "changes_requested",
  "approved",
  "published",
] as const;
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number];
export const DELIVERABLE_STATUS_META: Record<DeliverableStatus, { label: string; tone: Tone }> = {
  todo: { label: "To do", tone: "zinc" },
  in_progress: { label: "In progress", tone: "blue" },
  submitted: { label: "Submitted", tone: "orange" },
  changes_requested: { label: "Changes requested", tone: "red" },
  approved: { label: "Approved", tone: "emerald" },
  published: { label: "Published", tone: "green" },
};
/** Deliverable statuses where the creator still owes the brand content. */
export const DELIVERABLE_PENDING: DeliverableStatus[] = ["todo", "in_progress", "changes_requested"];

export const PAYMENT_METHODS = ["bank_transfer", "upi", "paypal", "cheque", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: "Bank transfer",
  upi: "UPI",
  paypal: "PayPal",
  cheque: "Cheque",
  cash: "Cash",
  other: "Other",
};

export const PAYMENT_STATUSES = ["none", "unpaid", "partial", "paid", "overdue"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const PAYMENT_STATUS_META: Record<PaymentStatus, { label: string; tone: Tone }> = {
  none: { label: "No fee", tone: "zinc" },
  unpaid: { label: "Unpaid", tone: "amber" },
  partial: { label: "Partially paid", tone: "sky" },
  paid: { label: "Paid", tone: "green" },
  overdue: { label: "Overdue", tone: "red" },
};

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const PRIORITY_META: Record<TaskPriority, { label: string; tone: Tone }> = {
  low: { label: "Low", tone: "zinc" },
  medium: { label: "Medium", tone: "amber" },
  high: { label: "High", tone: "red" },
};

export const DATE_FIELDS = [
  "inquiryDate",
  "responseDeadline",
  "startDate",
  "submissionDeadline",
  "publishDate",
  "paymentDueDate",
  "followUpOn",
] as const;
export type DateField = (typeof DATE_FIELDS)[number];
export const DATE_FIELD_LABEL: Record<DateField, string> = {
  inquiryDate: "Inquiry date",
  responseDeadline: "Response deadline",
  startDate: "Campaign start",
  submissionDeadline: "Content submission",
  publishDate: "Publishing date",
  paymentDueDate: "Payment due",
  followUpOn: "Next follow-up",
};

export const DEFAULT_FOLLOW_UP_DAYS = 3;
