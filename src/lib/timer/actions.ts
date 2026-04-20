"use server";

import { createClient } from "@/lib/supabase/server";

export interface TimerSessionRow {
  id: string;
  duration_seconds: number;
  started_at: string;
  ended_at: string | null;
  title: string | null;
}

export async function getRecentTimerSessions(limit = 10): Promise<TimerSessionRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("timer_sessions")
    .select("id, duration_seconds, started_at, ended_at, title")
    .eq("user_id", user.id)
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as TimerSessionRow[];
}

/** Update title of an active/existing session (before or after it's stopped). */
export async function updateTimerSessionTitle(sessionId: string, title: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("timer_sessions")
    .update({ title: title.trim() || null })
    .eq("id", sessionId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export async function getTodayTimerTotal(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("timer_sessions")
    .select("duration_seconds")
    .eq("user_id", user.id)
    .gte("started_at", startOfDay.toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, r) => sum + ((r.duration_seconds as number) ?? 0), 0);
}

/**
 * Return a map taskId → count of completed timer sessions. Used on the
 * tasks list to render "🍅 N" chips. Counts only sessions with a real
 * ended_at (abandoned sessions don't count) and duration ≥ 5 min —
 * shorter bursts are likely false starts. No workspace filter;
 * timer_sessions is per-user by design.
 */
export async function getPomodoroCounts(
  taskIds: string[],
): Promise<Record<string, number>> {
  if (taskIds.length === 0) return {};
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("timer_sessions")
    .select("task_id, duration_seconds, ended_at")
    .eq("user_id", user.id)
    .in("task_id", taskIds)
    .not("ended_at", "is", null)
    .gte("duration_seconds", 5 * 60);
  if (error) return {};

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.task_id as string | null;
    if (!id) continue;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}
