import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { getPersonalTasks } from "@/lib/personal/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { PageHeader } from "@/components/ui/page-header";
import { CheckSquare, Lock } from "lucide-react";

export default async function PersonalTasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="My Tasks"
          description="Please select or create a workspace first."
        />
      </div>
    );
  }

  const tasks = await getPersonalTasks(workspaceId);

  const pendingTasks =
    tasks?.filter(
      (t) => t.status === "pending" || t.status === "in-progress"
    ) || [];
  const completedTasks = tasks?.filter((t) => t.status === "done") || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Tasks"
        description="Your private tasks — only visible to you"
        actions={<Lock className="h-5 w-5 text-amber-500" />}
      />

      {/* Pending */}
      <Card>
        <CardHeader>
          <CardTitle>Pending ({pendingTasks.length})</CardTitle>
          <CardDescription>Private tasks that need attention</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingTasks.length > 0 ? (
            <div className="space-y-3">
              {pendingTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                        {task.title}
                      </h3>
                      <TaskStatusBadge status={task.status} />
                      <TaskPriorityBadge priority={task.priority} />
                    </div>
                    {task.due_date && (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Due: {format(parseISO(task.due_date), "MMM d, yyyy")}
                        {task.due_time && ` at ${task.due_time}`}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
              No pending private tasks.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Completed */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed ({completedTasks.length})</CardTitle>
            <CardDescription>Private tasks you have finished</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {completedTasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 opacity-60 transition hover:opacity-100 dark:border-zinc-800 dark:bg-zinc-800"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-zinc-900 line-through dark:text-zinc-100">
                        {task.title}
                      </h3>
                      <TaskStatusBadge status={task.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {(!tasks || tasks.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckSquare className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              No private tasks yet
            </h3>
            <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Go to Tasks and use the lock icon on any task to make it private.
              It will then appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
