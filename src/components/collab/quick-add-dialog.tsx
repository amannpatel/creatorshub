"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ChevronDown, ClipboardPaste, Loader2, Wand2, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { useAppUI } from "@/components/app-ui";
import { useServerAction } from "@/components/use-server-action";
import {
  CollabForm,
  FormField,
  PlatformPicker,
  emptyCollabValues,
  newKey,
  toCollabInput,
  type CollabFormValues,
} from "./collab-form";
import { createCollaboration } from "@/server/actions/collaborations";
import { listBrandNames } from "@/server/actions/lookup";
import { extractCollaboration, type ExtractionResult } from "@/lib/extract";
import { STATUS_META, type CollabStatus, type Platform } from "@/lib/constants";
import { CURRENCIES, formatMoney } from "@/lib/money";
import { DELIVERABLE_SUGGESTIONS } from "@/lib/automation";
import type { CollabInput } from "@/lib/validation";

const QUICK_STATUSES: CollabStatus[] = ["new_lead", "contacted", "negotiating", "confirmed"];

function requestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function valuesFromExtraction(x: ExtractionResult, currency: string): CollabFormValues {
  const v = emptyCollabValues(x.currency ?? currency);
  return {
    ...v,
    brandName: x.brandName ?? "",
    title: x.title ?? "",
    contactName: x.contactName ?? "",
    contactEmail: x.contactEmail ?? "",
    contactPhone: x.contactPhone ?? "",
    platforms: x.platforms,
    type: x.type ?? "paid",
    source: x.source ?? "email",
    links: x.links.map((url) => ({ label: "", url })),
    amount: x.amountMinor ? String(x.amountMinor / 100) : "",
    dates: {
      ...v.dates,
      responseDeadline: x.responseDeadline ?? "",
      startDate: x.startDate ?? "",
      submissionDeadline: x.submissionDeadline ?? "",
      publishDate: x.publishDate ?? "",
      paymentDueDate: x.paymentDueDate ?? "",
    },
    deliverables: x.deliverables.map((d) => ({ key: newKey(), title: d.title, platform: d.platform ?? "", dueDate: "", status: "todo", notes: "" })),
  };
}

