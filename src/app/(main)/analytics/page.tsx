import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { TagPerformance } from "@/components/analytics/tag-performance";
import { ProductivityHeatmap } from "@/components/analytics/productivity-heatmap";
import { TimeDistribution } from "@/components/analytics/time-distribution";
import { TrendAnalysis } from "@/components/analytics/trend-analysis";
import { BarChart3, TrendingUp, Calendar, Tag, Clock, Zap, LayoutDashboard } from "lucide-react";
import { AdvancedVisualizationsSection } from "./advanced-visualizations";

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("name")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const workspaceId = await getActiveWorkspaceId();

  const today = new Date();
  const last30Days = subDays(today, 30);
  const last90Days = subDays(today, 90);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const monthStart = startOfMonth(today);

  // Fetch entries with tags
  const entriesQuery = supabase
    .from("work_entries")
    .select(
      `
      *,
      entry_tags ( tags ( id, name, color ) )
    `
    )
    .eq("user_id", user.id)
    .gte("date", format(last90Days, "yyyy-MM-dd"))
    .order("date", { ascending: true });

  const { data: entries } = workspaceId
    ? await entriesQuery.eq("workspace_id", workspaceId)
    : await entriesQuery;

  // Fetch timer sessions
  const timerQuery = supabase
    .from("timer_sessions")
    .select("*")
    .eq("user_id", user.id)
    .gte("started_at", last30Days.toISOString())
    .order("started_at", { ascending: true });

  const { data: timerSessions } = workspaceId
    ? await timerQuery.eq("workspace_id", workspaceId)
    : await timerQuery;

  // Fetch tags
  const tagsQuery = supabase.from("tags").select("*").order("name");
  const { data: tags } = workspaceId
    ? await tagsQuery.eq("workspace_id", workspaceId)
    : await tagsQuery;

  // Calculate stats
  const totalEntries = entries?.length || 0;
  const avgScore =
    entries && entries.length > 0
      ? entries.reduce((sum, e) => sum + (e.productivity_score || 0), 0) / entries.length
      : 0;
  const doneEntries = entries?.filter((e) => e.status === "done").length || 0;
  const completionRate = totalEntries > 0 ? (doneEntries / totalEntries) * 100 : 0;
  const totalTime = timerSessions?.reduce((sum, s) => sum + s.duration_seconds, 0) || 0;
  const hoursWorked = (totalTime / 3600).toFixed(1);

  // Weekly stats
  const weekEntries = entries?.filter(
    (e) => new Date(e.date) >= weekStart && new Date(e.date) <= endOfWeek(today, { weekStartsOn: 1 })
  ) || [];
  const weekAvgScore =
    weekEntries.length > 0
      ? weekEntries.reduce((sum, e) => sum + (e.productivity_score || 0), 0) / weekEntries.length
      : 0;

  // Monthly stats
  const monthEntries = entries?.filter(
    (e) => new Date(e.date) >= monthStart && new Date(e.date) <= endOfMonth(today)
  ) || [];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Analytics Dashboard
          </h1>
          <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
            See the big picture — trends, patterns, and insights from your work
          </p>
        </div>
        <Link href="/dashboard/customize">
          <Button variant="outline" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Custom Dashboard
          </Button>
        </Link>
      </div>

      {/* Advanced KPI Cards + Heatmap + Charts */}
      {workspaceId && (
        <AdvancedVisualizationsSection workspaceId={workspaceId} />
      )}

      {/* Key Metrics */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              Total Entries
            </CardTitle>
            <BarChart3 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900 dark:text-indigo-100">{totalEntries}</div>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
              {monthEntries.length} this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-300">
              Avg Productivity
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
              {avgScore.toFixed(1)}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              {weekAvgScore.toFixed(1)} this week
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">
              Completion Rate
            </CardTitle>
            <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900 dark:text-green-100">
              {completionRate.toFixed(0)}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {doneEntries} completed
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-300">
              Hours Tracked
            </CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900 dark:text-orange-100">{hoursWorked}h</div>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsCharts entries={entries || []} />
        <TrendAnalysis entries={entries || []} />
      </div>

      {/* Tag Performance & Heatmap */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TagPerformance entries={entries || []} tags={tags || []} />
        <ProductivityHeatmap entries={entries || []} />
      </div>

      {/* Time Distribution */}
      <TimeDistribution timerSessions={timerSessions || []} entries={entries || []} />
    </div>
  );
}
