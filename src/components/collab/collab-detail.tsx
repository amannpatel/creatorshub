"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarPlus,
  Check,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Send,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DueChip, ToneBadge } from "@/components/common";
import { useAppUI } from "@/components/app-ui";
import { useServerAction } from "@/components/use-server-action";
import { CollabForm, toCollabInput, valuesFromCollab, type CollabFormValues } from "./collab-form";
import {
  addCollabNote,
  addDeliverable,
  deleteCollaboration,
  logFollowUp,
  markInvoiceSent,
  removeDeliverable,
  setCollabStatus,
  setDeliverableStatus,
  updateCollabDates,
  updateCollaboration,
} from "@/server/actions/collaborations";
import { deleteTask, toggleTask } from "@/server/actions/tasks";
import { deletePayment } from "@/server/actions/payments";
import { listBrandNames } from "@/server/actions/lookup";
import {
  COLLAB_STATUSES,
  DATE_FIELD_LABEL,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_META,
  PAYMENT_METHOD_LABEL,
  PLATFORMS,
  PLATFORM_LABEL,
  PRIORITY_META,
  STATUS_META,
  type CollabStatus,
  type DateField,
  type DeliverableStatus,
  type Platform,
} from "@/lib/constants";
import { DELIVERABLE_SUGGESTIONS } from "@/lib/automation";
import { formatDateOnly, type DateOnly } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { TONE_DOT } from "@/lib/tone";
import type { Collaboration, Deliverable, Payment, Task } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ------------------------------ Status stepper ----------------------------- */

const FLOW: CollabStatus[] = COLLAB_STATUSES.filter((s) => s !== "cancelled");

