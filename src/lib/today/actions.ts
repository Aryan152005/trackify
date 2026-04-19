"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { revalidatePath } from "next/cache";
import { istDateKey, istLocalToUtcISO, istDateTimeToUtcISO } from "@/lib/utils/datetime";
import { createTask } from "@/lib/tasks/actions";
import { createReminderForEntity } from "@/lib/reminders/actions";
import { createEvent } from "@/lib/calendar/actions";
import { parseCapture, type ParsedKind } from "@/lib/today/parse";

/**
 * Thin orchestration layer used by the /today page. Wraps existing server
 * actions so the page stays focused on presenting "what matters now".
 */

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface TodaySnapshot {
  /** Tasks due today (IST) or overdue + still open. Capped at 5. */
  focusTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    due_time: string | null;
    is_overdue: boolean;
    is_private: boolean;
  }>;
  /** Reminders firing today (per-user). Capped at 3. */
  todaysReminders: Array<{
    id: string;
    title: string;
    reminder_time: string;
    is_private: boolean;
  }>;
  /** Calendar events on today's IST date. Capped at 3. */
  todaysEvents: Array<{
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    color: string | null;
    location: string | null;
  }>;
  /** Upcoming tasks — next 3 due between tomorrow and 7 days out. */
  upcomingTasks: Array<{
    id: string;
    title: string;
    due_date: string;
    due_time: string | null;
    priority: string;
  }>;
  /** Today's work entry (if any) so the page can link to it. */
  entryToday: {
    id: string;
    title: string;
    work_done: string | null;
  } | null;
  /** Completed-today tasks — useful for "how it went" prompts + celebratory feel. */
  completedTasksToday: Array<{ id: string; title: string }>;
  /** Top-level stats for the stat strip. */
  stats: {
    /** Consecutive days with at least one work entry, ending today. */
    streak: number;
    /** Tasks completed in the last 24h (IST). */
    tasksDoneToday: number;
    /** Average productivity score for the last 7 IST days of entries. */
    weekScoreAvg: number | null;
    /** Focus minutes (from timer_sessions) tracked today IST. */
    focusMinutesToday: number;
  };
  /** Optional daily-motivation quote if the user has one for today. */
  motivation: { quote: string | null; reflection: string | null } | null;
}

