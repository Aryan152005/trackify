import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TaskRow } from "@/components/tasks/task-row";
import { Plus, CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

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
      <PageHeader
        title="Your Tasks"
        description="Everything on your plate, organized and prioritized"
        actions={
          <>
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
          </>
        }
      />

      {(!tasks || tasks.length === 0) ? (
        <EmptyState
          icon={<CheckSquare className="h-6 w-6" />}
          title="No tasks yet"
          description="Create your first task to start tracking work."
          actionLabel="New Task"
          actionHref="/tasks/new"
        />
      ) : (
      <>
      {/* Pending Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Tasks ({pendingTasks.length})</CardTitle>
          <CardDescription>Tasks that need your attention</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingTasks.length > 0 ? (
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
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
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <TaskRow key={task.id} task={task} completed />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}
    </div>
  );
}
