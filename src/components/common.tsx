import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_STATUS_META,
  PAYMENT_STATUS_META,
  STATUS_META,
  type CollabStatus,
  type DeliverableStatus,
  type PaymentStatus,
  type Tone,
} from "@/lib/constants";
import { TONE_BADGE, TONE_DOT, URGENCY_TONE } from "@/lib/tone";
import { relativeDayLabel, urgencyOf, type DateOnly } from "@/lib/dates";
import { formatMoney, moneyEntries, type MoneyByCurrency } from "@/lib/money";

export function ToneBadge({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset",
        TONE_BADGE[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: CollabStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <ToneBadge tone={meta.tone} dot className={className}>
      {meta.label}
    </ToneBadge>
  );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status];
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

export function DeliverableBadge({ status }: { status: DeliverableStatus }) {
  const meta = DELIVERABLE_STATUS_META[status];
  return <ToneBadge tone={meta.tone}>{meta.label}</ToneBadge>;
}

export function DueChip({ date, today, done = false }: { date: DateOnly; today: DateOnly; done?: boolean }) {
  const urgency = done ? "later" : urgencyOf(date, today);
  return <ToneBadge tone={URGENCY_TONE[urgency]}>{relativeDayLabel(date, today)}</ToneBadge>;
}

export function SampleBadge() {
  return (
    <span className="rounded border border-dashed border-amber-500/50 px-1.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-300">
      Sample
    </span>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function MoneyStack({
  values,
  preferred,
  empty,
  className,
}: {
  values: MoneyByCurrency;
  preferred: string;
  empty?: string;
  className?: string;
}) {
  const entries = moneyEntries(values, preferred);
  if (!entries.length) return <span className={cn("tabular-nums", className)}>{empty ?? formatMoney(0, preferred)}</span>;
  const [[cur, amount], ...rest] = entries;
  return (
    <span className={cn("inline-flex flex-col", className)}>
      <span className="tabular-nums">{formatMoney(amount, cur)}</span>
      {rest.length > 0 && (
        <span className="text-xs font-normal text-muted-foreground tabular-nums">
          + {rest.map(([c, v]) => formatMoney(v, c)).join(" + ")}
        </span>
      )}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function TextLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("text-sm text-primary underline-offset-4 hover:underline", className)}>
      {children}
    </Link>
  );
}