export async function getTodaySnapshot(): Promise<TodaySnapshot> {
  const { supabase, user } = await requireUser();
  const workspaceId = await getActiveWorkspaceId();
  const today = istDateKey(new Date());

  // Focus tasks: anything due today OR overdue-and-still-open, scoped to the
  // current user. RLS is workspace-aware already; we filter by user_id so this
  // page feels personal even inside shared workspaces.
  let tasksQ = supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, due_time, is_private")
    .eq("user_id", user.id)
    .neq("status", "done")
    .not("due_date", "is", null)
    .lte("due_date", today)
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: true })
    .limit(10);
  if (workspaceId) tasksQ = tasksQ.eq("workspace_id", workspaceId);
  const { data: tasks } = await tasksQ;

  // Reminders firing today (IST day bounds as UTC)
  const startIso = istLocalToUtcISO(`${today}T00:00`);
  const endIso = istLocalToUtcISO(`${today}T23:59`);
  let remQ = supabase
    .from("reminders")
    .select("id, title, reminder_time, is_private")
    .eq("user_id", user.id)
    .eq("is_completed", false)
    .gte("reminder_time", startIso)
    .lte("reminder_time", endIso)
    .order("reminder_time", { ascending: true })
    .limit(3);
  if (workspaceId) remQ = remQ.eq("workspace_id", workspaceId);
  const { data: reminders } = await remQ;

  // Today's work entry (if one exists for this IST day)
  let entryQ = supabase
    .from("work_entries")
    .select("id, title, work_done")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();
  if (workspaceId) entryQ = supabase
    .from("work_entries")
    .select("id, title, work_done")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .eq("date", today)
    .maybeSingle();
  const { data: entry } = await entryQ;

  // Completed-today tasks (so we can offer: "log what you did today?")
  let doneQ = supabase
    .from("tasks")
    .select("id, title, completed_at")
    .eq("user_id", user.id)
    .eq("status", "done")
    .gte("completed_at", startIso)
    .lte("completed_at", endIso)
    .order("completed_at", { ascending: false })
    .limit(5);
  if (workspaceId) doneQ = doneQ.eq("workspace_id", workspaceId);
  const { data: done } = await doneQ;

  // Calendar events falling anywhere inside today's IST window.
  const eventsQ = workspaceId
    ? supabase
        .from("calendar_events")
        .select("id, title, start_time, end_time, color, location")
        .eq("workspace_id", workspaceId)
        .gte("start_time", startIso)
        .lte("start_time", endIso)
        .order("start_time", { ascending: true })
        .limit(3)
    : Promise.resolve({ data: [] as Array<{ id: string; title: string; start_time: string; end_time: string; color: string | null; location: string | null }> });
  const { data: events } = await eventsQ;

  // Next 3 tasks due between tomorrow and +7 days, scoped to this user.
  const tomorrowDate = new Date(new Date(`${today}T00:00:00+05:30`).getTime() + 24 * 3600 * 1000);
  const tomorrowKey = istDateKey(tomorrowDate);
  const weekOutDate = new Date(tomorrowDate.getTime() + 6 * 24 * 3600 * 1000);
  const weekOutKey = istDateKey(weekOutDate);
  let upcomingQ = supabase
    .from("tasks")
    .select("id, title, due_date, due_time, priority, status")
    .eq("user_id", user.id)
    .neq("status", "done")
    .gte("due_date", tomorrowKey)
    .lte("due_date", weekOutKey)
    .order("due_date", { ascending: true })
    .order("due_time", { ascending: true, nullsFirst: true })
    .limit(5);
  if (workspaceId) upcomingQ = upcomingQ.eq("workspace_id", workspaceId);
  const { data: upcoming } = await upcomingQ;

  // Streak — consecutive days ending today that have at least one entry.
  const streakLookbackStart = istDateKey(new Date(Date.now() - 60 * 24 * 3600 * 1000));
  let streakQ = supabase
    .from("work_entries")
    .select("date")
    .eq("user_id", user.id)
    .gte("date", streakLookbackStart)
    .order("date", { ascending: false });
  if (workspaceId) streakQ = streakQ.eq("workspace_id", workspaceId);
  const { data: streakRows } = await streakQ;
  const uniqueDates = [...new Set((streakRows ?? []).map((r) => r.date as string))];
  let streak = 0;
  let cursor = new Date(`${today}T00:00:00+05:30`);
  for (;;) {
    const key = istDateKey(cursor);
    if (uniqueDates.includes(key)) {
      streak++;
      cursor = new Date(cursor.getTime() - 24 * 3600 * 1000);
    } else {
      break;
    }
  }

  // Week productivity average (last 7 IST days).
  const weekAgoKey = istDateKey(new Date(Date.now() - 7 * 24 * 3600 * 1000));
  let weekQ = supabase
    .from("work_entries")
    .select("productivity_score")
    .eq("user_id", user.id)
    .gte("date", weekAgoKey);
  if (workspaceId) weekQ = weekQ.eq("workspace_id", workspaceId);
  const { data: weekRows } = await weekQ;
  const weekScores = (weekRows ?? [])
    .map((r) => r.productivity_score as number | null)
    .filter((n): n is number => typeof n === "number");
  const weekScoreAvg = weekScores.length > 0
    ? Math.round((weekScores.reduce((s, n) => s + n, 0) / weekScores.length) * 10) / 10
    : null;

  // Focus minutes today from timer_sessions.
  let timerQ = supabase
    .from("timer_sessions")
    .select("duration_seconds, started_at")
    .eq("user_id", user.id)
    .gte("started_at", startIso)
    .lte("started_at", endIso);
  if (workspaceId) timerQ = timerQ.eq("workspace_id", workspaceId);
  const { data: timerRows } = await timerQ;
  const focusSeconds = (timerRows ?? []).reduce(
    (acc, r) => acc + ((r.duration_seconds as number | null) ?? 0),
    0,
  );

  // Motivation for today (if user has logged one).
  let motivQ = supabase
    .from("daily_motivations")
    .select("quote, reflection")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();
  if (workspaceId) motivQ = supabase
    .from("daily_motivations")
    .select("quote, reflection")
    .eq("user_id", user.id)
    .eq("workspace_id", workspaceId)
    .eq("date", today)
    .maybeSingle();
  const { data: motiv } = await motivQ;

  const now = new Date();
  return {
    focusTasks: (tasks ?? []).slice(0, 5).map((t) => ({
      id: t.id as string,
      title: t.title as string,
      status: t.status as string,
      priority: (t.priority as string) ?? "medium",
      due_date: (t.due_date as string | null) ?? null,
      due_time: (t.due_time as string | null) ?? null,
      is_overdue: !!(t.due_date && new Date(t.due_date as string) < now && t.status !== "done"),
      is_private: !!t.is_private,
    })),
    todaysReminders: (reminders ?? []).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      reminder_time: r.reminder_time as string,
      is_private: !!r.is_private,
    })),
    todaysEvents: (events ?? []).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      start_time: e.start_time as string,
      end_time: e.end_time as string,
      color: (e.color as string | null) ?? null,
      location: (e.location as string | null) ?? null,
    })),
    upcomingTasks: (upcoming ?? []).slice(0, 3).map((u) => ({
      id: u.id as string,
      title: u.title as string,
      due_date: u.due_date as string,
      due_time: (u.due_time as string | null) ?? null,
      priority: (u.priority as string) ?? "medium",
    })),
    entryToday: entry
      ? {
          id: entry.id as string,
          title: entry.title as string,
          work_done: (entry.work_done as string) ?? null,
        }
      : null,
    completedTasksToday: (done ?? []).map((t) => ({
      id: t.id as string,
      title: t.title as string,
    })),
    stats: {
      streak,
      tasksDoneToday: (done ?? []).length,
      weekScoreAvg,
      focusMinutesToday: Math.round(focusSeconds / 60),
    },
    motivation: motiv
      ? {
          quote: (motiv.quote as string | null) ?? null,
          reflection: (motiv.reflection as string | null) ?? null,
        }
      : null,
  };
}

