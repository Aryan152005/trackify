import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { Plus } from "lucide-react";

export default async function TasksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const workspaceId = await getActiveWorkspaceId();

  const tasksQuery = supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id)
    .order("due_date", { ascending: true })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: tasks } = workspaceId
    ? await tasksQuery.eq("workspace_id", workspaceId)
    : await tasksQuery;

  const pendingTasks = tasks?.filter((t) => t.status === "pending" || t.status === "in-progress") || [];
  const completedTasks = tasks?.filter((t) => t.status === "done") || [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">Your Tasks</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">Everything on your plate, organized and prioritized</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/boards">
            <Button variant="outline">
              Boards
            </Button>
          </Link>
          <Link href="/tasks/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </Link>
        </div>
      </div>

      {/* Pending Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Tasks ({pendingTasks.length})</CardTitle>
          <CardDescription>Tasks that need your attention</CardDescription>
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
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</h3>
                      <TaskStatusBadge status={task.status} />
                      <TaskPriorityBadge priority={task.priority} />
                    </div>
                    {task.description && (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{task.description}</p>
                    )}
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
            <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">No pending tasks. Great job! 🎉</p>
          )}
        </CardContent>
      </Card>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Completed Tasks ({completedTasks.length})</CardTitle>
            <CardDescription>Tasks you&apos;ve finished</CardDescription>
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
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100 line-through">{task.title}</h3>
                      <TaskStatusBadge status={task.status} />
                    </div>
                    {task.completed_at && (
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        Completed: {format(parseISO(task.completed_at), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
