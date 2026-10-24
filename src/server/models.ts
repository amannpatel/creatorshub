import "server-only";
import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";
import {
  COLLAB_STATUSES,
  COLLAB_TYPES,
  DELIVERABLE_STATUSES,
  PAYMENT_METHODS,
  PLATFORMS,
  SOURCES,
  TASK_PRIORITIES,
} from "@/lib/constants";

const { ObjectId } = Schema.Types;
const dateOnly = { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ };

// Reuse compiled models across hot reloads while keeping mongoose's schema-inferred types.
function getModel<TSchema extends Schema>(name: string, schema: TSchema) {
  const create = () => model(name, schema);
  return (models[name] as ReturnType<typeof create> | undefined) ?? create();
}

/* ---------------------------------- User ---------------------------------- */

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true },
    /** Incremented to invalidate all existing sessions (e.g. after a password change). */
    sessionVersion: { type: Number, default: 0 },
    settings: {
      timezone: { type: String, default: "Asia/Kolkata" },
      currency: { type: String, default: "INR" },
      followUpDays: { type: Number, default: 3, min: 1, max: 30 },
      paymentTermsDays: { type: Number, default: 30, min: 0, max: 180 },
    },
  },
  { timestamps: true },
);
export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const UserModel = getModel("User", userSchema);

/* --------------------------------- Brand ---------------------------------- */

const brandSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    /** Normalised name used to auto-associate collaborations with an existing brand. */
    nameKey: { type: String, required: true },
    contactName: { type: String, default: "", maxlength: 120 },
    email: { type: String, default: "", maxlength: 254 },
    phone: { type: String, default: "", maxlength: 40 },
    website: { type: String, default: "", maxlength: 300 },
    notes: { type: String, default: "", maxlength: 5000 },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);
brandSchema.index({ userId: 1, nameKey: 1 }, { unique: true });
export type BrandDoc = InferSchemaType<typeof brandSchema> & { _id: mongoose.Types.ObjectId };
export const BrandModel = getModel("Brand", brandSchema);

/* ----------------------------- Collaboration ------------------------------ */

const deliverableSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  platform: { type: String, enum: [...PLATFORMS, null], default: null },
  dueDate: dateOnly,
  status: { type: String, enum: DELIVERABLE_STATUSES, default: "todo" },
  notes: { type: String, default: "", maxlength: 2000 },
});

const collaborationSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    brandId: { type: ObjectId, ref: "Brand", default: null },
    brandName: { type: String, required: true, trim: true, maxlength: 120 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    contactName: { type: String, default: "", maxlength: 120 },
    contactEmail: { type: String, default: "", maxlength: 254 },
    contactPhone: { type: String, default: "", maxlength: 40 },
    platforms: { type: [{ type: String, enum: PLATFORMS }], default: [] },
    type: { type: String, enum: COLLAB_TYPES, default: "paid" },
    source: { type: String, enum: SOURCES, default: "manual" },
    description: { type: String, default: "", maxlength: 5000 },
    notes: { type: String, default: "", maxlength: 10000 },
    links: {
      type: [{ label: { type: String, maxlength: 80 }, url: { type: String, maxlength: 1000 } }],
      default: [],
    },
    status: { type: String, enum: COLLAB_STATUSES, default: "new_lead" },
    inquiryDate: dateOnly,
    responseDeadline: dateOnly,
    startDate: dateOnly,
    submissionDeadline: dateOnly,
    publishDate: dateOnly,
    paymentDueDate: dateOnly,
    followUpOn: dateOnly,
    deliverables: { type: [deliverableSchema], default: [] },
    currency: { type: String, default: "INR" },
    /** Agreed amount in minor units (paise/cents). */
    amountMinor: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    /** Denormalised sum of payment records; always recomputed from Payment documents. */
    receivedMinor: { type: Number, default: 0, min: 0 },
    invoiceNumber: { type: String, default: "", maxlength: 80 },
    invoiceUrl: { type: String, default: "", maxlength: 1000 },
    invoiceSentOn: dateOnly,
    paymentNotes: { type: String, default: "", maxlength: 2000 },
    /** Client-generated id that makes "create" idempotent against double submits. */
    clientRequestId: { type: String, default: undefined },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);
collaborationSchema.index({ userId: 1, status: 1, updatedAt: -1 });
collaborationSchema.index({ userId: 1, updatedAt: -1 });
collaborationSchema.index({ userId: 1, brandId: 1 });
collaborationSchema.index(
  { userId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } },
);
export type CollaborationDoc = InferSchemaType<typeof collaborationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const CollaborationModel = getModel("Collaboration", collaborationSchema);

/* -------------------------------- Payment --------------------------------- */

const paymentSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    collaborationId: { type: ObjectId, ref: "Collaboration", required: true },
    amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
    currency: { type: String, required: true },
    receivedOn: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    method: { type: String, enum: PAYMENT_METHODS, default: "bank_transfer" },
    reference: { type: String, default: "", maxlength: 120 },
    notes: { type: String, default: "", maxlength: 2000 },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);
paymentSchema.index({ userId: 1, receivedOn: -1 });
paymentSchema.index({ userId: 1, collaborationId: 1 });
export type PaymentDoc = InferSchemaType<typeof paymentSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const PaymentModel = getModel("Payment", paymentSchema);

/* ---------------------------------- Task ---------------------------------- */

const taskSchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    collaborationId: { type: ObjectId, ref: "Collaboration", default: null },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    dueDate: dateOnly,
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium" },
    done: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    notes: { type: String, default: "", maxlength: 2000 },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);
taskSchema.index({ userId: 1, done: 1, dueDate: 1 });
taskSchema.index({ userId: 1, collaborationId: 1 });
export type TaskDoc = InferSchemaType<typeof taskSchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const TaskModel = getModel("Task", taskSchema);

/* -------------------------------- Activity -------------------------------- */

const activitySchema = new Schema(
  {
    userId: { type: ObjectId, ref: "User", required: true },
    collaborationId: { type: ObjectId, ref: "Collaboration", default: null },
    kind: { type: String, required: true },
    message: { type: String, required: true, maxlength: 2000 },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ userId: 1, collaborationId: 1, createdAt: -1 });
export type ActivityDoc = InferSchemaType<typeof activitySchema> & { _id: mongoose.Types.ObjectId; createdAt: Date };
export const ActivityModel = getModel("Activity", activitySchema);

/* ------------------------------ Login attempts ---------------------------- */

const loginAttemptSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
loginAttemptSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const LoginAttemptModel = getModel("LoginAttempt", loginAttemptSchema);
