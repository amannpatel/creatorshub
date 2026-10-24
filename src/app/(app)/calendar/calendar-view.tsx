"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EVENT_META, type CalendarEvent, type EventType } from "@/lib/attention";
import { addMonths, formatDateOnly, relativeDayLabel, type DateOnly } from "@/lib/dates";
import { TONE_BADGE, TONE_DOT } from "@/lib/tone";
import type { Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({
  events,
  grid,
  anchor,
  today,
}: {
  events: CalendarEvent[];
  grid: DateOnly[];
  anchor: DateOnly;
  today: DateOnly;
}) {
  const [view, setView] = useState<"month" | "agenda">("month");
  const [selected, setSelected] = useState<DateOnly | null>(null);
  const [hidden, setHidden] = useState<EventType[]>([]);
  const month = anchor.slice(0, 7);
  const visible = events.filter((e) => !hidden.includes(e.type));
  const byDay = new Map<DateOnly, CalendarEvent[]>();
  for (const e of visible) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const agenda = visible.filter((e) => e.date.startsWith(month) && (!selected || e.date === selected));
  const types = Object.keys(EVENT_META) as EventType[];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={`/calendar?m=${addMonths(anchor, -1).slice(0, 7)}`} aria-label="Previous month" />}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="icon" nativeButton={false} render={<Link href={`/calendar?m=${addMonths(anchor, 1).slice(0, 7)}`} aria-label="Next month" />}>
            <ChevronRight />
          </Button>
        </div>
        <h2 className="text-lg font-semibold">{formatDateOnly(anchor, "month")}</h2>
        {!today.startsWith(month) && (
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/calendar" />}>
            Today
          </Button>
        )}
        <div className="ml-auto flex rounded-lg border p-0.5">
          {(["month", "agenda"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn("h-7 rounded-md px-3 text-sm capitalize", view === v ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => {
          const off = hidden.includes(t);
          return (
            <button
              key={t}
              type="button"
              aria-pressed={!off}
              onClick={() => setHidden(off ? hidden.filter((x) => x !== t) : [...hidden, t])}
              className={cn("flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs", off && "opacity-40")}
            >
              <span className={cn("size-2 rounded-full", TONE_DOT[EVENT_META[t].tone as Tone])} />
              {EVENT_META[t].label}
            </button>
          );
        })}
      </div>

      {view === "month" && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {grid.map((day) => {
              const list = byDay.get(day) ?? [];
              const inMonth = day.startsWith(month);
              const isToday = day === today;
              const isSelected = day === selected;
              return (
                <div
                  key={day}
                  onClick={() => setSelected(isSelected ? null : day)}
                  className={cn(
                    "flex min-h-14 cursor-pointer flex-col gap-1 border-r border-b p-1 text-left align-top transition-colors hover:bg-muted/40 sm:min-h-28 sm:p-1.5 [&:nth-child(7n)]:border-r-0",
                    !inMonth && "bg-muted/20 text-muted-foreground/60",
                    isSelected && "bg-accent/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelected(isSelected ? null : day);
                    }}
                    aria-label={`${formatDateOnly(day, "long")}: ${list.length} items`}
                    aria-pressed={isSelected}
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isToday && "bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>
                  <span className="flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 4).map((e) => (
                      <span key={e.id} className={cn("size-1.5 rounded-full", TONE_DOT[EVENT_META[e.type].tone as Tone], e.done && "opacity-40")} />
                    ))}
                  </span>
                  <span className="hidden w-full flex-col gap-0.5 sm:flex">
                    {list.slice(0, 3).map((e) => (
                      <Link
                        key={e.id}
                        href={e.href}
                        onClick={(ev) => ev.stopPropagation()}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[11px] leading-tight ring-1 ring-inset",
                          TONE_BADGE[EVENT_META[e.type].tone as Tone],
                          e.done && "line-through opacity-50",
                        )}
                        title={`${EVENT_META[e.type].label}: ${e.title} · ${e.subtitle}`}
                      >
                        {e.title}
                      </Link>
                    ))}
                    {list.length > 3 && <span className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} more</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{selected ? formatDateOnly(selected, "long") : `Agenda · ${formatDateOnly(anchor, "month")}`}</h3>
          {selected && (
            <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>
              Show whole month
            </Button>
          )}
        </div>
        {agenda.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing scheduled{selected ? " on this day" : " this month"}.</p>
        ) : (
          <ul className="divide-y">
            {agenda.map((e) => (
              <li key={e.id}>
                <Link href={e.href} className={cn("flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40", e.done && "opacity-50")}>
                  <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatDateOnly(e.date, "weekday")}</span>
                  <span className={cn("size-2 shrink-0 rounded-full", TONE_DOT[EVENT_META[e.type].tone as Tone])} />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm", e.done && "line-through")}>{e.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {EVENT_META[e.type].label} · {e.subtitle}
                    </span>
                  </span>
                  {!e.done && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{relativeDayLabel(e.date, today)}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
