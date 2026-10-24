import { requireUser } from "@/server/auth/session";
import { listTasks } from "@/server/queries";
import { PageHeader } from "@/components/common";
import { NewTaskButton } from "@/components/quick-actions";
import { TasksView } from "./tasks-view";

export const metadata = { title: "Tasks" };

export default async function TasksPage() {
  const user = await requireUser();
  const { tasks, today } = await listTasks(user);
  return (
    <div>
      <PageHeader title="Tasks & reminders" description="Your own to-dos. Collaboration reminders are generated automatically on the dashboard." actions={<NewTaskButton />} />
      <TasksView tasks={tasks} today={today} />
    </div>
  );
}
