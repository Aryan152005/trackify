"use server";

import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { istDateKey } from "@/lib/utils/datetime";
import { revalidatePath } from "next/cache";

/**
 * Daily plan — one "what am I actually working on today" pick per user
 * per IST day. Separate from /today's auto-surfaced focusTasks, which
 * shows everything due. Plans are the user's EXPLICIT pick.
 */

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface DailyPlanCandidate {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  due_time: string | null;
  status: string;
  bucket: "overdue" | "today" | "upcoming";
}

export interface DailyPlan {
  id: string;
  plan_date: string;
  task_ids: string[];
  intention: string | null;
  updated_at: string;
}

/** Today's IST calendar day key. */
function todayIstKey(): string {
  return istDateKey(new Date());
}

/**
 * Return the plan row for today (creating an empty one if none).
 * Called from /today on every load — need a plan row to know whether
 * to auto-open the planning drawer.
 */
export async function getTodayPlan(): Promise<DailyPlan | null> {
  const { supabase, user } = await requireUser();
  const today = todayIstKey();

  const { data, error } = await supabase
    .from("daily_plans")
    .select("id, plan_date, task_ids, intention, updated_at")
    .eq("user_id", user.id)
    .eq("plan_date", today)
    .maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to load plan: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id as string,
    plan_date: data.plan_date as string,
    task_ids: (data.task_ids as string[] | null) ?? [],
    intention: (data.intention as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

/**
 * Candidate list for the planning drawer: overdue tasks, tasks due today
 * (IST), and tasks due in the next 7 days. User picks 3-5 from here.
 * Workspace-scoped (personal + shared).
 */
export async function listPlanCandidates(): Promise<DailyPlanCandidate[]> {
  const { supabase } = await requireUser();
  const workspaceId = await getActiveWorkspaceId();
  const today = todayIstKey();

  let q = supabase
    .from("tasks")
    .select("id, title, priority, due_date, due_time, status")
    .not("status", "in", "(done,cancelled)")
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false })
    .limit(40);
  if (workspaceId) q = q.eq("workspace_id", workspaceId);

  const { data, error } = await q;
  if (error) throw new Error(`Failed to load candidates: ${error.message}`);

  return ((data ?? []) as Array<{
    id: string;
    title: string;
    priority: string | null;
    due_date: string | null;
    due_time: string | null;
    status: string;
  }>).map((t) => {
    let bucket: DailyPlanCandidate["bucket"] = "upcoming";
    if (t.due_date) {
      if (t.due_date < today) bucket = "overdue";
      else if (t.due_date === today) bucket = "today";
      else bucket = "upcoming";
    } else {
      bucket = "upcoming";
    }
    return {
      id: t.id,
      title: t.title,
      priority: t.priority ?? "medium",
      due_date: t.due_date,
      due_time: t.due_time,
      status: t.status,
      bucket,
    };
  });
}

export interface SaveDailyPlanInput {
  taskIds: string[];
  intention?: string | null;
}

/**
 * Upsert the plan for today. `taskIds` is replaced wholesale — ordering
 * is preserved so users can drag to reorder. Cap at 10 so the plan
 * doesn't become a dumping ground (the ritual is "pick a few").
 */
export async function saveTodayPlan(input: SaveDailyPlanInput): Promise<DailyPlan> {
  const { supabase, user } = await requireUser();
  const today = todayIstKey();
  const trimmed = input.taskIds.filter((x) => typeof x === "string" && x.length > 0).slice(0, 10);

  // Upsert via conflict target (user_id, plan_date).
  const { data, error } = await supabase
    .from("daily_plans")
    .upsert(
      {
        user_id: user.id,
        plan_date: today,
        task_ids: trimmed,
        intention: input.intention?.trim() ? input.intention.trim().slice(0, 500) : null,
      },
      { onConflict: "user_id,plan_date" },
    )
    .select("id, plan_date, task_ids, intention, updated_at")
    .single();
  if (error) throw new Error(`Failed to save plan: ${error.message}`);

  revalidatePath("/today");
  return {
    id: data.id as string,
    plan_date: data.plan_date as string,
    task_ids: (data.task_ids as string[] | null) ?? [],
    intention: (data.intention as string | null) ?? null,
    updated_at: data.updated_at as string,
  };
}

/** Full hydration: today's plan + the task details for the picked ids. */
export async function getHydratedTodayPlan(): Promise<{
  plan: DailyPlan | null;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    due_time: string | null;
  }>;
}> {
  const plan = await getTodayPlan();
  if (!plan || plan.task_ids.length === 0) return { plan, tasks: [] };

  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("tasks")
    .select("id, title, status, priority, due_date, due_time")
    .in("id", plan.task_ids);

  // Preserve the order stored in task_ids rather than Postgres' return order.
  interface HydratedTask {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    due_time: string | null;
  }
  const rows = ((data ?? []) as unknown as HydratedTask[]);
  const byId = new Map<string, HydratedTask>();
  rows.forEach((t) => byId.set(t.id, t));
  const ordered: HydratedTask[] = plan.task_ids
    .map((id) => byId.get(id))
    .filter((x): x is HydratedTask => !!x);

  return {
    plan,
    tasks: ordered.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority ?? "medium",
      due_date: t.due_date,
      due_time: t.due_time,
    })),
  };
}
