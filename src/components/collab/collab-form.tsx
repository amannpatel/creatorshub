"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import {
  COLLAB_STATUSES,
  COLLAB_TYPES,
  COLLAB_TYPE_LABEL,
  DATE_FIELDS,
  DATE_FIELD_LABEL,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_META,
  PLATFORMS,
  PLATFORM_LABEL,
  SOURCES,
  SOURCE_LABEL,
  STATUS_META,
  type CollabStatus,
  type CollabType,
  type DateField,
  type DeliverableStatus,
  type Platform,
  type Source,
} from "@/lib/constants";
import { CURRENCIES, minorToInputString } from "@/lib/money";
import type { Collaboration, CollabLink } from "@/lib/types";
import type { CollabInput } from "@/lib/validation";

export interface DeliverableDraft {
  key: string;
  id?: string;
  title: string;
  platform: Platform | "";
  dueDate: string;
  status: DeliverableStatus;
  notes: string;
}

export interface CollabFormValues {
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
  dates: Record<DateField, string>;
  deliverables: DeliverableDraft[];
  currency: string;
  amount: string;
  invoiceNumber: string;
  invoiceUrl: string;
  paymentNotes: string;
}

let keySeq = 0;
export const newKey = () => `d${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export function emptyCollabValues(currency: string): CollabFormValues {
  return {
    brandName: "",
    title: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    platforms: [],
    type: "paid",
    source: "manual",
    description: "",
    notes: "",
    links: [],
    status: "new_lead",
    dates: Object.fromEntries(DATE_FIELDS.map((f) => [f, ""])) as Record<DateField, string>,
    deliverables: [],
    currency,
    amount: "",
    invoiceNumber: "",
    invoiceUrl: "",
    paymentNotes: "",
  };
}

export function valuesFromCollab(c: Collaboration): CollabFormValues {
  return {
    brandName: c.brandName,
    title: c.title,
    contactName: c.contactName,
    contactEmail: c.contactEmail,
    contactPhone: c.contactPhone,
    platforms: c.platforms,
    type: c.type,
    source: c.source,
    description: c.description,
    notes: c.notes,
    links: c.links,
    status: c.status,
    dates: Object.fromEntries(DATE_FIELDS.map((f) => [f, c[f] ?? ""])) as Record<DateField, string>,
    deliverables: c.deliverables.map((d) => ({
      key: d.id,
      id: d.id,
      title: d.title,
      platform: d.platform ?? "",
      dueDate: d.dueDate ?? "",
      status: d.status,
      notes: d.notes,
    })),
    currency: c.currency,
    amount: minorToInputString(c.amountMinor),
    invoiceNumber: c.invoiceNumber,
    invoiceUrl: c.invoiceUrl,
    paymentNotes: c.paymentNotes,
  };
}

export function toCollabInput(v: CollabFormValues): CollabInput {
  return {
    brandName: v.brandName,
    title: v.title,
    contactName: v.contactName,
    contactEmail: v.contactEmail,
    contactPhone: v.contactPhone,
    platforms: v.platforms,
    type: v.type,
    source: v.source,
    description: v.description,
    notes: v.notes,
    links: v.links.filter((l) => l.url.trim()),
    status: v.status,
    ...v.dates,
    deliverables: v.deliverables
      .filter((d) => d.title.trim())
      .map((d) => ({ id: d.id, title: d.title, platform: d.platform || null, dueDate: d.dueDate, status: d.status, notes: d.notes })),
    currency: v.currency as CollabInput["currency"],
    amount: v.amount,
    invoiceNumber: v.invoiceNumber,
    invoiceUrl: v.invoiceUrl,
    paymentNotes: v.paymentNotes,
  };
}

export function FormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PlatformPicker({ value, onChange }: { value: Platform[]; onChange: (v: Platform[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PLATFORMS.map((p) => {
        const active = value.includes(p);
        return (
          <button
            key={p}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? value.filter((x) => x !== p) : [...value, p])}
            className={cn(
              "h-7 rounded-full border px-2.5 text-xs transition-colors",
              active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {PLATFORM_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h3>;
}

export function CollabForm({
  values,
  onChange,
  brandOptions = [],
}: {
  values: CollabFormValues;
  onChange: (v: CollabFormValues) => void;
  brandOptions?: string[];
}) {
  const id = useId();
  const set = <K extends keyof CollabFormValues>(key: K, val: CollabFormValues[K]) => onChange({ ...values, [key]: val });
  const setDate = (f: DateField, val: string) => onChange({ ...values, dates: { ...values.dates, [f]: val } });
  const setDeliverable = (key: string, patch: Partial<DeliverableDraft>) =>
    set("deliverables", values.deliverables.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const [newLink, setNewLink] = useState("");

  return (
    <div className="space-y-4">
      <SectionTitle>Basics</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Brand or agency *" htmlFor={`${id}-brand`}>
          <Input
            id={`${id}-brand`}
            value={values.brandName}
            onChange={(e) => set("brandName", e.target.value)}
            list={`${id}-brands`}
            required
            maxLength={120}
          />
          <datalist id={`${id}-brands`}>
            {brandOptions.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Campaign / title" htmlFor={`${id}-title`}>
          <Input id={`${id}-title`} value={values.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="e.g. Diwali launch reel" />
        </FormField>
        <FormField label="Status" htmlFor={`${id}-status`}>
          <NativeSelect id={`${id}-status`} value={values.status} onChange={(e) => set("status", e.target.value as CollabStatus)}>
            {COLLAB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Type" htmlFor={`${id}-type`}>
            <NativeSelect id={`${id}-type`} value={values.type} onChange={(e) => set("type", e.target.value as CollabType)}>
              {COLLAB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {COLLAB_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Source" htmlFor={`${id}-source`}>
            <NativeSelect id={`${id}-source`} value={values.source} onChange={(e) => set("source", e.target.value as Source)}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </div>
      <FormField label="Platforms">
        <PlatformPicker value={values.platforms} onChange={(v) => set("platforms", v)} />
      </FormField>

      <SectionTitle>Contact</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Contact person" htmlFor={`${id}-cname`}>
          <Input id={`${id}-cname`} value={values.contactName} onChange={(e) => set("contactName", e.target.value)} maxLength={120} />
        </FormField>
        <FormField label="Email" htmlFor={`${id}-cemail`}>
          <Input id={`${id}-cemail`} type="email" value={values.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} maxLength={254} />
        </FormField>
        <FormField label="Phone" htmlFor={`${id}-cphone`}>
          <Input id={`${id}-cphone`} type="tel" value={values.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} maxLength={40} />
        </FormField>
      </div>

      <SectionTitle>Important dates</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DATE_FIELDS.map((f) => (
          <FormField key={f} label={DATE_FIELD_LABEL[f]} htmlFor={`${id}-${f}`}>
            <Input id={`${id}-${f}`} type="date" value={values.dates[f]} onChange={(e) => setDate(f, e.target.value)} />
          </FormField>
        ))}
      </div>

      <SectionTitle>Deliverables</SectionTitle>
      <div className="space-y-2">
        {values.deliverables.length === 0 && <p className="text-sm text-muted-foreground">No deliverables yet.</p>}
        {values.deliverables.map((d) => (
          <div key={d.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_8rem_9rem_9rem_auto]">
            <Input aria-label="Deliverable" value={d.title} onChange={(e) => setDeliverable(d.key, { title: e.target.value })} placeholder="1 Instagram Reel" maxLength={160} />
            <Button type="button" variant="ghost" size="icon" className="sm:order-last" aria-label="Remove deliverable" onClick={() => set("deliverables", values.deliverables.filter((x) => x.key !== d.key))}>
              <Trash2 />
            </Button>
            <NativeSelect aria-label="Platform" value={d.platform} onChange={(e) => setDeliverable(d.key, { platform: e.target.value as Platform | "" })}>
              <option value="">Platform</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </NativeSelect>
            <Input aria-label="Due date" type="date" value={d.dueDate} onChange={(e) => setDeliverable(d.key, { dueDate: e.target.value })} />
            <NativeSelect aria-label="Status" value={d.status} onChange={(e) => setDeliverable(d.key, { status: e.target.value as DeliverableStatus })} className="col-span-2 sm:col-span-1">
              {DELIVERABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DELIVERABLE_STATUS_META[s].label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set("deliverables", [...values.deliverables, { key: newKey(), title: "", platform: "", dueDate: "", status: "todo", notes: "" }])
          }
        >
          <Plus /> Add deliverable
        </Button>
      </div>

      <SectionTitle>Money</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField label="Agreed amount" htmlFor={`${id}-amount`} className="sm:col-span-2">
          <div className="flex gap-2">
            <NativeSelect aria-label="Currency" value={values.currency} onChange={(e) => set("currency", e.target.value)} className="w-24 shrink-0">
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
            <Input id={`${id}-amount`} inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} placeholder="25000" />
          </div>
        </FormField>
        <FormField label="Invoice number" htmlFor={`${id}-inv`}>
          <Input id={`${id}-inv`} value={values.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} maxLength={80} />
        </FormField>
        <FormField label="Invoice link" htmlFor={`${id}-invurl`} className="sm:col-span-3">
          <Input id={`${id}-invurl`} type="url" value={values.invoiceUrl} onChange={(e) => set("invoiceUrl", e.target.value)} placeholder="https://" />
        </FormField>
        <FormField label="Payment notes" htmlFor={`${id}-pnotes`} className="sm:col-span-3">
          <Input id={`${id}-pnotes`} value={values.paymentNotes} onChange={(e) => set("paymentNotes", e.target.value)} maxLength={2000} placeholder="e.g. 50% advance, rest after posting" />
        </FormField>
      </div>

      <SectionTitle>Details</SectionTitle>
      <FormField label="Campaign description" htmlFor={`${id}-desc`}>
        <Textarea id={`${id}-desc`} value={values.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={5000} />
      </FormField>
      <FormField label="Notes" htmlFor={`${id}-notes`}>
        <Textarea id={`${id}-notes`} value={values.notes} onChange={(e) => set("notes", e.target.value)} rows={3} maxLength={10000} />
      </FormField>
      <FormField label="Links (brief, drive folder, contract…)">
        <div className="space-y-2">
          {values.links.map((l, i) => (
            <div key={`${l.url}-${i}`} className="flex gap-2">
              <Input aria-label="Link label" value={l.label} onChange={(e) => set("links", values.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" className="w-32" />
              <Input aria-label="Link URL" value={l.url} onChange={(e) => set("links", values.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
              <Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => set("links", values.links.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="https://…" type="url" />
            <Button
              type="button"
              variant="outline"
              disabled={!newLink.trim()}
              onClick={() => {
                set("links", [...values.links, { label: "", url: newLink.trim() }]);
                setNewLink("");
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </FormField>
    </div>
  );
}
