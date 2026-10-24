"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { useAppUI } from "@/components/app-ui";
import { useServerAction } from "@/components/use-server-action";
import { FormField } from "@/components/collab/collab-form";
import { createTask, updateTask } from "@/server/actions/tasks";
import { listCollabOptions } from "@/server/actions/lookup";
import { PRIORITY_META, TASK_PRIORITIES, type TaskPriority } from "@/lib/constants";
import { addDays } from "@/lib/dates";
import type { CollabOption } from "@/lib/types";

export function TaskDialog() {
  const ui = useAppUI();
  const { open, task, collaborationId } = ui.task;
  const { pending, run } = useServerAction();
  const [options, setOptions] = useState<CollabOption[]>([]);
  const [form, setForm] = useState({ title: "", dueDate: "", priority: "medium" as TaskPriority, notes: "", collaborationId: "" });

  useEffect(() => {
    if (!open) return;
    setForm({
      title: task?.title ?? "",
      dueDate: task?.dueDate ?? (task ? "" : ui.today),
      priority: task?.priority ?? "medium",
      notes: task?.notes ?? "",
      collaborationId: collaborationId ?? "",
    });
    listCollabOptions().then(setOptions).catch(() => setOptions([]));
  }, [open, task, collaborationId, ui.today]);

  const quickDates = [
    { label: "Today", value: ui.today },
    { label: "Tomorrow", value: addDays(ui.today, 1) },
    { label: "In 3 days", value: addDays(ui.today, 3) },
    { label: "Next week", value: addDays(ui.today, 7) },
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() => (task ? updateTask(task.id, form) : createTask(form)), {
      success: task ? "Task updated" : "Task added",
      onSuccess: () => ui.close("task"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && ui.close("task")}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FormField label="Task *" htmlFor="task-title">
            <Input id="task-title" autoFocus required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Send script draft to Nike" />
          </FormField>
          <FormField label="Due" htmlFor="task-due">
            <Input id="task-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {quickDates.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setForm({ ...form, dueDate: q.value })}
                  className={`h-6 rounded-full border px-2 text-xs ${form.dueDate === q.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {q.label}
                </button>
              ))}
              <button type="button" onClick={() => setForm({ ...form, dueDate: "" })} className="h-6 rounded-full border px-2 text-xs hover:bg-muted">
                No date
              </button>
            </div>
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Priority" htmlFor="task-priority">
              <NativeSelect id="task-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Collaboration" htmlFor="task-collab">
              <NativeSelect id="task-collab" value={form.collaborationId} onChange={(e) => setForm({ ...form, collaborationId: e.target.value })}>
                <option value="">None (personal)</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField label="Notes" htmlFor="task-notes">
            <Textarea id="task-notes" rows={2} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => ui.close("task")}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !form.title.trim()}>
              {pending && <Loader2 className="animate-spin" />}
              {task ? "Save" : "Add task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
