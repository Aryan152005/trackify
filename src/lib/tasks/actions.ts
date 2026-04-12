"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TaskPriority, TaskStatus } from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function updateTaskStatus(taskId: string, status: TaskStatus) {
  const { supabase, user } = await requireUser();
  const patch: Record<string, unknown> = { status };
  if (status === "done") patch.completed_at = new Date().toISOString();
  else patch.completed_at = null;
  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

export async function updateTask(
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    due_date?: string | null;
    due_time?: string | null;
  }
) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("tasks").update(patch).eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
}

export async function deleteTask(taskId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
