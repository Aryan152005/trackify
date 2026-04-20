import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect, notFound } from "next/navigation";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { TaskStatusBadge } from "@/components/tasks/task-status-badge";
import { TaskPriorityBadge } from "@/components/tasks/task-priority-badge";
import { TaskActions } from "@/components/tasks/task-actions";
import { TaskEstimateCard } from "@/components/tasks/task-estimate-card";
import { TaskReminderButton } from "@/components/tasks/task-reminder-button";
import { SubtaskList } from "@/components/tasks/subtask-list";
import { TaskDependencies } from "@/components/tasks/task-dependencies";
import { PrivateToggle } from "@/components/personal/private-toggle";
import { CollaborationToolbar } from "@/components/collaboration/collaboration-toolbar";
import { RealtimeRefresh } from "@/components/shared/realtime-refresh";
import { AlertTriangle } from "lucide-react";

export default async function TaskDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();

  // Access control sits at RLS — a workspace editor (or the task owner for
  // private tasks) can open it. No explicit user_id gate here so a teammate
  // can open a shared task. If workspaceId is set we scope to it as a sanity
  // check; otherwise fall back to owner-only (user viewing without a ws).
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("id", params.id);
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  else query = query.eq("user_id", user.id);
  const { data: task } = await query.maybeSingle();

  if (!task) notFound();

  const isOverdue =
    task.status !== "done" &&
    task.due_date &&
    isBefore(parseISO(task.due_date), startOfDay(new Date()));

  return (
    <div className="space-y-6">
      <RealtimeRefresh table="tasks" id={params.id} />
      <PageHeader
        title={task.title}
        backHref="/tasks"
        backLabel="Back to Tasks"
        actions={
          <>
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            <PrivateToggle
              entityType="tasks"
              entityId={task.id}
              isPrivate={!!task.is_private}
            />
          </>
        }
      />

      <CollaborationToolbar
        entityType="task"
        entityId={params.id}
        entityTitle={task.title}
        showCursors={false}
      />

      {isOverdue && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
        >
          <AlertTriangle className="h-4 w-4" />
          This task was due on {format(parseISO(task.due_date as string), "MMMM d, yyyy")} — it&apos;s overdue.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.description && (
                <Field label="Description">
                  <p className="whitespace-pre-wrap text-zinc-900 dark:text-zinc-50">{task.description}</p>
                </Field>
              )}
              {task.due_date && (
                <Field label="Due">
                  <p className="text-zinc-900 dark:text-zinc-50">
                    {format(parseISO(task.due_date), "MMMM d, yyyy")}
                    {task.due_time && ` at ${task.due_time}`}
                  </p>
                </Field>
              )}
              <Field label="Created">
                <p className="text-zinc-900 dark:text-zinc-50">
                  {format(parseISO(task.created_at), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </Field>
              {task.completed_at && (
                <Field label="Completed">
                  <p className="text-zinc-900 dark:text-zinc-50">
                    {format(parseISO(task.completed_at), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                </Field>
              )}
            </CardContent>
          </Card>

          {workspaceId && (
            <>
              <SubtaskList parentTaskId={params.id} workspaceId={workspaceId} />
              <TaskDependencies taskId={params.id} workspaceId={workspaceId} />
            </>
          )}
        </div>

        <div className="space-y-4">
          <TaskActions task={task} />
          <TaskEstimateCard task={task} />
          <TaskReminderButton
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              due_date: task.due_date,
              due_time: task.due_time,
              workspace_id: task.workspace_id,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</h3>
      <div className="mt-1">{children}</div>
    </div>
  );
}
