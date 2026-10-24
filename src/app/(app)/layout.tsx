import { requireUser } from "@/server/auth/session";
import { getAttentionCount } from "@/server/queries";
import { AppShell } from "@/components/shell/app-shell";
import { todayIn } from "@/lib/dates";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const reminders = await getAttentionCount(user);
  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      today={todayIn(user.settings.timezone)}
      currency={user.settings.currency}
      reminders={reminders}
    >
      {children}
    </AppShell>
  );
}
