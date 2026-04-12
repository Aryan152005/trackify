"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity/actions";
import type { TaskPriority, TaskStatus } from "@/lib/types/database";
import type { Label } from "@/lib/types/board";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

// Shared ownership check: fetches the task (scoped to the caller) and returns
// its workspace + title for downstream logging. Throws if not the caller's.
async function fetchOwnedTask(taskId: string) {
  const { supabase, user } = await requireUser();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, user_id, workspace_id, title, status")
    .eq("id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!task) throw new Error("Task not found or not yours");
  return { supabase, user, task };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { supabase, user, task } = await fetchOwnedTask(taskId);
  const patch: Record<string, unknown> = { status };
  if (status === "done") patch.completed_at = new Date().toISOString();
  else patch.completed_at = null;
  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await logActivity({
    workspaceId: (task.workspace_id as string) ?? null,
    action: status === "done" ? "edited" : "edited",
    entityType: "task",
    entityId: taskId,
    entityTitle: (task.title as string) ?? "Task",
    metadata: { status },
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath("/dashboard");
}

export async function createTask(input: {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  due_date?: string | null;
  due_time?: string | null;
  workspaceId: string | null;
  labels?: Label[];
}) {
  const { supabase, user } = await requireUser();
  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      workspace_id: input.workspaceId,
      title: input.title.trim(),
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      status: input.status ?? "pending",
      due_date: input.due_date ?? null,
      due_time: input.due_time ?? null,
      labels: input.labels ?? [],
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Auto-create a matching reminder when a due date is provided — uses
  // the reminders table the daily cron already watches.
  if (input.due_date) {
    try {
      const whenIso = new Date(`${input.due_date}T${input.due_time ?? "09:00"}:00`).toISOString();
      await supabase.from("reminders").insert({
        user_id: user.id,
        workspace_id: input.workspaceId,
        title: `Task due: ${input.title.trim()}`,
        description: input.description ?? null,
        reminder_time: whenIso,
        is_recurring: false,
        is_completed: false,
      });
    } catch {
      /* reminder is best-effort — don't fail task creation */
    }
  }

  await logActivity({
    workspaceId: input.workspaceId,
    action: "created",
    entityType: "task",
    entityId: task.id as string,
    entityTitle: input.title.trim(),
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  return task as { id: string };
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    due_date?: string | null;
    due_time?: string | null;
    labels?: Label[];
  }
) {
  const { supabase, user, task } = await fetchOwnedTask(taskId);
  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await logActivity({
    workspaceId: (task.workspace_id as string) ?? null,
    action: patch.title && patch.title !== task.title ? "renamed" : "edited",
    entityType: "task",
    entityId: taskId,
    entityTitle: patch.title ?? (task.title as string) ?? "Task",
  });

  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
}

export async function deleteTask(taskId: string) {
  const { supabase, user, task } = await fetchOwnedTask(taskId);
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  await logActivity({
    workspaceId: (task.workspace_id as string) ?? null,
    action: "deleted",
    entityType: "task",
    entityId: taskId,
    entityTitle: (task.title as string) ?? "Task",
  });

  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
