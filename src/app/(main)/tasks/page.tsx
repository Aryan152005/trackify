import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TasksGroups } from "@/components/tasks/tasks-groups";
import { Plus, CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SharedSection } from "@/components/collaboration/shared-section";
import type { Task } from "@/lib/types/database";

export default async function TasksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Tasks"
        description="Everything on your plate — grouped by when they're due."
        actions={
          <>
            <Link href="/boards">
              <Button variant="outline">Boards</Button>
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

      {!tasks || tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="h-6 w-6" />}
          title="No tasks yet"
          description="Create your first task to start tracking work."
          actionLabel="New Task"
          actionHref="/tasks/new"
        />
      ) : (
        <TasksGroups tasks={tasks as Task[]} />
      )}

      <SharedSection entityType="task" />
    </div>
  );
}
