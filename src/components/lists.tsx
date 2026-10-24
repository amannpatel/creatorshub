import Link from "next/link";
import { EVENT_META, type CalendarEvent } from "@/lib/attention";
import { formatDateOnly, relativeDayLabel, timeAgo, type DateOnly } from "@/lib/dates";
import { TONE_DOT } from "@/lib/tone";
import type { Tone } from "@/lib/constants";
import type { Activity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EventList({ events, today, empty = "Nothing scheduled." }: { events: CalendarEvent[]; today: DateOnly; empty?: string }) {
  if (!events.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="divide-y">
      {events.map((e) => (
        <li key={e.id}>
          <Link href={e.href} className={cn("flex items-center gap-3 rounded-md py-2.5 hover:bg-muted/40", e.done && "opacity-50")}>
            <div className="w-12 shrink-0 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">{formatDateOnly(e.date, "weekday").split(",")[0]}</p>
              <p className="text-lg leading-none font-semibold tabular-nums">{Number(e.date.slice(8))}</p>
            </div>
            <span className={cn("h-8 w-1 shrink-0 rounded-full", TONE_DOT[EVENT_META[e.type].tone as Tone])} />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", e.done && "line-through")}>{e.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {EVENT_META[e.type].label} · {e.subtitle}
              </p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{relativeDayLabel(e.date, today)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ActivityFeed({ items, showCollab = true }: { items: (Activity & { collabLabel?: string | null })[]; showCollab?: boolean }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>;
  const now = new Date();
  return (
    <ol className="relative space-y-4 border-l pl-4">
      {items.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary/60" />
          <p className="text-sm">
            {showCollab && a.collabLabel && a.collaborationId && (
              <Link href={`/collaborations/${a.collaborationId}`} className="font-medium hover:underline">
                {a.collabLabel}:{" "}
              </Link>
            )}
            <span className={cn(a.kind === "note" && "whitespace-pre-wrap")}>{a.message}</span>
          </p>
          <p className="text-xs text-muted-foreground" title={a.createdAt}>
            {timeAgo(a.createdAt, now)}
          </p>
        </li>
      ))}
    </ol>
  );
}