/**
 * Quick-capture router. Given a natural-language line (and an optional
 * user override for kind), creates the matching entity via the existing
 * CRUD actions. The client-side FAB shows a live preview using the same
 * shared parser in `./parse.ts`, so what the user sees is exactly what
 * gets committed.
 *
 *   "remind me at 6pm to call mom"       → reminder 6pm today
 *   "meeting with alice thursday 3pm"    → calendar event thursday 3pm
 *   "finish spec"                        → task (no date)
 *   Any kind can be forced via `forceKind` when the user disagrees
 *   with the heuristic.
 */
export async function quickCapture(
  rawText: string,
  options: { forceKind?: ParsedKind } = {},
): Promise<{ kind: ParsedKind; id: string; title: string }> {
  const text = rawText.trim();
  if (!text) throw new Error("Empty input");

  const workspaceId = await getActiveWorkspaceId();
  const parsed = parseCapture(text);
  const effectiveKind = options.forceKind ?? parsed.kind;

  // Title fallback: if the parser stripped away too much, use the raw text.
  const title = parsed.title || text;

  // Reminder / event paths need a date + time; if the user forced one of
  // those kinds without text time-hints, the parser has already filled in
  // today 09:00 IST as a sane default.
  const dateKey = parsed.dateKey ?? istDateKey(new Date());
  const timeStr = parsed.time ?? "09:00";

  if (effectiveKind === "reminder") {
    const { id } = await createReminderForEntity({
      title,
      description: null,
      reminder_time_local: `${dateKey}T${timeStr}`,
      workspace_id: workspaceId,
    });
    return { kind: "reminder", id, title };
  }

  if (effectiveKind === "event") {
    if (!workspaceId) throw new Error("Select a workspace to create an event");
    // Default event duration: 1 hour.
    const startIso = istDateTimeToUtcISO(dateKey, timeStr);
    const endDate = new Date(new Date(startIso).getTime() + 60 * 60 * 1000);
    const endIso = endDate.toISOString();
    const event = await createEvent(workspaceId, {
      title,
      start_time: startIso,
      end_time: endIso,
      color: "#8b5cf6",
    });
    return { kind: "event", id: event.id as string, title };
  }

  // Task — always allowed even with no workspace (user_id scope).
  const { id } = await createTask({ title, workspaceId });
  return { kind: "task", id, title };
}

/**
 * Generic delete for any quick-captured entity kind — used by the FAB's
 * "oops, I didn't mean that" action on recently captured items. Routes to
 * the correct server action per kind so ownership + activity-log stay correct.
 */
export async function deleteCaptured(
  kind: ParsedKind,
  id: string,
): Promise<void> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (kind === "task") {
    const { deleteTask } = await import("@/lib/tasks/actions");
    await deleteTask(id);
    return;
  }
  if (kind === "reminder") {
    const { deleteReminder } = await import("@/lib/reminders/actions");
    await deleteReminder(id);
    return;
  }
  if (kind === "event") {
    const { deleteEvent } = await import("@/lib/calendar/actions");
    await deleteEvent(id);
    return;
  }
}

/**
 * Rename a just-captured entity by title. Used by the FAB's inline rename
 * on recently captured items.
 */
export async function renameCaptured(
  kind: ParsedKind,
  id: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Title cannot be empty");

  if (kind === "task") {
    const { updateTask } = await import("@/lib/tasks/actions");
    await updateTask(id, { title: trimmed });
    return;
  }
  if (kind === "reminder") {
    const { updateReminder } = await import("@/lib/reminders/actions");
    await updateReminder(id, { title: trimmed });
    return;
  }
  if (kind === "event") {
    const { updateEvent } = await import("@/lib/calendar/actions");
    await updateEvent(id, { title: trimmed });
    return;
  }
}

/**
 * Legacy parser removed — the shared `parseCapture` in `./parse.ts` is
 * the one place NL parsing happens now. Both client preview and server
 * commit use the same output, so they can never disagree.
 */

/**
 * Create (or replace work_done on) today's entry with a short note — used by
 * the "how it went?" merge. If an entry for today already exists, the note
 * is appended.
 */
export async function addTodayEntryNote(note: string, titleFallback?: string): Promise<{ id: string }> {
  const { supabase, user } = await requireUser();
  const workspaceId = await getActiveWorkspaceId();
  const today = istDateKey(new Date());

  const { data: existing } = await supabase
    .from("work_entries")
    .select("id, work_done")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    const prior = (existing.work_done as string | null) ?? "";
    const merged = prior ? `${prior}\n- ${note.trim()}` : `- ${note.trim()}`;
    const { error } = await supabase
      .from("work_entries")
      .update({ work_done: merged })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    revalidatePath("/today");
    revalidatePath("/entries");
    return { id: existing.id as string };
  }

  const { data, error } = await supabase
    .from("work_entries")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      date: today,
      title: titleFallback?.trim() || `Work log — ${today}`,
      work_done: `- ${note.trim()}`,
      status: "done",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/today");
  revalidatePath("/entries");
  return { id: data.id as string };
}
