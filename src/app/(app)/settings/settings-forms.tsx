"use client";

import { useMemo, useState } from "react";
import { Loader2, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/collab/collab-form";
import { useServerAction } from "@/components/use-server-action";
import { clearSampleData, updateSettings } from "@/server/actions/settings";
import { changePassword, logout } from "@/server/actions/auth";
import { CURRENCIES } from "@/lib/money";
import type { UserSettings } from "@/lib/types";

export function PreferencesForm({ name, settings }: { name: string; settings: UserSettings }) {
  const { pending, run } = useServerAction();
  const [form, setForm] = useState({ name, ...settings });
  const zones = useMemo(() => {
    try {
      const list = Intl.supportedValuesOf("timeZone");
      return list.includes(settings.timezone) ? list : [settings.timezone, ...list];
    } catch {
      return [settings.timezone];
    }
  }, [settings.timezone]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateSettings(form), { success: "Settings saved" });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Your name" htmlFor="s-name">
          <Input id="s-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </FormField>
        <FormField label="Timezone" htmlFor="s-tz" hint="“Today”, deadlines and overdue checks use this timezone.">
          <NativeSelect id="s-tz" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Default currency" htmlFor="s-cur" hint="Used for new collaborations and dashboard totals.">
          <NativeSelect id="s-cur" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField label="Follow up after (days)" htmlFor="s-fu" hint="When you contact a brand, a follow-up is scheduled this many days later.">
          <Input id="s-fu" type="number" min={1} max={30} value={form.followUpDays} onChange={(e) => setForm({ ...form, followUpDays: Number(e.target.value) })} />
        </FormField>
        <FormField label="Default payment terms (days)" htmlFor="s-pt" hint="If no payment due date is given, it's set this many days after publishing/submission. 0 to disable.">
          <Input id="s-pt" type="number" min={0} max={180} value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: Number(e.target.value) })} />
        </FormField>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />} Save preferences
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const { pending, run } = useServerAction();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  return (
    <form
      className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => changePassword(form), { success: "Password changed — other devices were signed out", onSuccess: () => setForm({ currentPassword: "", newPassword: "" }) });
      }}
    >
      <FormField label="Current password" htmlFor="pw-cur">
        <Input id="pw-cur" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
      </FormField>
      <FormField label="New password" htmlFor="pw-new">
        <Input id="pw-new" type="password" autoComplete="new-password" minLength={10} required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
      </FormField>
      <Button type="submit" variant="outline" disabled={pending}>
        Change password
      </Button>
    </form>
  );
}

export function ClearSampleButton() {
  const { pending, run } = useServerAction();
  return (
    <Button
      variant="destructive"
      disabled={pending}
      onClick={() => {
        if (!confirm("Remove all sample records created by the seed script? Your real data is not affected.")) return;
        run(() => clearSampleData(), { onSuccess: (r) => toast.success(`Removed ${r.data.removed} sample records`) });
      }}
    >
      <Trash2 /> Remove sample data
    </Button>
  );
}

export function SignOutButton() {
  return (
    <Button variant="outline" onClick={() => void logout()}>
      <LogOut /> Sign out
    </Button>
  );
}
