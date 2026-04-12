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
