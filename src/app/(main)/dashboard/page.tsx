import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfWeek, endOfWeek, subDays, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { DashboardCalendar } from "@/components/dashboard/dashboard-calendar";
import { TaskList } from "@/components/dashboard/task-list";
import { TimerWidget } from "@/components/dashboard/timer-widget";
import { MotivationWidget } from "@/components/dashboard/motivation-widget";
import { RemindersWidget } from "@/components/dashboard/reminders-widget";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { QuickActions } from "@/components/smart/quick-actions";
import { RecentItems } from "@/components/smart/recent-items";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check if profile exists
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  const workspaceId = await getActiveWorkspaceId();

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const thirtyDaysAgo = subDays(now, 30);
  const uid = user.id;

  // Build all queries
  let todayQ = supabase.from("work_entries").select("id, title, status, productivity_score")
    .eq("user_id", uid).eq("date", today).order("created_at", { ascending: false });
  let weekQ = supabase.from("work_entries").select("productivity_score, date")
    .eq("user_id", uid).gte("date", format(weekStart, "yyyy-MM-dd"))
    .lte("date", format(weekEnd, "yyyy-MM-dd")).order("date", { ascending: true });
  let chartQ = supabase.from("work_entries").select("date, productivity_score, status")
    .eq("user_id", uid).gte("date", format(thirtyDaysAgo, "yyyy-MM-dd"))
    .order("date", { ascending: true });
  let tasksQ = supabase.from("tasks").select("id, title, status, priority, due_date, due_time")
    .eq("user_id", uid).in("status", ["pending", "in-progress"])
    .order("due_date", { ascending: true }).order("priority", { ascending: false }).limit(5);
  let motivQ = supabase.from("daily_motivations").select("quote, reflection, gratitude, mood")
    .eq("user_id", uid).eq("date", today);
  let reminderQ = supabase.from("reminders").select("id, title, reminder_time, is_completed")
    .eq("user_id", uid).eq("is_completed", false).gte("reminder_time", now.toISOString())
    .order("reminder_time", { ascending: true }).limit(3);
  let streakQ = supabase.from("work_entries").select("date")
    .eq("user_id", uid).order("date", { ascending: false });

  // Calendar widget data: current month ± 1 (covers visible grid on either side)
  const calStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const calEnd = format(endOfMonth(addMonths(now, 1)), "yyyy-MM-dd");
  let calTasksQ = supabase.from("tasks")
    .select("id, title, due_date, due_time, priority, status")
    .eq("user_id", uid)
    .not("due_date", "is", null)
    .gte("due_date", calStart).lte("due_date", calEnd);
  let calRemQ = supabase.from("reminders")
    .select("id, title, reminder_time, is_completed")
    .eq("user_id", uid)
    .gte("reminder_time", calStart + "T00:00:00").lte("reminder_time", calEnd + "T23:59:59");
  let calEntriesQ = supabase.from("work_entries")
    .select("id, title, date, status, productivity_score")
    .eq("user_id", uid)
    .gte("date", calStart).lte("date", calEnd);

  if (workspaceId) {
    todayQ = todayQ.eq("workspace_id", workspaceId);
    weekQ = weekQ.eq("workspace_id", workspaceId);
    chartQ = chartQ.eq("workspace_id", workspaceId);
    tasksQ = tasksQ.eq("workspace_id", workspaceId);
    motivQ = motivQ.eq("workspace_id", workspaceId);
    reminderQ = reminderQ.eq("workspace_id", workspaceId);
    streakQ = streakQ.eq("workspace_id", workspaceId);
    calTasksQ = calTasksQ.eq("workspace_id", workspaceId);
    calRemQ = calRemQ.eq("workspace_id", workspaceId);
    calEntriesQ = calEntriesQ.eq("workspace_id", workspaceId);
  }

  // Execute all queries in parallel
  const [todayRes, weekRes, chartRes, tasksRes, motivRes, reminderRes, streakRes, calTasksRes, calRemRes, calEntriesRes] =
    await Promise.all([todayQ, weekQ, chartQ, tasksQ, motivQ.single(), reminderQ, streakQ, calTasksQ, calRemQ, calEntriesQ]);

  const todayEntries = todayRes.data;
  const weekEntries = weekRes.data;
  const chartEntries = chartRes.data;
  const tasks = tasksRes.data;
  const motivation = motivRes.data;
  const reminders = reminderRes.data;
  const allEntries = streakRes.data;

  const avgScore =
    weekEntries && weekEntries.length > 0
      ? (weekEntries.reduce((s, e) => s + (e.productivity_score ?? 0), 0) / weekEntries.length).toFixed(1)
      : "—";

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

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Hey ${profile.name}, let's crush it today`}
        description="Here's what's happening in your workspace"
        actions={
          <Link href="/entries/new">
            <Button>+ New Entry</Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Today&apos;s Entries</CardDescription>
            <CardTitle className="text-3xl">{todayEntries?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {todayEntries && todayEntries.length > 0
                ? `${todayEntries.filter((e) => e.status === "done").length} completed`
                : "No entries yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Weekly Average</CardDescription>
            <CardTitle className="text-3xl">{avgScore}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {weekEntries?.length ?? 0} entries this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current Streak</CardDescription>
            <CardTitle className="text-3xl">{streak} 🔥</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">Consecutive days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Tasks</CardDescription>
            <CardTitle className="text-3xl">{tasks?.length ?? 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/tasks" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
              View all tasks →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Templates */}
      <QuickActions />

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>Your recently edited items</CardDescription>
        </CardHeader>
        <CardContent>
          <RecentItems />
        </CardContent>
      </Card>

      {/* Calendar overview */}
      <DashboardCalendar
        tasks={(calTasksRes.data ?? []) as never}
        reminders={(calRemRes.data ?? []) as never}
        entries={(calEntriesRes.data ?? []) as never}
      />

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          <DashboardCharts entries={chartEntries || []} weekEntries={weekEntries || []} />
        </div>

        {/* Right Column - Widgets */}
        <div className="space-y-6">
          <TimerWidget />
          <TaskList tasks={tasks || []} />
          <MotivationWidget motivation={motivation} />
          <RemindersWidget reminders={reminders || []} />
        </div>
      </div>

      {/* Today's Entries */}
      {todayEntries && todayEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s Work Entries</CardTitle>
            <CardDescription>Your entries for {format(new Date(), "MMMM d, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayEntries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/entries/${entry.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{entry.title}</p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.status} · Score: {entry.productivity_score ?? "—"}/10
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
