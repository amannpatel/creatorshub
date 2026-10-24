import type {
  CollabStatus,
  CollabType,
  DeliverableStatus,
  PaymentMethod,
  Platform,
  Source,
  TaskPriority,
} from "./constants";
import type { DateOnly } from "./dates";

/** Plain, serializable shapes passed from the server to UI components. */

export interface UserSettings {
  timezone: string;
  currency: string;
  followUpDays: number;
  paymentTermsDays: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  settings: UserSettings;
}

export interface Deliverable {
  id: string;
  title: string;
  platform: Platform | null;
  dueDate: DateOnly | null;
  status: DeliverableStatus;
  notes: string;
}

export interface CollabLink {
  label: string;
  url: string;
}

export interface CollabDates {
  inquiryDate: DateOnly | null;
  responseDeadline: DateOnly | null;
  startDate: DateOnly | null;
  submissionDeadline: DateOnly | null;
  publishDate: DateOnly | null;
  paymentDueDate: DateOnly | null;
  followUpOn: DateOnly | null;
}

export interface Collaboration extends CollabDates {
  id: string;
  brandId: string | null;
  brandName: string;
  title: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  platforms: Platform[];
  type: CollabType;
  source: Source;
  description: string;
  notes: string;
  links: CollabLink[];
  status: CollabStatus;
  deliverables: Deliverable[];
  currency: string;
  amountMinor: number;
  receivedMinor: number;
  invoiceNumber: string;
  invoiceUrl: string;
  invoiceSentOn: DateOnly | null;
  paymentNotes: string;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  collaborationId: string;
  brandName: string;
  collabTitle: string;
  amountMinor: number;
  currency: string;
  receivedOn: DateOnly;
  method: PaymentMethod;
  reference: string;
  notes: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: DateOnly | null;
  priority: TaskPriority;
  done: boolean;
  completedAt: string | null;
  notes: string;
  collaborationId: string | null;
  collabLabel: string | null;
  createdAt: string;
}

export interface Brand {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  isSample: boolean;
  createdAt: string;
}

export interface Activity {
  id: string;
  collaborationId: string | null;
  kind: ActivityKind;
  message: string;
  createdAt: string;
}

export type ActivityKind =
  | "created"
  | "status"
  | "note"
  | "follow_up"
  | "payment"
  | "deliverable"
  | "task"
  | "updated";

export interface SearchHit {
  id: string;
  kind: "collaboration" | "brand" | "task";
  title: string;
  subtitle: string;
  href: string;
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
      /** Set when a create was refused because a similar record already exists. */
      duplicateId?: string;
    };
