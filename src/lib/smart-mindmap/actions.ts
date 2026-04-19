"use server";

import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/logs/logger";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Set task.due_date (and optionally due_time) from a linked reminder. */
export async function setTaskDueFromReminder(
  taskId: string,
  date: string,
  time?: string
) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("tasks")
    .update({
      due_date: date,
      due_time: time || null,
    })
    .eq("id", taskId)
    .eq("user_id", user.id);

  if (error) {
    await logEvent({
      service: "other",
      level: "error",
      tag: "smart.setDue",
      message: `Failed to set due date: ${error.message}`,
      metadata: { taskId, date, time, code: error.code },
      userId: user.id,
    });
    throw new Error(error.message);
  }

  await logEvent({
    service: "other",
    level: "info",
    tag: "smart.setDue",
    message: `Set due date from reminder suggestion`,
    metadata: { taskId, date, time },
    userId: user.id,
  });

  revalidatePath("/mindmaps");
  revalidatePath("/tasks");
}

/** Mark an overdue reminder as completed. */
export async function completeReminder(reminderId: string) {
  const { supabase, user } = await requireUser();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("reminders")
    .update({ is_completed: true, completed_at: now })
    .eq("id", reminderId)
    .eq("user_id", user.id);

  if (error) {
    await logEvent({
      service: "other",
      level: "error",
      tag: "smart.completeReminder",
      message: `Failed to complete reminder: ${error.message}`,
      metadata: { reminderId, code: error.code },
      userId: user.id,
    });
    throw new Error(error.message);
  }

  await logEvent({
    service: "other",
    level: "info",
    tag: "smart.completeReminder",
    message: `Marked reminder as completed`,
    metadata: { reminderId },
    userId: user.id,
  });

  revalidatePath("/mindmaps");
  revalidatePath("/reminders");
}

/** Create a reminder from a task's due_date. */
export async function createReminderForTask(
  taskId: string,
  title: string,
  date: string,
  time: string,
  workspaceId: string | null
) {
  const { supabase, user } = await requireUser();

  const when = new Date(`${date}T${time || "09:00"}:00`);
  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      title,
      reminder_time: when.toISOString(),
      is_completed: false,
    })
    .select("id")
    .single();

  if (error) {
    await logEvent({
      service: "other",
      level: "error",
      tag: "smart.createReminder",
      message: `Failed to create reminder: ${error.message}`,
      metadata: { taskId, code: error.code },
      userId: user.id,
    });
    throw new Error(error.message);
  }

  await logEvent({
    service: "other",
    level: "info",
    tag: "smart.createReminder",
    message: `Created reminder from task`,
    metadata: { taskId, reminderId: data.id, title },
    userId: user.id,
  });

  revalidatePath("/mindmaps");
  revalidatePath("/reminders");
  return { id: data.id as string };
}

/** Create a work entry prefilled from a task. */
export async function createEntryForTask(
  taskId: string,
  title: string,
  date: string,
  workspaceId: string | null
) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("work_entries")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      date,
      title,
      work_done: "(from task suggestion)",
      status: "done",
    })
    .select("id")
    .single();

  if (error) {
    await logEvent({
      service: "other",
      level: "error",
      tag: "smart.createEntry",
      message: `Failed to create entry: ${error.message}`,
      metadata: { taskId, code: error.code },
      userId: user.id,
    });
    throw new Error(error.message);
  }

  await logEvent({
    service: "other",
    level: "info",
    tag: "smart.createEntry",
    message: `Created entry from task`,
    metadata: { taskId, entryId: data.id, title },
    userId: user.id,
  });

  revalidatePath("/mindmaps");
  revalidatePath("/entries");
  return { id: data.id as string };
}
