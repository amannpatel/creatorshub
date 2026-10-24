import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listBrands } from "@/server/queries";
import { EmptyState, MoneyStack, PageHeader, SampleBadge } from "@/components/common";
import { Input } from "@/components/ui/input";
import { BrandDialogButton } from "./brand-actions";
import { timeAgo } from "@/lib/dates";

export const metadata = { title: "Brands" };

export default async function BrandsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const brands = await listBrands(user, query);
  const cur = user.settings.currency;
  const now = new Date();

  return (
    <div>
      <PageHeader
        title="Brands & agencies"
        description="Created automatically when you add a collaboration."
        actions={<BrandDialogButton />}
      />
      <form className="relative mb-4 max-w-sm" action="/brands">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={query} placeholder="Search brands…" className="h-9 pl-8" aria-label="Search brands" />
      </form>
      {brands.length === 0 ? (
        <EmptyState icon={Building2} title={query ? "No brands match" : "No brands yet"} description={query ? undefined : "Brands appear here as soon as you add a collaboration."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => (
            <Link key={b.id} href={`/brands/${b.id}`} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {b.name} {b.isSample && <SampleBadge />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{b.contactName || b.email || "No contact saved"}</p>
                </div>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">{b.name.slice(0, 1).toUpperCase()}</span>
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Collabs</dt>
                  <dd className="text-sm font-medium">
                    {b.stats.count}
                    {b.stats.active > 0 && <span className="text-xs font-normal text-emerald-600"> · {b.stats.active} active</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Contracted</dt>
                  <dd className="text-sm font-medium">
                    <MoneyStack values={b.stats.contracted} preferred={cur} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Received</dt>
                  <dd className="text-sm font-medium">
                    <MoneyStack values={b.stats.received} preferred={cur} />
                  </dd>
                </div>
              </dl>
              {b.stats.lastActivity && <p className="mt-3 text-[11px] text-muted-foreground">Updated {timeAgo(b.stats.lastActivity, now)}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
