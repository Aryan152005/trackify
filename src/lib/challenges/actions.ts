"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type {
  Challenge, ChallengeDay, ChallengeMode, HabitDay, KanbanDay, RoadmapDay,
} from "./types";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

function seedDays(mode: ChallengeMode, n: number): ChallengeDay[] {
  return Array.from({ length: n }, () => {
    if (mode === "habit") return { done: false } as HabitDay;
    if (mode === "kanban") return { tasks: [] } as KanbanDay;
    return { goals: [], done: false } as RoadmapDay;
  });
}

export async function createChallenge(args: {
  mode: ChallengeMode;
  title: string;
  description?: string;
  durationDays?: number;
  workspaceId?: string | null;
}): Promise<Challenge> {
  const { supabase, user } = await requireUser();
  const days = seedDays(args.mode, args.durationDays ?? 21);
  const { data, error } = await supabase
    .from("challenges")
    .insert({
      user_id: user.id,
      workspace_id: args.workspaceId ?? null,
      mode: args.mode,
      title: args.title.trim() || "Untitled challenge",
      description: args.description?.trim() || null,
      duration_days: args.durationDays ?? 21,
      days,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/challenges");
  return data as Challenge;
}

export async function listChallenges(): Promise<Challenge[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("challenges")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  return (data ?? []) as Challenge[];
}

export async function getChallenge(id: string): Promise<Challenge | null> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  return (data as Challenge | null) ?? null;
}

export async function updateDay(challengeId: string, dayIndex: number, payload: Partial<ChallengeDay>) {
  const { supabase } = await requireUser();
  const { data: row, error: fetchError } = await supabase
    .from("challenges").select("days, duration_days").eq("id", challengeId).single();
  if (fetchError || !row) throw new Error(fetchError?.message ?? "Not found");
  if (dayIndex < 0 || dayIndex >= (row.duration_days as number)) throw new Error("Day index out of range");

  const days = (row.days as ChallengeDay[]).slice();
  days[dayIndex] = { ...(days[dayIndex] as object), ...(payload as object) } as ChallengeDay;

  const { error } = await supabase
    .from("challenges")
    .update({ days, updated_at: new Date().toISOString() })
    .eq("id", challengeId);
  if (error) throw new Error(error.message);
  revalidatePath(`/challenges/${challengeId}`);
  revalidatePath("/challenges");
  revalidatePath("/dashboard");
}

export async function archiveChallenge(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("challenges").update({ is_archived: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/challenges");
}

export async function deleteChallenge(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("challenges").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/challenges");
}

export async function renameChallenge(id: string, title: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("challenges")
    .update({ title: title.trim() || "Untitled", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/challenges/${id}`);
}

export type { Challenge, ChallengeDay, ChallengeMode, ChallengeTask, HabitDay, KanbanDay, RoadmapDay } from "./types";
