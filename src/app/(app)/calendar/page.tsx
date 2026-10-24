import { requireUser } from "@/server/auth/session";
import { getCalendar } from "@/server/queries";
import { PageHeader } from "@/components/common";
import { CalendarView } from "./calendar-view";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const { m } = await searchParams;
  const data = await getCalendar(user, typeof m === "string" ? m : undefined);
  return (
    <div>
      <PageHeader title="Calendar" description="Deadlines, publishing dates, follow-ups, payments and tasks." />
      <CalendarView events={data.events} grid={data.grid} anchor={data.anchor} today={data.today} />
    </div>
  );
}
