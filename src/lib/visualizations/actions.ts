"use server";

import { createClient } from "@/lib/supabase/server";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, startOfYear, endOfYear, differenceInDays } from "date-fns";
import type {
  KPIData,
  KPIMetric,
  ActivityHeatmap,
  HeatmapDay,
  TeamMemberPerformance,
  StatusDistribution,
  DashboardWidget,
  DashboardLayout,
  ProductivityTrendPoint,
} from "./types";

// ── KPI Data ─────────────────────────────────────────────────────────

export async function getKPIData(
  workspaceId: string,
  dateRange: { from: string; to: string }
): Promise<KPIData> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const from = new Date(dateRange.from);
  const to = new Date(dateRange.to);
  const rangeDays = differenceInDays(to, from) || 1;
  const prevFrom = subDays(from, rangeDays);
  const prevTo = subDays(to, rangeDays);

  // Current period entries
  const { data: entries } = await supabase
    .from("work_entries")
    .select("id, date, productivity_score, status")
    .eq("workspace_id", workspaceId)
    .gte("date", dateRange.from)
    .lte("date", dateRange.to);

  // Previous period entries (for comparison)
  const { data: prevEntries } = await supabase
    .from("work_entries")
    .select("id, date, productivity_score, status")
    .eq("workspace_id", workspaceId)
    .gte("date", format(prevFrom, "yyyy-MM-dd"))
    .lte("date", format(prevTo, "yyyy-MM-dd"));

  // Current period tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, status, completed_at")
    .eq("workspace_id", workspaceId)
    .or(`completed_at.gte.${dateRange.from},status.neq.done`)
    .lte("created_at", dateRange.to + "T23:59:59");

  const { data: prevTasks } = await supabase
    .from("tasks")
    .select("id, status, completed_at")
    .eq("workspace_id", workspaceId)
    .or(`completed_at.gte.${format(prevFrom, "yyyy-MM-dd")},status.neq.done`)
    .lte("created_at", format(prevTo, "yyyy-MM-dd") + "T23:59:59");

  // Timer sessions
  const { data: timerSessions } = await supabase
    .from("timer_sessions")
    .select("duration_seconds, started_at")
    .eq("workspace_id", workspaceId)
    .gte("started_at", dateRange.from)
    .lte("started_at", dateRange.to + "T23:59:59");

  const { data: prevTimerSessions } = await supabase
    .from("timer_sessions")
    .select("duration_seconds, started_at")
    .eq("workspace_id", workspaceId)
    .gte("started_at", format(prevFrom, "yyyy-MM-dd"))
    .lte("started_at", format(prevTo, "yyyy-MM-dd") + "T23:59:59");

  // Streak calculation
  const { data: allEntries } = await supabase
    .from("work_entries")
    .select("date")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  let streak = 0;
  if (allEntries && allEntries.length > 0) {
    const uniqueDates = [...new Set(allEntries.map((e) => e.date))].sort().reverse();
    let checkDate = new Date();
    for (const dateStr of uniqueDates) {
      const entryDate = new Date(dateStr);
      if (format(entryDate, "yyyy-MM-dd") === format(checkDate, "yyyy-MM-dd")) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }
  }

  // Sparkline: last 7 days of entries per day
  const last7 = eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() });
  const entrySparkline = last7.map((d) => {
    const ds = format(d, "yyyy-MM-dd");
    return entries?.filter((e) => e.date === ds).length || 0;
  });

  const scoreSparkline = last7.map((d) => {
    const ds = format(d, "yyyy-MM-dd");
    const dayEntries = entries?.filter((e) => e.date === ds) || [];
    const scores = dayEntries.map((e) => e.productivity_score).filter((s): s is number => s !== null);
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  });

  // Calculate metrics
  const currentDone = tasks?.filter((t) => t.status === "done").length || 0;
  const currentTotal = tasks?.length || 0;
  const currentRate = currentTotal > 0 ? (currentDone / currentTotal) * 100 : 0;

  const prevDone = prevTasks?.filter((t) => t.status === "done").length || 0;
  const prevTotal = prevTasks?.length || 0;
  const prevRate = prevTotal > 0 ? (prevDone / prevTotal) * 100 : 0;

  const currentScores = (entries || []).map((e) => e.productivity_score).filter((s): s is number => s !== null);
  const currentAvg = currentScores.length > 0 ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length : 0;

  const prevScores = (prevEntries || []).map((e) => e.productivity_score).filter((s): s is number => s !== null);
  const prevAvg = prevScores.length > 0 ? prevScores.reduce((a, b) => a + b, 0) / prevScores.length : 0;

  const currentHours = (timerSessions || []).reduce((s, t) => s + t.duration_seconds, 0) / 3600;
  const prevHours = (prevTimerSessions || []).reduce((s, t) => s + t.duration_seconds, 0) / 3600;

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEntries = (entries || []).filter((e) => {
    const d = new Date(e.date);
    return d >= weekStart && d <= weekEnd;
  });

  function calcChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  function trend(change: number): "up" | "down" | "neutral" {
    if (change > 1) return "up";
    if (change < -1) return "down";
    return "neutral";
  }

  const rateChange = calcChange(currentRate, prevRate);
  const avgChange = calcChange(currentAvg, prevAvg);
  const hoursChange = calcChange(currentHours, prevHours);

  const hoursSparkline = last7.map((d) => {
    const ds = format(d, "yyyy-MM-dd");
    const daySessions = (timerSessions || []).filter((s) => s.started_at.startsWith(ds));
    return daySessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 3600;
  });

  return {
    taskCompletionRate: {
      label: "Task Completion",
      value: currentRate,
      formattedValue: `${currentRate.toFixed(0)}%`,
      change: Math.round(rateChange),
      trend: trend(rateChange),
      sparkline: last7.map((d) => {
        const ds = format(d, "yyyy-MM-dd");
        const dayTasks = tasks?.filter((t) => t.completed_at?.startsWith(ds)).length || 0;
        return dayTasks;
      }),
    },
    avgProductivity: {
      label: "Avg Productivity",
      value: currentAvg,
      formattedValue: currentAvg.toFixed(1),
      change: Math.round(avgChange),
      trend: trend(avgChange),
      sparkline: scoreSparkline,
    },
    activeStreak: {
      label: "Active Streak",
      value: streak,
      formattedValue: `${streak}d`,
      change: 0,
      trend: streak > 0 ? "up" : "neutral",
      sparkline: entrySparkline,
    },
    totalHours: {
      label: "Hours Logged",
      value: currentHours,
      formattedValue: `${currentHours.toFixed(1)}h`,
      change: Math.round(hoursChange),
      trend: trend(hoursChange),
      sparkline: hoursSparkline,
    },
    entriesThisWeek: {
      label: "Entries This Week",
      value: weekEntries.length,
      formattedValue: `${weekEntries.length}`,
      change: 0,
      trend: weekEntries.length > 0 ? "up" : "neutral",
      sparkline: entrySparkline,
    },
  };
}

