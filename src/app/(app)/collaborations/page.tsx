import { Suspense } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listCollaborations } from "@/server/queries";
import { CollabFilters } from "@/components/collab/collab-filters";
import { StatusMenu } from "@/components/collab/status-menu";
import { DueChip, EmptyState, PageHeader, PaymentBadge, SampleBadge } from "@/components/common";
import { AddButtons } from "@/components/quick-actions";
import { PLATFORM_LABEL, COLLAB_TYPE_LABEL } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Collaborations" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function CollaborationsPage({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  const sp = await searchParams;
  const filters = {
    q: one(sp.q),
    status: one(sp.status) ?? "open",
    platform: one(sp.platform),
    type: one(sp.type),
    payment: one(sp.payment),
    from: one(sp.from),
    to: one(sp.to),
    sort: one(sp.sort),
  };
  const { items, today } = await listCollaborations(user, filters);
  const filtered = Object.entries(filters).some(([k, v]) => v && !(k === "status" && v === "open"));

  return (
    <div>
      <PageHeader
        title="Collaborations"
        description={`${items.length} ${items.length === 1 ? "collaboration" : "collaborations"}`}
        actions={<AddButtons />}
      />
      <Suspense>
        <CollabFilters />
      </Suspense>

      <div className="mt-4">
        {items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={filtered ? "No matches" : "No open collaborations"}
            description={filtered ? "Try a different search or clear the filters." : "Add a collaboration or paste a brand email to get started."}
            action={filtered ? undefined : <AddButtons />}
          />
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {items.map((c) => (
              <li key={c.id} className="group relative flex flex-col gap-2 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/collaborations/${c.id}`} className="truncate font-medium after:absolute after:inset-0 hover:underline">
                      {c.brandName}
                    </Link>
                    {c.isSample && <SampleBadge />}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{c.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {COLLAB_TYPE_LABEL[c.type]}
                    {c.platforms.length > 0 && ` · ${c.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}`}
                    {c.deliverables.length > 0 && ` · ${c.deliverables.length} deliverable${c.deliverables.length > 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="relative z-10 flex flex-wrap items-center gap-2 sm:w-[22rem] sm:flex-nowrap sm:justify-end">
                  {c.nextDate && c.status !== "completed" && c.status !== "cancelled" && <DueChip date={c.nextDate} today={today} />}
                  <StatusMenu id={c.id} status={c.status} />
                  <div className="ml-auto text-right sm:ml-0 sm:w-28">
                    {c.amountMinor > 0 ? (
                      <>
                        <p className="text-sm font-medium tabular-nums">{formatMoney(c.amountMinor, c.currency)}</p>
                        <PaymentBadge status={c.paymentStatus} />
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{COLLAB_TYPE_LABEL[c.type]}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
