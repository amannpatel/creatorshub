import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Mail, Phone, User } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getBrandDetail } from "@/server/queries";
import { MoneyStack, PaymentBadge, SampleBadge, Section, StatusBadge } from "@/components/common";
import { BrandDialogButton, DeleteBrandButton } from "../brand-actions";
import { formatDateOnly } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Brand" };

export default async function BrandPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const data = await getBrandDetail(user, id);
  if (!data) notFound();
  const { brand: b, collabs, totals } = data;
  const cur = user.settings.currency;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/brands" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Brands
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            {b.name} {b.isSample && <SampleBadge />}
          </h1>
          <div className="flex gap-2">
            <BrandDialogButton brand={b} />
            <DeleteBrandButton id={b.id} name={b.name} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ["Contracted", totals.contracted],
            ["Received", totals.received],
            ["Outstanding", totals.outstanding],
          ] as const
        ).map(([label, v]) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-lg font-semibold">
              <MoneyStack values={v} preferred={cur} />
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title={`Collaboration history · ${collabs.length}`} className="lg:col-span-2">
          {collabs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collaborations with this brand yet.</p>
          ) : (
            <ul className="divide-y">
              {collabs.map((c) => (
                <li key={c.id}>
                  <Link href={`/collaborations/${c.id}`} className="flex flex-col gap-1 py-3 hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">Added {formatDateOnly(c.inquiryDate ?? c.createdAt.slice(0, 10), "medium")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status} />
                      {c.amountMinor > 0 && <PaymentBadge status={c.paymentStatus} />}
                      <span className="w-24 text-right text-sm tabular-nums">{c.amountMinor > 0 ? formatMoney(c.amountMinor, c.currency) : "—"}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Contact">
          <ul className="space-y-2 text-sm">
            {b.contactName && (
              <li className="flex items-center gap-2">
                <User className="size-4 text-muted-foreground" /> {b.contactName}
              </li>
            )}
            {b.email && (
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <a className="truncate text-primary hover:underline" href={`mailto:${b.email}`}>
                  {b.email}
                </a>
              </li>
            )}
            {b.phone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" /> {b.phone}
              </li>
            )}
            {b.website && (
              <li className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                <a className="truncate text-primary hover:underline" href={b.website} target="_blank" rel="noopener noreferrer nofollow">
                  {b.website.replace(/^https?:\/\//, "")}
                </a>
              </li>
            )}
            {!b.contactName && !b.email && !b.phone && !b.website && <li className="text-muted-foreground">No contact details yet.</li>}
          </ul>
          {b.notes && <p className="mt-4 border-t pt-3 text-sm whitespace-pre-wrap text-muted-foreground">{b.notes}</p>}
        </Section>
      </div>
    </div>
  );
}
