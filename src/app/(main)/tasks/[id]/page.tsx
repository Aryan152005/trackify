import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskActions } from "@/components/tasks/task-actions";
import { CollaborationToolbar } from "@/components/collaboration/collaboration-toolbar";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: task } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!task) notFound();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{task.title}</h1>
          <div className="mt-2 flex items-center gap-3">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
        </div>
        <Link href="/tasks">
          <Button variant="outline">Back to Tasks</Button>
        </Link>
      </div>

      <CollaborationToolbar
        entityType="task"
        entityId={params.id}
        entityTitle={task.title}
        showCursors={false}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.description && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Description</h3>
                  <p className="mt-1 text-zinc-900 dark:text-zinc-50">{task.description}</p>
                </div>
              )}

              {task.due_date && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Due Date</h3>
                  <p className="mt-1 text-zinc-900 dark:text-zinc-50">
                    {format(parseISO(task.due_date), "MMMM d, yyyy")}
                    {task.due_time && ` at ${task.due_time}`}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Created</h3>
                <p className="mt-1 text-zinc-900 dark:text-zinc-50">
                  {format(parseISO(task.created_at), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>

              {task.completed_at && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Completed</h3>
                  <p className="mt-1 text-zinc-900 dark:text-zinc-50">
                    {format(parseISO(task.completed_at), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <TaskActions task={task} />
        </div>
      </div>
    </div>
  );
}
