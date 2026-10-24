"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useAppUI } from "@/components/app-ui";
import { useServerAction } from "@/components/use-server-action";
import { FormField } from "@/components/collab/collab-form";
import { recordPayment, updatePayment } from "@/server/actions/payments";
import { listCollabOptions } from "@/server/actions/lookup";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/constants";
import { formatMoney, minorToInputString } from "@/lib/money";
import type { CollabOption } from "@/lib/types";

export function PaymentDialog() {
  const ui = useAppUI();
  const { open, payment } = ui.payment;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && ui.close("payment")}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payment ? "Edit payment" : "Record payment"}</DialogTitle>
          <DialogDescription>Tracks money you&apos;ve received — no payment is processed.</DialogDescription>
        </DialogHeader>
        {open && <PaymentForm key={payment?.id ?? "new"} />}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm() {
  const ui = useAppUI();
  const { payment, collaborationId } = ui.payment;
  const { pending, run } = useServerAction();
  const [options, setOptions] = useState<CollabOption[] | null>(null);
  const [form, setForm] = useState(() => ({
    collaborationId: payment?.collaborationId ?? collaborationId ?? "",
    amount: payment ? minorToInputString(payment.amountMinor) : "",
    receivedOn: payment?.receivedOn ?? ui.today,
    method: (payment?.method ?? "bank_transfer") as PaymentMethod,
    reference: payment?.reference ?? "",
    notes: payment?.notes ?? "",
  }));

  useEffect(() => {
    listCollabOptions()
      .then((opts) => {
        setOptions(opts);
        // Prefill the outstanding balance for new payments.
        if (!payment) {
          const target = opts.find((o) => o.id === (collaborationId ?? ""));
          if (target?.outstandingMinor) {
            setForm((f) => (f.amount ? f : { ...f, amount: minorToInputString(target.outstandingMinor) }));
          }
        }
      })
      .catch(() => setOptions([]));
  }, [payment, collaborationId]);

  const selected = options?.find((o) => o.id === form.collaborationId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() => (payment ? updatePayment(payment.id, form) : recordPayment(form)), {
      success: payment ? "Payment updated" : "Payment recorded",
      onSuccess: () => ui.close("payment"),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
          <FormField label="Collaboration *" htmlFor="pay-collab">
            <NativeSelect
              id="pay-collab"
              required
              disabled={!!payment}
              value={form.collaborationId}
              onChange={(e) => {
                const o = options?.find((x) => x.id === e.target.value);
                setForm({ ...form, collaborationId: e.target.value, amount: o?.outstandingMinor ? minorToInputString(o.outstandingMinor) : form.amount });
              }}
            >
              <option value="">{options ? "Choose…" : "Loading…"}</option>
              {options?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
            {selected && selected.outstandingMinor > 0 && !payment && (
              <p className="text-xs text-muted-foreground">Outstanding: {formatMoney(selected.outstandingMinor, selected.currency)}</p>
            )}
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={`Amount${selected ? ` (${selected.currency})` : ""} *`} htmlFor="pay-amount">
              <Input id="pay-amount" required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="10000" />
            </FormField>
            <FormField label="Received on *" htmlFor="pay-date">
              <Input id="pay-date" type="date" required value={form.receivedOn} onChange={(e) => setForm({ ...form, receivedOn: e.target.value })} />
            </FormField>
            <FormField label="Method" htmlFor="pay-method">
              <NativeSelect id="pay-method" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PaymentMethod })}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Reference / UTR" htmlFor="pay-ref">
              <Input id="pay-ref" maxLength={120} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="pay-notes">
            <Input id="pay-notes" maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Advance, TDS deducted" />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => ui.close("payment")}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !form.collaborationId || !form.amount}>
              {pending && <Loader2 className="animate-spin" />}
              {payment ? "Save" : "Record payment"}
            </Button>
          </div>
    </form>
  );
}
