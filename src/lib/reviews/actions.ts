"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { istDateKey } from "@/lib/utils/datetime";
import { revalidatePath } from "next/cache";

/**
 * Weekly review — one row per user per ISO week (Mon-Sun in IST).
 * The /today surface shows a "Friday 5pm" prompt that opens a drawer
 * pre-filled with auto-computed "what shipped" / "what slipped" and an
 * empty reflection field. User writes one line, hits save.
 */

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

/** Monday (IST) of the current week, as YYYY-MM-DD. */
function currentWeekStartIst(): string {
  // We compute day-of-week in IST, then subtract that many days from
  // today's IST date to land on Monday.
  const istNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const dow = istNow.getDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7; // 0=Mon..6=Sun
  const monday = new Date(istNow);
  monday.setDate(istNow.getDate() - daysSinceMonday);
  // Use istDateKey for a stable YYYY-MM-DD regardless of local tz drift.
  return istDateKey(monday);
}

/**
 * Async wrapper because "use server" modules can only export async
 * functions. Kept separate from the internal `currentWeekStartIst()`
 * so other server actions in this file can call the sync version
 * without await overhead.
 */
export async function getCurrentWeekStart(): Promise<string> {
  return currentWeekStartIst();
}

/**
 * Whether the Friday-afternoon prompt should fire. True iff:
 *   - It's Friday after 17:00 IST, OR it's Saturday, OR it's Sunday.
 *   - No weekly_review row exists for this week yet.
 * Everything else = don't nag.
 */
export async function shouldShowWeeklyPrompt(): Promise<{
  show: boolean;
  weekStart: string;
  dayOfWeek: number;
  hourIst: number;
}> {
  const { supabase, user } = await requireUser();

  const istNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const dow = istNow.getDay(); // 0=Sun..6=Sat
  const hour = istNow.getHours();
  const weekStart = currentWeekStartIst();

  // Friday ≥17:00 OR Saturday OR Sunday.
  const inWindow = (dow === 5 && hour >= 17) || dow === 6 || dow === 0;
  if (!inWindow) return { show: false, weekStart, dayOfWeek: dow, hourIst: hour };

  // Already reviewed?
  const { data } = await supabase
    .from("weekly_reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .maybeSingle();

  return { show: !data, weekStart, dayOfWeek: dow, hourIst: hour };
}

export interface WeeklyReviewSnapshot {
  weekStart: string;
  weekEnd: string;
  /** Tasks the user completed this week (title only, capped). */
  shipped: Array<{ id: string; title: string }>;
  /** Tasks that slipped past their due date still open + overdue reminders. */
  slipped: Array<{ id: string; title: string; kind: "task" | "reminder" }>;
}

/**
 * Auto-compute the "what happened this week" body for the review modal.
 * Purely read-only — doesn't write anything.
 */
export async function getWeeklyReviewSnapshot(): Promise<WeeklyReviewSnapshot> {
  const { supabase, user } = await requireUser();
  const workspaceId = await getActiveWorkspaceId();

  const weekStart = currentWeekStartIst();
  const startIso = new Date(weekStart + "T00:00:00+05:30").toISOString();
  const weekEnd = (() => {
    const d = new Date(weekStart + "T00:00:00+05:30");
    d.setDate(d.getDate() + 6);
    return istDateKey(d);
  })();
  const endIso = new Date(weekEnd + "T23:59:59+05:30").toISOString();
  const nowIso = new Date().toISOString();

  // Shipped — tasks moved to done this week (workspace scope). RLS
  // means we only see ours + workspace-shared that we can access.
  let shippedQ = supabase
    .from("tasks")
    .select("id, title, completed_at")
    .eq("user_id", user.id)
    .eq("status", "done")
    .gte("completed_at", startIso)
    .lte("completed_at", endIso)
    .order("completed_at", { ascending: true })
    .limit(15);
  if (workspaceId) shippedQ = shippedQ.eq("workspace_id", workspaceId);

  // Slipped — tasks still open with due_date this week passed.
  let slippedTasksQ = supabase
    .from("tasks")
    .select("id, title, due_date")
    .eq("user_id", user.id)
    .not("status", "in", "(done,cancelled)")
    .not("due_date", "is", null)
    .gte("due_date", weekStart)
    .lt("due_date", nowIso.slice(0, 10))
    .order("due_date", { ascending: true })
    .limit(15);
  if (workspaceId) slippedTasksQ = slippedTasksQ.eq("workspace_id", workspaceId);

  // Overdue reminders still not completed.
  let slippedRemindersQ = supabase
    .from("reminders")
    .select("id, title, reminder_time")
    .eq("user_id", user.id)
    .eq("is_completed", false)
    .gte("reminder_time", startIso)
    .lt("reminder_time", nowIso)
    .order("reminder_time", { ascending: true })
    .limit(15);
  if (workspaceId) slippedRemindersQ = slippedRemindersQ.eq("workspace_id", workspaceId);

  const [{ data: shipped }, { data: slippedTasks }, { data: slippedReminders }] = await Promise.all([
    shippedQ, slippedTasksQ, slippedRemindersQ,
  ]);

  return {
    weekStart,
    weekEnd,
    shipped: ((shipped ?? []) as Array<{ id: string; title: string }>).map((t) => ({
      id: t.id, title: t.title,
    })),
    slipped: [
      ...((slippedTasks ?? []) as Array<{ id: string; title: string }>).map((t) => ({
        id: t.id, title: t.title, kind: "task" as const,
      })),
      ...((slippedReminders ?? []) as Array<{ id: string; title: string }>).map((r) => ({
        id: r.id, title: r.title, kind: "reminder" as const,
      })),
    ],
  };
}

export interface SaveWeeklyReviewInput {
  reflection: string;
  nextWeekIntent?: string | null;
  shippedCount?: number;
  slippedCount?: number;
}

export async function saveWeeklyReview(input: SaveWeeklyReviewInput) {
  const { supabase, user } = await requireUser();

  const reflection = input.reflection.trim().slice(0, 2000);
  if (!reflection) throw new Error("Write at least one reflection line");

  const weekStart = currentWeekStartIst();

  const { error } = await supabase
    .from("weekly_reviews")
    .upsert(
      {
        user_id: user.id,
        week_start: weekStart,
        reflection,
        next_week_intent: input.nextWeekIntent?.trim()
          ? input.nextWeekIntent.trim().slice(0, 500)
          : null,
        shipped_count: input.shippedCount ?? 0,
        slipped_count: input.slippedCount ?? 0,
      },
      { onConflict: "user_id,week_start" },
    );
  if (error) throw new Error(`Failed to save review: ${error.message}`);

  revalidatePath("/today");
}

/**
 * Dismiss this week's prompt without writing a review. We insert an
 * empty-reflection marker — except the CHECK constraint forbids empty
 * reflection. So instead we set a client-side localStorage flag; here
 * we just provide an action hook for the future if we decide to store
 * "explicitly skipped" server-side.
 */
