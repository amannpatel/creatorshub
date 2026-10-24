import { Download } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { connectDB } from "@/server/db";
import { CollaborationModel } from "@/server/models";
import { PageHeader, Section } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ClearSampleButton, PasswordForm, PreferencesForm, SignOutButton } from "./settings-forms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireUser();
  await connectDB();
  const hasSample = !!(await CollaborationModel.exists({ userId: user.id, isSample: true }));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={user.email} actions={<SignOutButton />} />

      <Section title="Preferences">
        <PreferencesForm name={user.name} settings={user.settings} />
      </Section>

      <Section title="Reminders">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Reminders are <span className="font-medium text-foreground">in-app</span>: the dashboard&apos;s Today&apos;s Focus and the bell icon are recalculated every
            time you open the app, from your deadlines, follow-up dates, deliverables and payments.
          </p>
          <p>Push or email reminders while the app is closed are not set up yet — they would need a scheduled job (e.g. Vercel Cron) plus an email or push provider.</p>
        </div>
      </Section>

      <Section title="Your data">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<a href="/api/export?format=json" download />}>
              <Download /> Export everything (JSON)
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href="/api/export?format=csv" download />}>
              <Download /> Collaborations (CSV)
            </Button>
            <Button variant="outline" nativeButton={false} render={<a href="/api/export?format=payments-csv" download />}>
              <Download /> Payments (CSV)
            </Button>
          </div>
          {hasSample && (
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-amber-500/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">Sample data from the seed script is present (marked with a “Sample” badge).</p>
              <ClearSampleButton />
            </div>
          )}
        </div>
      </Section>

      <Section title="Security">
        <PasswordForm />
      </Section>
    </div>
  );
}
