import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, Phone, User } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getCollaborationDetail } from "@/server/queries";
import {
  CollabActions,
  DeliverablesPanel,
  MissingDates,
  NoteComposer,
  PaymentRows,
  StatusStepper,
  TaskRows,
} from "@/components/collab/collab-detail";
import { FocusList } from "@/components/focus-list";
import { ActivityFeed } from "@/components/lists";
import { NewTaskButton, RecordPaymentButton } from "@/components/quick-actions";
import { DueChip, PaymentBadge, SampleBadge, Section, StatusBadge } from "@/components/common";
import { Progress } from "@/components/ui/progress";
import { missingImportantDates } from "@/lib/automation";
import {
  COLLAB_TYPE_LABEL,
  DATE_FIELDS,
  DATE_FIELD_LABEL,
  PLATFORM_LABEL,
  SOURCE_LABEL,
} from "@/lib/constants";
import { formatDateOnly } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export async function generateMetadata() {
  return { title: "Collaboration" };
}

export default async function CollaborationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getCollaborationDetail(user, id);
  if (!data) notFound();
  const { collab: c, today, payment } = data;
  const missing = missingImportantDates(c);
  const pct = c.amountMinor > 0 ? Math.min(100, Math.round((c.receivedMinor / c.amountMinor) * 100)) : 0;
  const openTasks = data.tasks.filter((t) => !t.done);
  const doneTasks = data.tasks.filter((t) => t.done);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/collaborations" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Collaborations
        </Link>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {c.brandId ? (
                <Link href={`/brands/${c.brandId}`} className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline">
                  {c.brandName}
                </Link>
              ) : (
                <span className="text-sm font-medium text-muted-foreground">{c.brandName}</span>
              )}
              <StatusBadge status={c.status} />
              {c.amountMinor > 0 && <PaymentBadge status={payment.paymentStatus} />}
              {c.isSample && <SampleBadge />}
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight break-words">{c.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {COLLAB_TYPE_LABEL[c.type]} · via {SOURCE_LABEL[c.source]}
              {c.platforms.length > 0 && ` · ${c.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}`}
            </p>
          </div>
          <CollabActions collab={c} />
        </div>
      </div>

      <StatusStepper id={c.id} status={c.status} />

      {data.focus.length > 0 && (
        <Section title="Needs attention">
          <FocusList items={data.focus} today={today} />
        </Section>
      )}

      <MissingDates id={c.id} fields={missing} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title={`Deliverables${c.deliverables.length ? ` · ${c.deliverables.length}` : ""}`}>
            <DeliverablesPanel collab={c} today={today} />
          </Section>

          <Section title="Tasks" action={<NewTaskButton collaborationId={c.id} size="sm" variant="outline" />}>
            {data.tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks linked to this collaboration.</p>
            ) : (
              <>
                <TaskRows tasks={openTasks} today={today} />
                {doneTasks.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground">{doneTasks.length} completed</summary>
                    <TaskRows tasks={doneTasks} today={today} />
                  </details>
                )}
              </>
            )}
          </Section>

          <Section title="Timeline">
            <NoteComposer id={c.id} />
            <div className="mt-6">
              <ActivityFeed items={data.activity} showCollab={false} />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Money" action={c.amountMinor > 0 ? <RecordPaymentButton collaborationId={c.id} size="sm" variant="outline" label="Record" /> : undefined}>
            {c.amountMinor > 0 ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-semibold tabular-nums">{formatMoney(c.amountMinor, c.currency)}</span>
                    <span className="text-xs text-muted-foreground">{pct}% received</span>
                  </div>
                  <Progress value={pct} className="mt-2" />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Received</dt>
                    <dd className="font-medium tabular-nums">{formatMoney(c.receivedMinor, c.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Outstanding</dt>
                    <dd className={`font-medium tabular-nums ${payment.isOverdue ? "text-red-600 dark:text-red-400" : ""}`}>
                      {formatMoney(payment.outstandingMinor, c.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Payment due</dt>
                    <dd className="flex flex-wrap items-center gap-1">
                      {c.paymentDueDate ? (
                        <>
                          {formatDateOnly(c.paymentDueDate, "short")}
                          {payment.outstandingMinor > 0 && <DueChip date={c.paymentDueDate} today={today} />}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Invoice</dt>
                    <dd className="truncate">
                      {c.invoiceUrl ? (
                        <a href={c.invoiceUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                          {c.invoiceNumber || "Open"}
                        </a>
                      ) : (
                        c.invoiceNumber || <span className="text-muted-foreground">—</span>
                      )}
                      {c.invoiceSentOn && <span className="block text-xs text-muted-foreground">Sent {formatDateOnly(c.invoiceSentOn, "short")}</span>}
                    </dd>
                  </div>
                </dl>
                {c.paymentNotes && <p className="rounded-md bg-muted/60 p-2 text-xs whitespace-pre-wrap">{c.paymentNotes}</p>}
                <div className="border-t pt-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Payment history</p>
                  <PaymentRows payments={data.payments} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No fee agreed{c.type !== "paid" ? ` (${COLLAB_TYPE_LABEL[c.type].toLowerCase()})` : ""}. Edit the collaboration to add an amount.
              </p>
            )}
          </Section>

          <Section title="Key dates">
            <dl className="space-y-2 text-sm">
              {DATE_FIELDS.map((f) => (
                <div key={f} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{DATE_FIELD_LABEL[f]}</dt>
                  <dd className="text-right">{c[f] ? formatDateOnly(c[f]!, "medium") : <span className="text-muted-foreground/60">—</span>}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Contact">
            {c.contactName || c.contactEmail || c.contactPhone ? (
              <ul className="space-y-2 text-sm">
                {c.contactName && (
                  <li className="flex items-center gap-2">
                    <User className="size-4 text-muted-foreground" /> {c.contactName}
                  </li>
                )}
                {c.contactEmail && (
                  <li className="flex items-center gap-2">
                    <Mail className="size-4 text-muted-foreground" />
                    <a href={`mailto:${c.contactEmail}`} className="truncate text-primary hover:underline">
                      {c.contactEmail}
                    </a>
                  </li>
                )}
                {c.contactPhone && (
                  <li className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" />
                    <a href={`tel:${c.contactPhone.replace(/[^\d+]/g, "")}`} className="text-primary hover:underline">
                      {c.contactPhone}
                    </a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No contact details yet.</p>
            )}
          </Section>

          {(c.description || c.notes || c.links.length > 0) && (
            <Section title="Details">
              <div className="space-y-3 text-sm">
                {c.description && <p className="whitespace-pre-wrap">{c.description}</p>}
                {c.notes && <p className="whitespace-pre-wrap text-muted-foreground">{c.notes}</p>}
                {c.links.length > 0 && (
                  <ul className="space-y-1">
                    {c.links.map((l, i) => (
                      <li key={`${l.url}-${i}`}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink className="size-3" /> {l.label || new URL(l.url).hostname}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
