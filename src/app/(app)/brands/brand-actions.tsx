"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/collab/collab-form";
import { useServerAction } from "@/components/use-server-action";
import { createBrand, deleteBrand, updateBrand } from "@/server/actions/brands";
import type { Brand } from "@/lib/types";

export function BrandDialogButton({ brand }: { brand?: Brand }) {
  const router = useRouter();
  const { pending, run } = useServerAction();
  const [open, setOpen] = useState(false);
  const empty = { name: "", contactName: "", email: "", phone: "", website: "", notes: "" };
  const [form, setForm] = useState(empty);

  function openDialog() {
    setForm(brand ? { name: brand.name, contactName: brand.contactName, email: brand.email, phone: brand.phone, website: brand.website, notes: brand.notes } : empty);
    setOpen(true);
  }

  return (
    <>
      <Button variant={brand ? "outline" : "default"} onClick={openDialog}>
        {brand ? <Pencil /> : <Plus />} {brand ? "Edit" : "Add brand"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{brand ? "Edit brand" : "Add brand"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (brand) {
                run(() => updateBrand(brand.id, form), { success: "Brand saved", onSuccess: () => setOpen(false) });
              } else {
                run(() => createBrand(form), {
                  success: "Brand added",
                  onSuccess: (r) => {
                    setOpen(false);
                    router.push(`/brands/${r.data.id}`);
                  },
                });
              }
            }}
          >
            <FormField label="Brand / agency name *" htmlFor="b-name">
              <Input id="b-name" required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Contact person" htmlFor="b-contact">
                <Input id="b-contact" maxLength={120} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </FormField>
              <FormField label="Email" htmlFor="b-email">
                <Input id="b-email" type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </FormField>
              <FormField label="Phone" htmlFor="b-phone">
                <Input id="b-phone" type="tel" maxLength={40} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </FormField>
              <FormField label="Website" htmlFor="b-web">
                <Input id="b-web" type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </FormField>
            </div>
            <FormField label="Notes" htmlFor="b-notes">
              <Textarea id="b-notes" rows={3} maxLength={5000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !form.name.trim()}>
                {pending && <Loader2 className="animate-spin" />} Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteBrandButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { pending, run } = useServerAction();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete ${name}? Its collaborations are kept but will no longer be grouped under this brand.`)) return;
        run(() => deleteBrand(id), { success: "Brand deleted", onSuccess: () => router.push("/brands") });
      }}
    >
      <Trash2 /> Delete
    </Button>
  );
}
