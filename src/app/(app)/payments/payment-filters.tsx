"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";

export function PaymentFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [brand, setBrand] = useState(params.get("brand") ?? "");

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (brand === (params.get("brand") ?? "")) return;
    const t = setTimeout(() => update({ brand: brand.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  const any = ["brand", "month", "status"].some((k) => params.get(k));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Input className="col-span-2 h-9 sm:col-span-1" placeholder="Filter by brand…" value={brand} onChange={(e) => setBrand(e.target.value)} aria-label="Brand" />
      <Input type="month" className="h-9" value={params.get("month") ?? ""} onChange={(e) => update({ month: e.target.value || null })} aria-label="Month" />
      <NativeSelect aria-label="Payment status" value={params.get("status") ?? ""} onChange={(e) => update({ status: e.target.value || null })}>
        <option value="">Unpaid & partial</option>
        <option value="overdue">Overdue</option>
        <option value="unpaid">Unpaid</option>
        <option value="partial">Partially paid</option>
        <option value="paid">Paid</option>
      </NativeSelect>
      {any && (
        <Button
          variant="ghost"
          className="h-9"
          onClick={() => {
            setBrand("");
            update({ brand: null, month: null, status: null });
          }}
        >
          <X /> Clear
        </Button>
      )}
    </div>
  );
}
