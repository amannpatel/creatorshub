import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CircleDollarSign,
  Inbox,
  PiggyBank,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getDashboard } from "@/server/queries";
import { FocusList } from "@/components/focus-list";
import { ActivityFeed, EventList } from "@/components/lists";
import { AddButtons, QuickActions } from "@/components/quick-actions";
import { MoneyStack, Section } from "@/components/common";
import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

function greeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(new Date()));
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  href,
  label,
  icon: Icon,
  children,
  hint,
  tone,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30",
        tone === "danger" && "border-red-500/30 bg-red-500/5",
      )}
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {label}
        <Icon className={cn("size-4", tone === "danger" && "text-red-500")} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{children}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboard(user);
  const cur = user.settings.currency;
  const now = data.focus.filter((f) => f.urgency !== "later");
  const later = data.focus.filter((f) => f.urgency === "later");
  const urgentCount = now.filter((f) => f.urgency === "overdue" || f.urgency === "today").length;
  const firstName = user.name.split(" ")[0];

  if (data.counts.total === 0) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="size-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {firstName} 👋</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          Add a collaboration and CreatorsHub will track replies, follow-ups, deliverables and payments for you. Paste a brand email and the details get filled in.
        </p>
        <div className="mt-6">
          <AddButtons variant="empty" />
        </div>
        <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
          {[
            ["Today's focus", "Replies, follow-ups and deadlines show up here automatically."],
            ["Money, tracked", "Record partial payments — balances and overdue flags update themselves."],
            ["Everything searchable", "Press Ctrl K anywhere to find brands, contacts and notes."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border bg-card p-4">
              <p className="text-sm font-medium">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{formatDateOnly(data.today, "long")}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {greeting(user.settings.timezone)}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {urgentCount === 0
            ? "Nothing overdue or due today. Nice."
            : `${urgentCount} ${urgentCount === 1 ? "thing needs" : "things need"} your attention today.`}
          {data.finance.overdueCount > 0 && (
            <span className="text-red-600 dark:text-red-400">
              {" "}
              {data.finance.overdueCount} overdue {data.finance.overdueCount === 1 ? "payment" : "payments"}.
            </span>
          )}
        </p>
      </div>

      <QuickActions />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard href="/collaborations?status=active" label="Active" icon={Briefcase} hint="Confirmed & in progress">
          {data.counts.active}
        </StatCard>
        <StatCard href="/collaborations?status=new_lead" label="New leads" icon={Inbox} hint={`${data.counts.pipeline} in pipeline`}>
          {data.counts.newLeads}
        </StatCard>
        <StatCard href="/calendar" label="Due in 7 days" icon={CalendarClock} hint="Deadlines & payments">
          {data.counts.dueThisWeek}
        </StatCard>
        <StatCard
          href="/payments"
          label="Pending payments"
          icon={data.finance.overdueCount ? AlertTriangle : CircleDollarSign}
          tone={data.finance.overdueCount ? "danger" : undefined}
          hint={data.finance.overdueCount ? <MoneyStack values={data.finance.overdue} preferred={cur} className="text-red-600 dark:text-red-400" /> : "Nothing overdue"}
        >
          <MoneyStack values={data.finance.outstanding} preferred={cur} />
        </StatCard>
        <StatCard href="/payments" label="Expected this month" icon={TrendingUp} hint="Outstanding, due this month">
          <MoneyStack values={data.finance.expectedThisMonth} preferred={cur} />
        </StatCard>
        <StatCard href="/payments" label="Received this month" icon={PiggyBank} hint={<>All time: <MoneyStack values={data.finance.received} preferred={cur} /></>}>
          <MoneyStack values={data.finance.receivedThisMonth} preferred={cur} />
        </StatCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title={
              <span className="flex items-center gap-2">
                Today&apos;s focus
                {now.length > 0 && <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{now.length}</span>}
              </span>
            }
          >
            <FocusList items={now} today={data.today} emptyText="No replies, deadlines or payments need you in the next couple of days." />
            {later.length > 0 && (
              <details className="mt-2 border-t pt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  {later.length} more coming up later
                </summary>
                <FocusList items={later} today={data.today} />
              </details>
            )}
          </Section>

          <Section
            title="Upcoming deadlines · next 14 days"
            action={
              <Link href="/calendar" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Calendar <ArrowRight className="size-3" />
              </Link>
            }
          >
            <EventList events={data.upcoming.slice(0, 12)} today={data.today} empty="No deadlines in the next two weeks." />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Recent activity">
            <ActivityFeed items={data.activity} />
          </Section>
        </div>
      </div>
    </div>
  );
}
