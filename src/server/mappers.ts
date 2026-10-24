import "server-only";
import type { ActivityDoc, BrandDoc, CollaborationDoc, PaymentDoc, TaskDoc } from "./models";
import type { Activity, ActivityKind, Brand, Collaboration, Payment, Task } from "@/lib/types";
import type {
  CollabStatus,
  CollabType,
  DeliverableStatus,
  PaymentMethod,
  Platform,
  Source,
  TaskPriority,
} from "@/lib/constants";

const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : new Date(0).toISOString());

export function toCollaboration(doc: CollaborationDoc): Collaboration {
  return {
    id: String(doc._id),
    brandId: doc.brandId ? String(doc.brandId) : null,
    brandName: doc.brandName,
    title: doc.title,
    contactName: doc.contactName ?? "",
    contactEmail: doc.contactEmail ?? "",
    contactPhone: doc.contactPhone ?? "",
    platforms: (doc.platforms ?? []) as Platform[],
    type: doc.type as CollabType,
    source: doc.source as Source,
    description: doc.description ?? "",
    notes: doc.notes ?? "",
    links: (doc.links ?? []).map((l) => ({ label: l.label ?? "", url: l.url ?? "" })),
    status: doc.status as CollabStatus,
    inquiryDate: doc.inquiryDate ?? null,
    responseDeadline: doc.responseDeadline ?? null,
    startDate: doc.startDate ?? null,
    submissionDeadline: doc.submissionDeadline ?? null,
    publishDate: doc.publishDate ?? null,
    paymentDueDate: doc.paymentDueDate ?? null,
    followUpOn: doc.followUpOn ?? null,
    deliverables: (doc.deliverables ?? []).map((d) => {
      const dd = d as typeof d & { _id: unknown };
      return {
        id: String(dd._id),
        title: d.title,
        platform: (d.platform ?? null) as Platform | null,
        dueDate: d.dueDate ?? null,
        status: d.status as DeliverableStatus,
        notes: d.notes ?? "",
      };
    }),
    currency: doc.currency ?? "INR",
    amountMinor: doc.amountMinor ?? 0,
    receivedMinor: doc.receivedMinor ?? 0,
    invoiceNumber: doc.invoiceNumber ?? "",
    invoiceUrl: doc.invoiceUrl ?? "",
    invoiceSentOn: doc.invoiceSentOn ?? null,
    paymentNotes: doc.paymentNotes ?? "",
    isSample: !!doc.isSample,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export function toPayment(doc: PaymentDoc, collab?: { brandName: string; title: string }): Payment {
  return {
    id: String(doc._id),
    collaborationId: String(doc.collaborationId),
    brandName: collab?.brandName ?? "Unknown",
    collabTitle: collab?.title ?? "",
    amountMinor: doc.amountMinor,
    currency: doc.currency,
    receivedOn: doc.receivedOn,
    method: doc.method as PaymentMethod,
    reference: doc.reference ?? "",
    notes: doc.notes ?? "",
    createdAt: iso(doc.createdAt),
  };
}

export function toTask(doc: TaskDoc, collabLabel: string | null = null): Task {
  return {
    id: String(doc._id),
    title: doc.title,
    dueDate: doc.dueDate ?? null,
    priority: doc.priority as TaskPriority,
    done: !!doc.done,
    completedAt: doc.completedAt ? iso(doc.completedAt) : null,
    notes: doc.notes ?? "",
    collaborationId: doc.collaborationId ? String(doc.collaborationId) : null,
    collabLabel,
    createdAt: iso(doc.createdAt),
  };
}

export function toBrand(doc: BrandDoc & { createdAt?: Date }): Brand {
  return {
    id: String(doc._id),
    name: doc.name,
    contactName: doc.contactName ?? "",
    email: doc.email ?? "",
    phone: doc.phone ?? "",
    website: doc.website ?? "",
    notes: doc.notes ?? "",
    isSample: !!doc.isSample,
    createdAt: iso(doc.createdAt),
  };
}

export function toActivity(doc: ActivityDoc): Activity {
  return {
    id: String(doc._id),
    collaborationId: doc.collaborationId ? String(doc.collaborationId) : null,
    kind: doc.kind as ActivityKind,
    message: doc.message,
    createdAt: iso(doc.createdAt),
  };
}
