"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import {
  COLLAB_STATUSES,
  COLLAB_TYPES,
  COLLAB_TYPE_LABEL,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_META,
  PLATFORMS,
  PLATFORM_LABEL,
  STATUS_META,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { value: "open", label: "Open" },
  { value: "pipeline", label: "Pipeline" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

export function CollabFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => update({ q: q.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = params.get("status") ?? "open";
  const advanced = ["platform", "type", "payment", "from", "to"].some((k) => params.get(k));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search brand, campaign, contact, notes…"
            className="h-9 pl-8"
            aria-label="Search collaborations"
          />
          {pending && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <NativeSelect aria-label="Sort" value={params.get("sort") ?? "updated"} onChange={(e) => update({ sort: e.target.value === "updated" ? null : e.target.value })} className="sm:w-48">
          <option value="updated">Recently updated</option>
          <option value="deadline">Next deadline</option>
          <option value="amount">Amount (high → low)</option>
          <option value="created">Recently added</option>
        </NativeSelect>
      </div>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => update({ status: t.value === "open" ? null : t.value })}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-sm transition-colors",
              status === t.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {t.label}
          </button>
        ))}
        <NativeSelect
          aria-label="Exact status"
          value={COLLAB_STATUSES.includes(status as never) ? status : ""}
          onChange={(e) => update({ status: e.target.value || null })}
          className="w-40 shrink-0"
        >
          <option value="">Any stage…</option>
          {COLLAB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <NativeSelect aria-label="Platform" value={params.get("platform") ?? ""} onChange={(e) => update({ platform: e.target.value || null })}>
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Type" value={params.get("type") ?? ""} onChange={(e) => update({ type: e.target.value || null })}>
          <option value="">All types</option>
          {COLLAB_TYPES.map((t) => (
            <option key={t} value={t}>
              {COLLAB_TYPE_LABEL[t]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Payment status" value={params.get("payment") ?? ""} onChange={(e) => update({ payment: e.target.value || null })}>
          <option value="">Any payment</option>
          {PAYMENT_STATUSES.map((p) => (
            <option key={p} value={p}>
              {PAYMENT_STATUS_META[p].label}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" aria-label="Inquiry from" title="Inquiry from" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} className="h-9" />
        <Input type="date" aria-label="Inquiry to" title="Inquiry to" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} className="h-9" />
        {(advanced || q) && (
          <Button
            variant="ghost"
            className="h-9"
            onClick={() => {
              setQ("");
              update({ platform: null, type: null, payment: null, from: null, to: null, q: null });
            }}
          >
            <X /> Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
