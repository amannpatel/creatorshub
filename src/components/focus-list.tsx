"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  CheckCircle2,
  FileText,
  Mail,
  MessageCircleReply,
  PackageCheck,
  Repeat,
  Upload,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneBadge } from "@/components/common";
import { useAppUI } from "@/components/app-ui";
import { useServerAction } from "@/components/use-server-action";
import { toggleTask } from "@/server/actions/tasks";
import { logFollowUp, markInvoiceSent, setCollabStatus, setDeliverableStatus } from "@/server/actions/collaborations";
import type { FocusAction, FocusItem, FocusKind } from "@/lib/attention";
import { relativeDayLabel, type DateOnly } from "@/lib/dates";
import { URGENCY_TONE } from "@/lib/tone";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<FocusKind, LucideIcon> = {
  task: CheckCircle2,
  reply: Mail,
  follow_up: Repeat,
  deliverable: Upload,
  submission: Upload,
  payment: Wallet,
  invoice: FileText,
};

const ACTION_LABEL: Record<FocusAction["type"], { label: string; icon: LucideIcon }> = {
  complete_task: { label: "Done", icon: Check },
  mark_contacted: { label: "Replied", icon: MessageCircleReply },
  log_follow_up: { label: "Followed up", icon: Repeat },
  deliverable_submitted: { label: "Submitted", icon: PackageCheck },
  record_payment: { label: "Record payment", icon: Wallet },
  mark_invoiced: { label: "Invoice sent", icon: FileText },
};

export function FocusList({ items, today, emptyText = "Nothing needs your attention right now." }: { items: FocusItem[]; today: DateOnly; emptyText?: string }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="size-8 text-emerald-500" />
        <p className="text-sm font-medium">All clear</p>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <motion.li
            key={item.id}
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
            transition={{ duration: 0.2 }}
          >
            <FocusRow item={item} today={today} />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function FocusRow({ item, today }: { item: FocusItem; today: DateOnly }) {
  const ui = useAppUI();
  const { pending, run } = useServerAction();
  const Icon = KIND_ICON[item.kind];
  const action = item.action;

  function perform() {
    if (!action) return;
    switch (action.type) {
      case "complete_task":
        return run(() => toggleTask(action.taskId, true), { success: "Task completed" });
      case "mark_contacted":
        return run(() => setCollabStatus(action.collaborationId, "contacted"), { success: "Marked as contacted · follow-up scheduled" });
      case "log_follow_up":
        return run(() => logFollowUp(action.collaborationId), { success: "Follow-up logged · next one scheduled" });
      case "deliverable_submitted":
        return run(() => setDeliverableStatus(action.collaborationId, action.deliverableId, "submitted"), { success: "Deliverable submitted" });
      case "record_payment":
        return ui.openPayment({ collaborationId: action.collaborationId });
      case "mark_invoiced":
        return run(() => markInvoiceSent(action.collaborationId), { success: "Invoice marked as sent" });
    }
  }

  const content = (
    <>
      <span
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
          item.urgency === "overdue" ? "bg-red-500/10 text-red-600 dark:text-red-400" : item.urgency === "today" ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {item.dueDate && <ToneBadge tone={URGENCY_TONE[item.urgency]}>{relativeDayLabel(item.dueDate, today)}</ToneBadge>}
          <span className="truncate">{item.reason}</span>
        </span>
      </span>
    </>
  );

  return (
    <div className={cn("flex items-center gap-3 py-2.5", pending && "opacity-60")}>
      {item.collaborationId ? (
        <Link href={`/collaborations/${item.collaborationId}`} className="flex min-w-0 flex-1 items-start gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3">{content}</div>
      )}
      {action && (
        <Button size="sm" variant="outline" onClick={perform} disabled={pending} className="shrink-0" aria-label={ACTION_LABEL[action.type].label}>
          {(() => {
            const A = ACTION_LABEL[action.type];
            return (
              <>
                <A.icon />
                <span className="hidden sm:inline">{A.label}</span>
              </>
            );
          })()}
        </Button>
      )}
    </div>
  );
}
