import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { getUserPreferences } from "@/lib/preferences/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TasksGroups } from "@/components/tasks/tasks-groups";
import { Plus, CheckSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SharedSection } from "@/components/collaboration/shared-section";
import { getPomodoroCounts } from "@/lib/timer/actions";
import type { Task } from "@/lib/types/database";

export default async function TasksPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();
  if (!profile) redirect("/onboarding");

  // Honour defaultTaskView pref: Kanban users land on /boards when they
  // click "Tasks" in the nav. `?view=list` on the URL explicitly opts into
  // the list regardless of preference (for bookmarked links etc.).
  const resolvedSearch = (await searchParams) ?? {};
  if (resolvedSearch.view !== "list") {
    const prefs = await getUserPreferences();
    if (prefs.defaultTaskView === "board") redirect("/boards");
  }

  const workspaceId = await getActiveWorkspaceId();

  // Workspace-wide task list — RLS handles access (workspace-editor or owner
  // for private items). Dropping .eq("user_id", user.id) is intentional:
  // collaborators in the same workspace now see each other's non-private tasks.
  const tasksQuery = supabase
    .from("tasks")
    .select("*")
    .order("due_date", { ascending: true })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: tasks } = workspaceId
    ? await tasksQuery.eq("workspace_id", workspaceId)
    : await tasksQuery.eq("user_id", user.id);

  // 🍅 chip data — one batch fetch for every visible task so each row
  // doesn't do its own round-trip. Safe if empty (zero taskIds short-
  // circuits inside getPomodoroCounts).
  const taskIds = (tasks ?? []).map((t) => t.id as string);
  const pomodoroCounts = await getPomodoroCounts(taskIds).catch(() => ({} as Record<string, number>));

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
          hint="Tasks are your working list — start with one thing you're doing right now and watch your day come together."
          actionLabel="New Task"
          actionHref="/tasks/new"
          secondaryLabel="Try a board"
          secondaryHref="/boards"
        />
      ) : (
        <TasksGroups tasks={tasks as Task[]} pomodoroCounts={pomodoroCounts} />
      )}

      <SharedSection entityType="task" />
    </div>
  );
}