// ── Activity Heatmap ─────────────────────────────────────────────────

export async function getActivityHeatmap(
  workspaceId: string,
  year: number
): Promise<ActivityHeatmap> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));

  const { data: entries } = await supabase
    .from("work_entries")
    .select("date")
    .eq("workspace_id", workspaceId)
    .gte("date", format(yearStart, "yyyy-MM-dd"))
    .lte("date", format(yearEnd, "yyyy-MM-dd"));

  const { data: tasks } = await supabase
    .from("tasks")
    .select("completed_at")
    .eq("workspace_id", workspaceId)
    .not("completed_at", "is", null)
    .gte("completed_at", format(yearStart, "yyyy-MM-dd"))
    .lte("completed_at", format(yearEnd, "yyyy-MM-dd") + "T23:59:59");

  // Count activities per day
  const countMap: Record<string, number> = {};

  (entries || []).forEach((e) => {
    countMap[e.date] = (countMap[e.date] || 0) + 1;
  });

  (tasks || []).forEach((t) => {
    if (t.completed_at) {
      const d = format(new Date(t.completed_at), "yyyy-MM-dd");
      countMap[d] = (countMap[d] || 0) + 1;
    }
  });

  const maxCount = Math.max(1, ...Object.values(countMap));

  const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });
  const days: HeatmapDay[] = allDays.map((d) => {
    const dateStr = format(d, "yyyy-MM-dd");
    const count = countMap[dateStr] || 0;
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }
    return { date: dateStr, count, level };
  });

  const totalActivities = Object.values(countMap).reduce((s, c) => s + c, 0);

  return { days, maxCount, totalActivities, year };
}

// ── Team Performance ─────────────────────────────────────────────────

export async function getTeamPerformance(
  workspaceId: string,
  dateRange: { from: string; to: string }
): Promise<TeamMemberPerformance[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get workspace members
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  if (!members || members.length === 0) return [];

  const userIds = members.map((m) => m.user_id);

  // Fetch profiles
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("user_id, name, avatar_url")
    .in("user_id", userIds);

  // Fetch all entries in range
  const { data: entries } = await supabase
    .from("work_entries")
    .select("user_id, productivity_score, status")
    .eq("workspace_id", workspaceId)
    .gte("date", dateRange.from)
    .lte("date", dateRange.to);

  // Fetch completed tasks
  const { data: tasks } = await supabase
    .from("tasks")
    .select("assigned_to, status, completed_at")
    .eq("workspace_id", workspaceId)
    .eq("status", "done")
    .gte("completed_at", dateRange.from)
    .lte("completed_at", dateRange.to + "T23:59:59");

  // Fetch timer sessions
  const { data: sessions } = await supabase
    .from("timer_sessions")
    .select("user_id, duration_seconds")
    .eq("workspace_id", workspaceId)
    .gte("started_at", dateRange.from)
    .lte("started_at", dateRange.to + "T23:59:59");

  return userIds.map((uid) => {
    const profile = profiles?.find((p) => p.user_id === uid);
    const userEntries = (entries || []).filter((e) => e.user_id === uid);
    const userTasks = (tasks || []).filter((t) => t.assigned_to === uid);
    const userSessions = (sessions || []).filter((s) => s.user_id === uid);

    const scores = userEntries
      .map((e) => e.productivity_score)
      .filter((s): s is number => s !== null);
    const avgProd = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    return {
      userId: uid,
      name: profile?.name || "Unknown",
      avatarUrl: profile?.avatar_url || null,
      tasksCompleted: userTasks.length,
      entriesMade: userEntries.length,
      hoursLogged: userSessions.reduce((s, t) => s + t.duration_seconds, 0) / 3600,
      avgProductivity: Math.round(avgProd * 10) / 10,
    };
  });
}

