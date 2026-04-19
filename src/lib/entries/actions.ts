"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity/actions";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface UpdateEntryInput {
  title?: string;
  description?: string | null;
  work_done?: string | null;
  learning?: string | null;
  next_day_plan?: string | null;
  mood?: string | null;
  productivity_score?: number | null;
  hours_worked?: number | null;
  status?: string;
  date?: string;
}

export async function updateEntry(entryId: string, patch: UpdateEntryInput) {
  const { supabase, user } = await requireUser();
  void user;

  // Access check via RLS — workspace editors can edit shared entries; private
  // entries remain editable only by the creator (enforced by RLS policy).
  const { data: existing } = await supabase
    .from("work_entries")
    .select("id, workspace_id, title")
    .eq("id", entryId)
    .maybeSingle();
  if (!existing) throw new Error("Entry not found or you don't have access");

  const { error } = await supabase
    .from("work_entries")
    .update(patch)
    .eq("id", entryId);
  if (error) throw new Error(error.message);

  await logActivity({
    workspaceId: (existing.workspace_id as string) ?? null,
    action: patch.title ? "renamed" : "edited",
    entityType: "entry",
    entityId: entryId,
    entityTitle: patch.title ?? (existing.title as string) ?? "Entry",
  });

  revalidatePath("/entries");
  revalidatePath(`/entries/${entryId}`);
  revalidatePath("/today");
  revalidatePath("/mindmaps");
}

export async function deleteEntry(entryId: string) {
  const { supabase, user } = await requireUser();
  void user;

  const { data: existing } = await supabase
    .from("work_entries")
    .select("id, workspace_id, title")
    .eq("id", entryId)
    .maybeSingle();
  if (!existing) throw new Error("Entry not found or you don't have access");

  const { error } = await supabase.from("work_entries").delete().eq("id", entryId);
  if (error) throw new Error(error.message);

  await logActivity({
    workspaceId: (existing.workspace_id as string) ?? null,
    action: "deleted",
    entityType: "entry",
    entityId: entryId,
    entityTitle: (existing.title as string) ?? "Entry",
  });

  revalidatePath("/entries");
  revalidatePath("/today");
  revalidatePath("/mindmaps");
}