export function StatusStepper({ id, status }: { id: string; status: CollabStatus }) {
  const { pending, run } = useServerAction();
  const currentIndex = FLOW.indexOf(status);
  const move = (s: CollabStatus) => run(() => setCollabStatus(id, s), { success: `Moved to ${STATUS_META[s].label}` });
  return (
    <div className="space-y-2">
      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="group" aria-label="Collaboration stage">
        {FLOW.map((s, i) => {
          const done = status !== "cancelled" && i < currentIndex;
          const current = s === status;
          return (
            <button
              key={s}
              type="button"
              disabled={pending || current}
              aria-current={current ? "step" : undefined}
              onClick={() => move(s)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors",
                current && "border-primary bg-primary font-medium text-primary-foreground",
                done && "border-transparent bg-accent text-accent-foreground",
                !current && !done && "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {done ? <Check className="size-3" /> : <span className={cn("size-1.5 rounded-full", current ? "bg-primary-foreground" : TONE_DOT[STATUS_META[s].tone])} />}
              {STATUS_META[s].label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {pending && <Loader2 className="size-3 animate-spin" />}
        {status === "cancelled" ? (
          <button type="button" className="underline-offset-2 hover:underline" onClick={() => move("new_lead")}>
            Cancelled — reopen as new lead
          </button>
        ) : (
          <button type="button" className="underline-offset-2 hover:text-destructive hover:underline" onClick={() => move("cancelled")}>
            Mark as cancelled / lost
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Header actions ----------------------------- */

export function CollabActions({ collab }: { collab: Collaboration }) {
  const ui = useAppUI();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [values, setValues] = useState<CollabFormValues | null>(null);
  const [brands, setBrands] = useState<string[]>([]);

  function openEdit() {
    setValues(valuesFromCollab(collab));
    setEditOpen(true);
    listBrandNames().then(setBrands).catch(() => undefined);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={openEdit}>
        <Pencil /> Edit
      </Button>
      <Button variant="outline" onClick={() => ui.openTask({ collaborationId: collab.id })}>
        <Plus /> Task
      </Button>
      {collab.amountMinor > 0 && (
        <Button variant="outline" onClick={() => ui.openPayment({ collaborationId: collab.id })}>
          <Wallet /> Payment
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => run(() => logFollowUp(collab.id), { success: "Follow-up logged" })}>
            <Repeat /> Log follow-up
          </DropdownMenuItem>
          {collab.amountMinor > 0 && !collab.invoiceSentOn && (
            <DropdownMenuItem onClick={() => run(() => markInvoiceSent(collab.id), { success: "Invoice marked as sent" })}>
              <Send /> Mark invoice sent
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
          <SheetHeader className="border-b">
            <SheetTitle>Edit collaboration</SheetTitle>
            <SheetDescription>Changes are logged in the timeline.</SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (!values) return;
              run(() => updateCollaboration(collab.id, toCollabInput(values)), {
                success: "Saved",
                onSuccess: () => setEditOpen(false),
              });
            }}
          >
            <div className="flex-1 overflow-y-auto p-4">{values && <CollabForm values={values} onChange={setValues} brandOptions={brands} />}</div>
            <div className="flex justify-end gap-2 border-t p-4">
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !values?.brandName.trim()}>
                {pending && <Loader2 className="animate-spin" />} Save changes
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this collaboration?</DialogTitle>
            <DialogDescription>
              This permanently removes “{collab.title}” along with its payments, tasks and timeline. Consider marking it as cancelled instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(() => deleteCollaboration(collab.id), {
                  success: "Collaboration deleted",
                  onSuccess: () => {
                    setConfirmOpen(false);
                    router.push("/collaborations");
                  },
                })
              }
            >
              {pending && <Loader2 className="animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------- Missing dates ----------------------------- */

export function MissingDates({ id, fields }: { id: string; fields: DateField[] }) {
  const { pending, run } = useServerAction();
  const [values, setValues] = useState<Record<string, string>>({});
  if (!fields.length) return null;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <CalendarPlus className="size-4 text-amber-600" /> Add the key dates for this confirmed collaboration
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">They drive reminders, the calendar and overdue payment detection.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[repeat(3,1fr)_auto] sm:items-end">
        {fields.map((f) => (
          <label key={f} className="space-y-1 text-xs text-muted-foreground">
            {DATE_FIELD_LABEL[f]}
            <Input type="date" value={values[f] ?? ""} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
          </label>
        ))}
        <Button
          disabled={pending || !Object.values(values).some(Boolean)}
          onClick={() => run(() => updateCollabDates(id, Object.fromEntries(Object.entries(values).filter(([, v]) => v))), { success: "Dates saved" })}
        >
          Save dates
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------- Deliverables ------------------------------ */

export function DeliverablesPanel({ collab, today }: { collab: Collaboration; today: DateOnly }) {
  const { pending, run } = useServerAction();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ title: "", platform: "" as Platform | "", dueDate: collab.submissionDeadline ?? "" });
  const allDone = collab.deliverables.length > 0 && collab.deliverables.every((d) => d.status === "approved" || d.status === "published");
  const showSuggestions = collab.deliverables.length === 0 && ["confirmed", "in_progress", "negotiating"].includes(collab.status);

  function add(title: string, platform: Platform | "" | null, dueDate: string) {
    run(() => addDeliverable(collab.id, { title, platform: platform || null, dueDate, status: "todo", notes: "" }), {
      success: "Deliverable added",
      onSuccess: () => {
        setDraft({ title: "", platform: "", dueDate: collab.submissionDeadline ?? "" });
        setAdding(false);
      },
    });
  }

  return (
    <div className="space-y-3">
      {allDone && collab.status !== "completed" && (
        <div className="flex flex-col gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>All deliverables are approved or published.</span>
          <Button size="sm" onClick={() => run(() => setCollabStatus(collab.id, "completed"), { success: "Marked as completed" })} disabled={pending}>
            <Check /> Mark collaboration completed
          </Button>
        </div>
      )}
      {collab.deliverables.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No deliverables yet. Add what you&apos;ve agreed to create so each one gets its own deadline and status.</p>
      )}
      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5">
          {DELIVERABLE_SUGGESTIONS.map((s) => (
            <button key={s.title} type="button" disabled={pending} onClick={() => add(`1 ${s.title}`, s.platform, collab.submissionDeadline ?? "")} className="h-7 rounded-full border border-dashed px-2.5 text-xs hover:bg-muted">
              + {s.title}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {collab.deliverables.map((d) => (
          <DeliverableRow key={d.id} collabId={collab.id} d={d} today={today} fallbackDue={collab.submissionDeadline} />
        ))}
      </ul>
      {adding ? (
        <form
          className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_9rem_10rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            add(draft.title, draft.platform, draft.dueDate);
          }}
        >
          <Input autoFocus required maxLength={160} placeholder="e.g. 2 Instagram Stories" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <NativeSelect aria-label="Platform" value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value as Platform | "" })}>
            <option value="">Platform</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </NativeSelect>
          <Input type="date" aria-label="Due date" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !draft.title.trim()}>
              Add
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus /> Add deliverable
        </Button>
      )}
    </div>
  );
}

function DeliverableRow({ collabId, d, today, fallbackDue }: { collabId: string; d: Deliverable; today: DateOnly; fallbackDue: DateOnly | null }) {
  const { pending, run } = useServerAction();
  const due = d.dueDate ?? fallbackDue;
  const done = d.status === "approved" || d.status === "published";
  return (
    <li className={cn("flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center", pending && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{d.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {d.platform && <span>{PLATFORM_LABEL[d.platform]}</span>}
          {due && (
            <>
              <span>· due {formatDateOnly(due, "short")}</span>
              {!done && d.status !== "submitted" && <DueChip date={due} today={today} />}
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label={`Status of ${d.title}`}
          value={d.status}
          disabled={pending}
          onChange={(e) => run(() => setDeliverableStatus(collabId, d.id, e.target.value), { success: `${d.title}: ${DELIVERABLE_STATUS_META[e.target.value as DeliverableStatus].label}` })}
          className="w-44"
        >
          {DELIVERABLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {DELIVERABLE_STATUS_META[s].label}
            </option>
          ))}
        </NativeSelect>
        <Button variant="ghost" size="icon" aria-label={`Remove ${d.title}`} disabled={pending} onClick={() => run(() => removeDeliverable(collabId, d.id), { success: "Deliverable removed" })}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

/* --------------------------------- Payments -------------------------------- */

export function PaymentRows({ payments, showCollab = false }: { payments: Payment[]; showCollab?: boolean }) {
  const ui = useAppUI();
  const { pending, run } = useServerAction();
  if (!payments.length) return <p className="text-sm text-muted-foreground">No payments recorded yet.</p>;
  return (
    <ul className="divide-y">
      {payments.map((p) => (
        <li key={p.id} className={cn("flex items-center gap-3 py-2", pending && "opacity-60")}>
          <div className="min-w-0 flex-1">
            {showCollab && (
              <Link href={`/collaborations/${p.collaborationId}`} className="block truncate text-sm font-medium hover:underline">
                {p.brandName}
                <span className="font-normal text-muted-foreground"> · {p.collabTitle}</span>
              </Link>
            )}
            <p className={cn("text-sm tabular-nums", !showCollab && "font-medium")}>{formatMoney(p.amountMinor, p.currency)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {formatDateOnly(p.receivedOn)} · {PAYMENT_METHOD_LABEL[p.method]}
              {p.reference && ` · ${p.reference}`}
              {p.notes && ` · ${p.notes}`}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Payment actions" />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => ui.openPayment({ payment: p })}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  if (confirm("Delete this payment record? Balances will be recalculated.")) run(() => deletePayment(p.id), { success: "Payment removed" });
                }}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------- Tasks ---------------------------------- */

export function TaskRows({ tasks, today, showCollab = false }: { tasks: Task[]; today: DateOnly; showCollab?: boolean }) {
  return (
    <ul className="divide-y">
      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} today={today} showCollab={showCollab} />
      ))}
    </ul>
  );
}

export function TaskRow({ task, today, showCollab }: { task: Task; today: DateOnly; showCollab?: boolean }) {
  const ui = useAppUI();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [optimisticDone, setOptimisticDone] = useState<boolean | null>(null);
  const done = optimisticDone ?? task.done;
  return (
    <li className={cn("flex items-start gap-3 py-2.5", pending && "opacity-70")}>
      <Checkbox
        className="mt-0.5"
        checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        onCheckedChange={(c) => {
          setOptimisticDone(!!c);
          run(() => toggleTask(task.id, !!c), {
            onSuccess: () => {
              setOptimisticDone(null);
              if (c) toast.success("Task completed", { action: { label: "Undo", onClick: () => void toggleTask(task.id, false).then(() => router.refresh()) } });
            },
            onError: (r) => {
              setOptimisticDone(null);
              toast.error(r.error);
            },
          });
        }}
      />
      <button type="button" onClick={() => ui.openTask({ task })} className="min-w-0 flex-1 text-left">
        <p className={cn("text-sm", done && "text-muted-foreground line-through")}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {task.dueDate && !done && <DueChip date={task.dueDate} today={today} />}
          {task.dueDate && done && <span>{formatDateOnly(task.dueDate, "short")}</span>}
          {task.priority !== "medium" && <ToneBadge tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</ToneBadge>}
          {showCollab && task.collabLabel && <span className="truncate">· {task.collabLabel}</span>}
          {task.notes && <span className="truncate">· {task.notes}</span>}
        </p>
      </button>
      <Button variant="ghost" size="icon-sm" aria-label={`Delete "${task.title}"`} onClick={() => run(() => deleteTask(task.id), { success: "Task deleted" })}>
        <Trash2 />
      </Button>
    </li>
  );
}

/* --------------------------------- Timeline -------------------------------- */

export function NoteComposer({ id }: { id: string }) {
  const { pending, run } = useServerAction();
  const [note, setNote] = useState("");
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addCollabNote(id, note), { success: "Note added", onSuccess: () => setNote("") });
      }}
    >
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder="Add a note, call summary or update…" />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => logFollowUp(id, note), { success: "Follow-up logged", onSuccess: () => setNote("") })}>
          <Repeat /> Log as follow-up
        </Button>
        <Button type="submit" size="sm" disabled={pending || !note.trim()}>
          Add note
        </Button>
      </div>
    </form>
  );
}
