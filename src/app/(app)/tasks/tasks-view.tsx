"use client";

import { useState } from "react";
import { CheckSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common";
import { TaskRows } from "@/components/collab/collab-detail";
import { useAppUI } from "@/components/app-ui";
import { useServerAction } from "@/components/use-server-action";
import { createTask } from "@/server/actions/tasks";
import { addDays, type DateOnly } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "today" | "upcoming" | "overdue" | "someday" | "completed";

export function TasksView({ tasks, today }: { tasks: Task[]; today: DateOnly }) {
  const ui = useAppUI();
  const { pending, run } = useServerAction();
  const [title, setTitle] = useState("");
  const open = tasks.filter((t) => !t.done);
  const groups: Record<View, Task[]> = {
    overdue: open.filter((t) => t.dueDate && t.dueDate < today),
    today: open.filter((t) => t.dueDate === today),
    upcoming: open.filter((t) => t.dueDate && t.dueDate > today),
    someday: open.filter((t) => !t.dueDate),
    completed: tasks.filter((t) => t.done),
  };
  const [view, setView] = useState<View>(groups.overdue.length ? "overdue" : "today");

  const tabs: { id: View; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "overdue", label: "Overdue" },
    { id: "upcoming", label: "Upcoming" },
    { id: "someday", label: "No date" },
    { id: "completed", label: "Completed" },
  ];
  const shown = groups[view];

  return (
    <div className="space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const dueDate = view === "upcoming" ? addDays(today, 1) : view === "someday" ? "" : today;
          run(() => createTask({ title, dueDate, priority: "medium" }), { success: "Task added", onSuccess: () => setTitle("") });
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={`Quick add a task for ${view === "upcoming" ? "tomorrow" : view === "someday" ? "someday" : "today"}…`} aria-label="New task" />
        <Button type="submit" disabled={pending || !title.trim()}>
          <Plus /> Add
        </Button>
        <Button type="button" variant="outline" onClick={() => ui.openTask()} className="hidden sm:inline-flex">
          More options
        </Button>
      </form>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={view === t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
              view === t.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              t.id === "overdue" && groups.overdue.length > 0 && view !== t.id && "border-red-500/40 text-red-600 dark:text-red-400",
            )}
          >
            {t.label}
            <span className="text-xs opacity-70">{groups[t.id].length}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card px-4">
        {shown.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            className="my-4 border-0"
            title={view === "overdue" ? "Nothing overdue" : view === "completed" ? "No completed tasks yet" : "No tasks here"}
            description={view === "today" ? "Reminders for replies, deliverables and payments appear on the dashboard automatically — add your own tasks here." : undefined}
          />
        ) : (
          <TaskRows tasks={shown} today={today} showCollab />
        )}
      </div>
    </div>
  );
}
