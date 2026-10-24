import { Suspense } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getPaymentsPage } from "@/server/queries";
import { DueChip, EmptyState, MoneyStack, PageHeader, PaymentBadge, Section } from "@/components/common";
import { PaymentRows } from "@/components/collab/collab-detail";
import { RecordPaymentButton } from "@/components/quick-actions";
import { PaymentFilters } from "./payment-filters";
import { formatDateOnly } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata = { title: "Payments" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function Stat({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", danger && "border-red-500/30 bg-red-500/5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className={cn("mt-1 text-xl font-semibold tracking-tight", danger && "text-red-600 dark:text-red-400")}>{children}</div>
    </div>
  );
}

export default async function PaymentsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const cur = user.settings.currency;
  const { today, summary, receivables, payments, filteredTotal } = await getPaymentsPage(user, {
    month: one(sp.month),
    brand: one(sp.brand),
    status: one(sp.status),
  });
  const filtered = !!(one(sp.month) || one(sp.brand) || one(sp.status));

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="A tracker for money you're owed and have received — not a payment gateway." actions={<RecordPaymentButton />} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total contracted">
          <MoneyStack values={summary.contracted} preferred={cur} />
        </Stat>
        <Stat label="Total received">
          <MoneyStack values={summary.received} preferred={cur} />
        </Stat>
        <Stat label="Outstanding">
          <MoneyStack values={summary.outstanding} preferred={cur} />
        </Stat>
        <Stat label={`Overdue · ${summary.overdueCount}`} danger={summary.overdueCount > 0}>
          <MoneyStack values={summary.overdue} preferred={cur} />
        </Stat>
        <Stat label="Expected this month">
          <MoneyStack values={summary.expectedThisMonth} preferred={cur} />
        </Stat>
      </div>

      <Suspense>
        <PaymentFilters />
      </Suspense>

      <div className="grid gap-6 lg:grid-cols-5">
        <Section title={`Receivables · ${receivables.length}`} className="lg:col-span-3">
          {receivables.length === 0 ? (
            <EmptyState
              icon={Wallet}
              className="border-0"
              title={filtered ? "No matches" : "Nothing outstanding"}
              description={filtered ? "Try different filters." : "Collaborations with an agreed amount show up here until they're fully paid."}
            />
          ) : (
            <ul className="divide-y">
              {receivables.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <Link href={`/collaborations/${r.id}`} className="min-w-0 flex-1 hover:underline">
                    <p className="truncate text-sm font-medium">{r.brandName}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.title}</p>
                  </Link>
                  <div className="flex items-center gap-2">
                    {r.paymentDueDate ? (
                      r.outstandingMinor > 0 ? <DueChip date={r.paymentDueDate} today={today} /> : <span className="text-xs text-muted-foreground">{formatDateOnly(r.paymentDueDate, "short")}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">No due date</span>
                    )}
                    <PaymentBadge status={r.paymentStatus} />
                    <div className="w-28 text-right">
                      <p className="text-sm font-medium tabular-nums">{formatMoney(r.outstandingMinor || r.amountMinor, r.currency)}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {r.outstandingMinor ? `of ${formatMoney(r.amountMinor, r.currency)}` : "paid in full"}
                      </p>
                    </div>
                    {r.outstandingMinor > 0 && <RecordPaymentButton collaborationId={r.id} size="sm" variant="outline" label="Record" />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Payment history"
          className="lg:col-span-2"
          action={<span className="text-xs text-muted-foreground"><MoneyStack values={filteredTotal} preferred={cur} /></span>}
        >
          <PaymentRows payments={payments.slice(0, 200)} showCollab />
        </Section>
      </div>
    </div>
  );
}
