"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

// Fallback is the project owner's email for local/dev; prod sets ADMIN_EMAIL
// in the environment so this const is effectively that value. A missing env
// var in prod = no admin access (not the fallback), since `??` only matches null/undefined.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL?.trim() || "paratakkearyan@gmail.com").toLowerCase();

export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/dashboard");
  return user;
}

/** Non-throwing variant used by the nav to decide whether to render the admin button. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.email === ADMIN_EMAIL;
}

// ---------------------------------------------------------------------------
// Platform-wide metrics
// ---------------------------------------------------------------------------

export async function getPlatformMetrics() {
  await requireAdmin();
  const admin = createAdminClient();

  const [
    { count: totalUsers },
    { count: totalWorkspaces },
    { count: totalEntries },
    { count: totalTasks },
    { count: totalBoards },
    { count: totalPages },
    { count: totalReminders },
    { count: totalComments },
  ] = await Promise.all([
    admin.from("user_profiles").select("*", { count: "exact", head: true }),
    admin.from("workspaces").select("*", { count: "exact", head: true }),
    admin.from("work_entries").select("*", { count: "exact", head: true }),
    admin.from("tasks").select("*", { count: "exact", head: true }),
    admin.from("boards").select("*", { count: "exact", head: true }),
    admin.from("pages").select("*", { count: "exact", head: true }),
    admin.from("reminders").select("*", { count: "exact", head: true }),
    admin.from("comments").select("*", { count: "exact", head: true }),
  ]);

  return {
    totalUsers: totalUsers ?? 0,
    totalWorkspaces: totalWorkspaces ?? 0,
    totalEntries: totalEntries ?? 0,
    totalTasks: totalTasks ?? 0,
    totalBoards: totalBoards ?? 0,
    totalPages: totalPages ?? 0,
    totalReminders: totalReminders ?? 0,
    totalComments: totalComments ?? 0,
  };
}

// ---------------------------------------------------------------------------
// All users with activity stats
// ---------------------------------------------------------------------------

export async function getAllUsers() {
  await requireAdmin();
  const admin = createAdminClient();

  // Get all user profiles (including the heartbeat-driven last_activity_at
  // so "last active" truly reflects activity, not last login).
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, name, avatar_url, created_at, updated_at, last_activity_at")
    .order("created_at", { ascending: false });

  if (!profiles) return [];

  // Get auth users for email info
  const { data: authData } = await admin.auth.admin.listUsers();
  const authUsers = authData?.users ?? [];
  const emailMap = new Map(authUsers.map((u) => [u.id, u.email]));
  const lastSignInMap = new Map(authUsers.map((u) => [u.id, u.last_sign_in_at]));

  // Get entry counts per user
  const { data: entryCounts } = await admin
    .from("work_entries")
    .select("user_id");
  const entryMap = new Map<string, number>();
  (entryCounts ?? []).forEach((e) => {
    entryMap.set(e.user_id, (entryMap.get(e.user_id) ?? 0) + 1);
  });

  // Get task counts per user
  const { data: taskCounts } = await admin
    .from("tasks")
    .select("user_id, status");
  const taskMap = new Map<string, { total: number; done: number }>();
  (taskCounts ?? []).forEach((t) => {
    const cur = taskMap.get(t.user_id) ?? { total: 0, done: 0 };
    cur.total++;
    if (t.status === "done") cur.done++;
    taskMap.set(t.user_id, cur);
  });

  // Get page counts per user
  const { data: pageCounts } = await admin
    .from("pages")
    .select("created_by");
  const pageMap = new Map<string, number>();
  (pageCounts ?? []).forEach((p) => {
    pageMap.set(p.created_by, (pageMap.get(p.created_by) ?? 0) + 1);
  });

  return profiles.map((p) => {
    const lastSignIn = lastSignInMap.get(p.user_id) ?? null;
    const lastActivity = (p.last_activity_at as string | null) ?? null;
    // Pick the more-recent of the two signals. Falls back to whichever exists.
    const lastActive =
      lastActivity && lastSignIn
        ? new Date(lastActivity) > new Date(lastSignIn)
          ? lastActivity
          : lastSignIn
        : (lastActivity ?? lastSignIn);
    return {
      id: p.user_id,
      name: p.name,
      email: emailMap.get(p.user_id) ?? "unknown",
      avatarUrl: p.avatar_url,
      joinedAt: p.created_at,
      lastSignIn,
      lastActivityAt: lastActivity,
      lastActive,
      entryCount: entryMap.get(p.user_id) ?? 0,
      taskStats: taskMap.get(p.user_id) ?? { total: 0, done: 0 },
      pageCount: pageMap.get(p.user_id) ?? 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Daily activity for charts (last 30 days)
// ---------------------------------------------------------------------------

export async function getDailyActivity() {
  await requireAdmin();
  const admin = createAdminClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: entries } = await admin
    .from("work_entries")
    .select("date, user_id, productivity_score, status")
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: true });

  const { data: tasks } = await admin
    .from("tasks")
    .select("created_at, status")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  // Aggregate by day
  const dayMap = new Map<string, { entries: number; tasks: number; avgScore: number; scores: number[] }>();

  (entries ?? []).forEach((e) => {
    const day = e.date;
    const cur = dayMap.get(day) ?? { entries: 0, tasks: 0, avgScore: 0, scores: [] };
    cur.entries++;
    if (e.productivity_score) cur.scores.push(e.productivity_score);
    dayMap.set(day, cur);
  });

  (tasks ?? []).forEach((t) => {
    const day = t.created_at.split("T")[0];
    const cur = dayMap.get(day) ?? { entries: 0, tasks: 0, avgScore: 0, scores: [] };
    cur.tasks++;
    dayMap.set(day, cur);
  });

  const result = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      entries: data.entries,
      tasks: data.tasks,
      avgScore: data.scores.length > 0
        ? Math.round((data.scores.reduce((s, n) => s + n, 0) / data.scores.length) * 10) / 10
        : 0,
    }));

  return result;
}

// ---------------------------------------------------------------------------
// Task analytics
// ---------------------------------------------------------------------------

export async function getTaskAnalytics() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: tasks } = await admin
    .from("tasks")
    .select("status, priority, created_at, completed_at");

  const statuses = { pending: 0, "in-progress": 0, done: 0 };
  const priorities = { low: 0, medium: 0, high: 0, urgent: 0 };
  let totalCompletionTime = 0;
  let completedCount = 0;

  (tasks ?? []).forEach((t) => {
    if (t.status in statuses) statuses[t.status as keyof typeof statuses]++;
    if (t.priority in priorities) priorities[t.priority as keyof typeof priorities]++;
    if (t.status === "done" && t.completed_at && t.created_at) {
      const diff = new Date(t.completed_at).getTime() - new Date(t.created_at).getTime();
      totalCompletionTime += diff;
      completedCount++;
    }
  });

  return {
    statuses,
    priorities,
    avgCompletionHours: completedCount > 0
      ? Math.round(totalCompletionTime / completedCount / 3600000 * 10) / 10
      : 0,
    total: tasks?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Entry analytics
// ---------------------------------------------------------------------------

export async function getEntryAnalytics() {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: entries } = await admin
    .from("work_entries")
    .select("status, productivity_score, date, user_id");

  const statuses = { draft: 0, "in-progress": 0, done: 0 };
  const scores: number[] = [];
  const uniqueDays = new Set<string>();
  const activeUsers = new Set<string>();

  (entries ?? []).forEach((e) => {
    if (e.status in statuses) statuses[e.status as keyof typeof statuses]++;
    if (e.productivity_score) scores.push(e.productivity_score);
    uniqueDays.add(e.date);
    activeUsers.add(e.user_id);
  });

  return {
    statuses,
    avgScore: scores.length > 0
      ? Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10
      : 0,
    totalDaysTracked: uniqueDays.size,
    activeUsers: activeUsers.size,
    total: entries?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Per-user detail
// ---------------------------------------------------------------------------

export async function getUserDetail(userId: string) {
  await requireAdmin();
  const admin = createAdminClient();

  const [
    { data: profile },
    { data: entries },
    { data: tasks },
    { data: pages },
    { data: boards },
    { data: reminders },
    { data: notifications },
    { data: logs },
    { data: feedback },
    { data: timers },
    { data: sharesCreated },
  ] = await Promise.all([
    admin.from("user_profiles").select("*").eq("user_id", userId).single(),
    // Full body so admin can read WHAT was written
    admin.from("work_entries").select(
      "id, title, description, work_done, learning, next_day_plan, mood, date, status, productivity_score, created_at"
    ).eq("user_id", userId).order("date", { ascending: false }).limit(50),
    admin.from("tasks").select(
      "id, title, description, status, priority, due_date, due_time, created_at, completed_at"
    ).eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("pages").select("id, title, created_at, updated_at")
      .eq("created_by", userId).order("updated_at", { ascending: false }).limit(20),
    admin.from("boards").select("id, name, created_at")
      .eq("created_by", userId).order("created_at", { ascending: false }).limit(20),
    admin.from("reminders").select("id, title, description, reminder_time, is_recurring, recurrence_pattern, is_completed, notified_at, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    // Notifications received by this user — shows what the system alerted them
    // about and whether they read it.
    admin.from("notifications").select(
      "id, type, title, body, entity_type, entity_id, is_read, created_at"
    ).eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    // Recent system_logs attributed to this user
    admin.from("system_logs").select("id, service, level, tag, message, metadata, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    // Any feedback they've submitted
    admin.from("user_feedback").select("id, type, message, rating, status, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    // Timer sessions for time-on-platform signal
    admin.from("timer_sessions").select("id, duration_seconds, started_at, ended_at")
      .eq("user_id", userId).order("started_at", { ascending: false }).limit(30),
    // Share links this user has CREATED — audit trail of what they've shared
    // externally. Includes revoked links so admins can see historical activity.
    admin.from("shared_links").select(
      "id, workspace_id, entity_type, entity_id, permission, expires_at, is_active, created_at"
    ).eq("created_by", userId).order("created_at", { ascending: false }).limit(30),
  ]);

  const { data: authData } = await admin.auth.admin.getUserById(userId);

  // Resolve entity titles for the share links (polymorphic — need per-table lookup).
  const shareRows = sharesCreated ?? [];
  const byTable = new Map<string, string[]>();
  const tableMap: Record<string, string> = {
    page: "pages",
    task: "tasks",
    board: "boards",
    entry: "work_entries",
    drawing: "drawings",
    mindmap: "mindmaps",
    challenge: "challenges",
  };
  for (const s of shareRows) {
    const table = tableMap[s.entity_type as string];
    if (!table) continue;
    const list = byTable.get(table) ?? [];
    list.push(s.entity_id as string);
    byTable.set(table, list);
  }
  const titleByKey = new Map<string, string>();
  await Promise.all(
    Array.from(byTable.entries()).map(async ([table, ids]) => {
      const titleCol = table === "boards" ? "name" : "title";
      const { data } = await admin
        .from(table)
        .select(`id, ${titleCol}`)
        .in("id", ids);
      (data ?? []).forEach((row) => {
        const r = row as Record<string, unknown>;
        titleByKey.set(
          `${table}:${r.id as string}`,
          (r[titleCol] as string) ?? "Untitled",
        );
      });
    }),
  );
  const shares = shareRows.map((s) => ({
    id: s.id as string,
    workspace_id: s.workspace_id as string,
    entity_type: s.entity_type as string,
    entity_id: s.entity_id as string,
    entity_title:
      titleByKey.get(
        `${tableMap[s.entity_type as string] ?? ""}:${s.entity_id as string}`,
      ) ?? "Untitled",
    permission: s.permission as string,
    expires_at: (s.expires_at as string | null) ?? null,
    is_active: !!s.is_active,
    created_at: s.created_at as string,
  }));

  return {
    profile,
    email: authData?.user?.email ?? "unknown",
    lastSignIn: authData?.user?.last_sign_in_at ?? null,
    lastActivityAt: (profile?.last_activity_at as string | null) ?? null,
    createdAt: authData?.user?.created_at ?? null,
    entries: entries ?? [],
    tasks: tasks ?? [],
    pages: pages ?? [],
    boards: boards ?? [],
    reminders: reminders ?? [],
    notifications: notifications ?? [],
    logs: logs ?? [],
    feedback: feedback ?? [],
    timers: timers ?? [],
    shares,
  };
}
