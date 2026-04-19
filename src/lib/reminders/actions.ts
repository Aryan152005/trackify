"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { istLocalToUtcISO } from "@/lib/utils/datetime";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface ReminderUpdateInput {
  title?: string;
  description?: string | null;
  /** Datetime-local string ("YYYY-MM-DDTHH:MM") interpreted as IST. */
  reminder_time_local?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string | null;
  is_completed?: boolean;
}

export async function updateReminder(reminderId: string, input: ReminderUpdateInput) {
  const { supabase, user } = await requireUser();

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.reminder_time_local !== undefined) {
    patch.reminder_time = istLocalToUtcISO(input.reminder_time_local);
    // If time moved forward/back, clear notified_at so cron re-evaluates.
    patch.notified_at = null;
  }
  if (input.is_recurring !== undefined) patch.is_recurring = input.is_recurring;
  if (input.recurrence_pattern !== undefined) patch.recurrence_pattern = input.recurrence_pattern;
  if (input.is_completed !== undefined) {
    patch.is_completed = input.is_completed;
    patch.completed_at = input.is_completed ? new Date().toISOString() : null;
  }

  const { error } = await supabase
    .from("reminders")
    .update(patch)
    .eq("id", reminderId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/mindmaps");
}

export async function deleteReminder(reminderId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("reminders")
    .delete()
    .eq("id", reminderId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/mindmaps");
}

/**
 * Create a reminder linked to an entity (typically a task). Used by the
 * "Set reminder" button on task detail pages.
 */
export async function createReminderForEntity(input: {
  title: string;
  description?: string | null;
  reminder_time_local: string;
  workspace_id: string | null;
  entity_type?: string;
  entity_id?: string;
}) {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("reminders")
    .insert({
      user_id: user.id,
      workspace_id: input.workspace_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      reminder_time: istLocalToUtcISO(input.reminder_time_local),
      is_recurring: false,
      is_completed: false,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  revalidatePath("/today");
  revalidatePath("/mindmaps");
  if (input.entity_type === "task" && input.entity_id) {
    revalidatePath(`/tasks/${input.entity_id}`);
  }

  return data as { id: string };
}