// ── Status Distribution ──────────────────────────────────────────────

export async function getStatusDistribution(
  workspaceId: string
): Promise<StatusDistribution> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: tasks } = await supabase
    .from("tasks")
    .select("status")
    .eq("workspace_id", workspaceId);

  const { data: entries } = await supabase
    .from("work_entries")
    .select("status")
    .eq("workspace_id", workspaceId);

  const taskStatusColors: Record<string, string> = {
    pending: "#f59e0b",
    "in-progress": "#6366f1",
    done: "#10b981",
    cancelled: "#ef4444",
  };

  const entryStatusColors: Record<string, string> = {
    done: "#10b981",
    "in-progress": "#6366f1",
    blocked: "#ef4444",
  };

  const taskCounts: Record<string, number> = {};
  (tasks || []).forEach((t) => {
    taskCounts[t.status] = (taskCounts[t.status] || 0) + 1;
  });

  const entryCounts: Record<string, number> = {};
  (entries || []).forEach((e) => {
    entryCounts[e.status] = (entryCounts[e.status] || 0) + 1;
  });

  return {
    tasks: Object.entries(taskCounts).map(([status, count]) => ({
      status,
      count,
      color: taskStatusColors[status] || "#94a3b8",
    })),
    entries: Object.entries(entryCounts).map(([status, count]) => ({
      status,
      count,
      color: entryStatusColors[status] || "#94a3b8",
    })),
  };
}

// ── Productivity Trend Data ──────────────────────────────────────────

export async function getProductivityTrend(
  workspaceId: string,
  days: number
): Promise<ProductivityTrendPoint[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const from = subDays(new Date(), days - 1);

  const { data: entries } = await supabase
    .from("work_entries")
    .select("date, productivity_score, status")
    .eq("workspace_id", workspaceId)
    .gte("date", format(from, "yyyy-MM-dd"))
    .order("date", { ascending: true });

  const { data: tasks } = await supabase
    .from("tasks")
    .select("status, completed_at, created_at")
    .eq("workspace_id", workspaceId)
    .gte("created_at", format(from, "yyyy-MM-dd"));

  const allDays = eachDayOfInterval({ start: from, end: new Date() });

  return allDays.map((d) => {
    const ds = format(d, "yyyy-MM-dd");
    const dayEntries = (entries || []).filter((e) => e.date === ds);
    const scores = dayEntries.map((e) => e.productivity_score).filter((s): s is number => s !== null);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

    const dayTasksCreated = (tasks || []).filter((t) => t.created_at.startsWith(ds));
    const dayTasksDone = (tasks || []).filter((t) => t.completed_at?.startsWith(ds));
    const completionRate = dayTasksCreated.length > 0
      ? (dayTasksDone.length / dayTasksCreated.length) * 100
      : null;

    return {
      date: ds,
      label: format(d, days <= 7 ? "EEE" : days <= 30 ? "MMM d" : "MMM d"),
      productivity: avgScore,
      completionRate,
      entries: dayEntries.length,
    };
  });
}

// ── Dashboard Widgets (Custom Layout) ────────────────────────────────

export async function getDashboardWidgets(
  workspaceId: string,
  userId: string
): Promise<DashboardLayout | null> {
  const supabase = await createClient();

  // Store custom dashboards in user_profiles metadata or a separate table
  // For simplicity, we use a JSON column approach via a dedicated query
  const { data } = await supabase
    .from("user_profiles")
    .select("id, user_id, updated_at")
    .eq("user_id", userId)
    .single();

  if (!data) return null;

  // Try to fetch from a custom_dashboards approach using the user_profiles table
  // We'll store the layout as a JSON blob. Since we may not have a dedicated table,
  // we store it in localStorage on the client and sync on save.
  // Return null to let the client use defaults
  return null;
}

export async function saveDashboardWidgets(
  workspaceId: string,
  userId: string,
  widgets: DashboardWidget[]
): Promise<void> {
  // In a production app, you'd store this in a dedicated table.
  // For now, the client persists the layout in localStorage and
  // this action is a no-op placeholder for future DB persistence.
  // This keeps the server action interface ready for when a
  // dashboard_layouts table is added.
  return;
}