export function QuickAddDialog() {
  const ui = useAppUI();
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [tab, setTab] = useState<"quick" | "paste">("quick");
  const [brands, setBrands] = useState<string[]>([]);
  const [reqId, setReqId] = useState(requestId);
  const [duplicate, setDuplicate] = useState<{ id: string; message: string } | null>(null);

  // Quick add state
  const [quick, setQuick] = useState({ brandName: "", title: "", amount: "", currency: ui.currency, status: "new_lead" as CollabStatus, responseDeadline: "", submissionDeadline: "", platforms: [] as Platform[], deliverables: [] as string[] });
  const [more, setMore] = useState(false);

  // Paste state
  const [raw, setRaw] = useState("");
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null);
  const [review, setReview] = useState<CollabFormValues | null>(null);
  const [keepActions, setKeepActions] = useState(true);
  const [keepOriginal, setKeepOriginal] = useState(false);

  const { open } = ui.quickAdd;
  useEffect(() => {
    if (!open) return;
    setTab(ui.quickAdd.tab);
    listBrandNames().then(setBrands).catch(() => setBrands([]));
  }, [open, ui.quickAdd.tab]);

  function reset() {
    setQuick({ brandName: "", title: "", amount: "", currency: ui.currency, status: "new_lead", responseDeadline: "", submissionDeadline: "", platforms: [], deliverables: [] });
    setMore(false);
    setRaw("");
    setExtracted(null);
    setReview(null);
    setDuplicate(null);
    setReqId(requestId());
  }

  function onOpenChange(next: boolean) {
    if (!next) {
      ui.close("quickAdd");
      reset();
    }
  }

  function save(input: CollabInput, allowDuplicate: boolean, navigate: boolean) {
    run(() => createCollaboration({ ...input, clientRequestId: reqId, allowDuplicate }), {
      onSuccess: (r) => {
        const id = r.data.id;
        toast.success("Collaboration added", {
          action: navigate ? undefined : { label: "Open", onClick: () => router.push(`/collaborations/${id}`) },
        });
        onOpenChange(false);
        if (navigate) router.push(`/collaborations/${id}`);
      },
      onError: (r) => {
        if (r.duplicateId) setDuplicate({ id: r.duplicateId, message: r.error });
        else toast.error(r.error);
      },
    });
  }

  function saveQuick(allowDuplicate = false) {
    const base = emptyCollabValues(quick.currency);
    save(
      {
        ...toCollabInput({
          ...base,
          brandName: quick.brandName,
          title: quick.title,
          status: quick.status,
          amount: quick.amount,
          currency: quick.currency,
          platforms: quick.platforms,
          dates: { ...base.dates, responseDeadline: quick.responseDeadline, submissionDeadline: quick.submissionDeadline },
          deliverables: quick.deliverables.map((title) => ({
            key: newKey(),
            title: `1 ${title}`,
            platform: DELIVERABLE_SUGGESTIONS.find((s) => s.title === title)?.platform ?? "",
            dueDate: "",
            status: "todo",
            notes: "",
          })),
        }),
        source: "manual",
      },
      allowDuplicate,
      false,
    );
  }

  function runExtraction() {
    const result = extractCollaboration(raw, ui.today, ui.currency);
    setExtracted(result);
    setReview(valuesFromExtraction(result, ui.currency));
  }

  function savePasted(allowDuplicate = false) {
    if (!review || !extracted) return;
    const extraNotes: string[] = [];
    if (keepActions && extracted.actions.length) extraNotes.push(`Requested actions:\n${extracted.actions.map((a) => `• ${a}`).join("\n")}`);
    if (keepOriginal) extraNotes.push(`Original message:\n${raw.slice(0, 8000)}`);
    const notes = [review.notes, ...extraNotes].filter(Boolean).join("\n\n").slice(0, 10000);
    save(toCollabInput({ ...review, notes }), allowDuplicate, true);
  }

  const duplicateBanner = duplicate && (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
        {duplicate.message}
      </span>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="outline" render={<Link href={`/collaborations/${duplicate.id}`} onClick={() => onOpenChange(false)} />}>
          Open existing
        </Button>
        <Button size="sm" onClick={() => (tab === "quick" ? saveQuick(true) : savePasted(true))} disabled={pending}>
          Save anyway
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New collaboration</DialogTitle>
          <DialogDescription>Only the brand is required — fill in the rest whenever you like.</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => { setTab(v as "quick" | "paste"); setDuplicate(null); }}>
          <TabsList className="w-full">
            <TabsTrigger value="quick">
              <Zap /> Quick add
            </TabsTrigger>
            <TabsTrigger value="paste">
              <ClipboardPaste /> Paste email / DM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quick" className="pt-3">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                saveQuick();
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Brand or agency *" htmlFor="qa-brand">
                  <Input id="qa-brand" autoFocus required maxLength={120} list="qa-brands" value={quick.brandName} onChange={(e) => setQuick({ ...quick, brandName: e.target.value })} placeholder="e.g. Nike" />
                  <datalist id="qa-brands">
                    {brands.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </FormField>
                <FormField label="What's it about?" htmlFor="qa-title">
                  <Input id="qa-title" maxLength={200} value={quick.title} onChange={(e) => setQuick({ ...quick, title: e.target.value })} placeholder="e.g. Running shoes launch reel" />
                </FormField>
              </div>

              <button type="button" onClick={() => setMore(!more)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" aria-expanded={more}>
                <ChevronDown className={`size-4 transition-transform ${more ? "rotate-180" : ""}`} />
                {more ? "Fewer details" : "Add amount, deadline, deliverables"}
              </button>

              {more && (
                <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Status" htmlFor="qa-status">
                      <NativeSelect id="qa-status" value={quick.status} onChange={(e) => setQuick({ ...quick, status: e.target.value as CollabStatus })}>
                        {QUICK_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_META[s].label}
                          </option>
                        ))}
                      </NativeSelect>
                    </FormField>
                    <FormField label="Offered amount" htmlFor="qa-amount">
                      <div className="flex gap-2">
                        <NativeSelect aria-label="Currency" className="w-24 shrink-0" value={quick.currency} onChange={(e) => setQuick({ ...quick, currency: e.target.value })}>
                          {CURRENCIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </NativeSelect>
                        <Input id="qa-amount" inputMode="decimal" value={quick.amount} onChange={(e) => setQuick({ ...quick, amount: e.target.value })} placeholder="25000" />
                      </div>
                    </FormField>
                    <FormField label="Reply by" htmlFor="qa-reply">
                      <Input id="qa-reply" type="date" value={quick.responseDeadline} onChange={(e) => setQuick({ ...quick, responseDeadline: e.target.value })} />
                    </FormField>
                    <FormField label="Content due" htmlFor="qa-due">
                      <Input id="qa-due" type="date" value={quick.submissionDeadline} onChange={(e) => setQuick({ ...quick, submissionDeadline: e.target.value })} />
                    </FormField>
                  </div>
                  <FormField label="Deliverables">
                    <div className="flex flex-wrap gap-1.5">
                      {DELIVERABLE_SUGGESTIONS.map((s) => {
                        const active = quick.deliverables.includes(s.title);
                        return (
                          <button
                            key={s.title}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setQuick({ ...quick, deliverables: active ? quick.deliverables.filter((x) => x !== s.title) : [...quick.deliverables, s.title] })}
                            className={`h-7 rounded-full border px-2.5 text-xs transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                          >
                            {s.title}
                          </button>
                        );
                      })}
                    </div>
                  </FormField>
                  <FormField label="Platforms">
                    <PlatformPicker value={quick.platforms} onChange={(platforms) => setQuick({ ...quick, platforms })} />
                  </FormField>
                </div>
              )}
              {duplicateBanner}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending || !quick.brandName.trim()}>
                  {pending && <Loader2 className="animate-spin" />} Add collaboration
                </Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="paste" className="pt-3">
            {!review ? (
              <div className="space-y-3">
                <Textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={10}
                  maxLength={20000}
                  placeholder={"Paste the brand's email, Instagram DM or WhatsApp message here…"}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Extraction runs in your browser using pattern matching (not AI) — the message is only saved if you choose to keep it. Always review the result.
                </p>
                <div className="flex justify-end">
                  <Button onClick={runExtraction} disabled={raw.trim().length < 10}>
                    <Wand2 /> Extract details
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setReview(null); setDuplicate(null); }}>
                    <ArrowLeft /> Edit message
                  </Button>
                  <p className="text-xs text-muted-foreground">Review and correct before saving</p>
                </div>
                {extracted?.currencyAssumed && extracted.amountMinor && (
                  <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                    Found {formatMoney(extracted.amountMinor, review.currency)} without a currency symbol — assumed {review.currency}.
                  </p>
                )}
                {!extracted?.brandName && (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">Couldn&apos;t detect the brand name — please add it below.</p>
                )}
                <CollabForm values={review} onChange={setReview} brandOptions={brands} />
                {extracted && extracted.actions.length > 0 && (
                  <div className="rounded-lg border p-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox checked={keepActions} onCheckedChange={(c) => setKeepActions(!!c)} /> Save requested actions to notes
                    </label>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                      {extracted.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={keepOriginal} onCheckedChange={(c) => setKeepOriginal(!!c)} /> Also keep the original message in notes
                </label>
                {duplicateBanner}
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => savePasted()} disabled={pending || !review.brandName.trim()}>
                    {pending && <Loader2 className="animate-spin" />} Save collaboration
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
