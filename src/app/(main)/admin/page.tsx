import { requireAdmin, getPlatformMetrics, getAllUsers, getDailyActivity, getTaskAnalytics, getEntryAnalytics } from "@/lib/admin/actions";
import { getWhitelist, getWhitelistRequests } from "@/lib/admin/email-actions";
import { getAllFeedback } from "@/lib/feedback/actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminCharts } from "@/components/admin/admin-charts";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Activity } from "lucide-react";
import { format } from "date-fns";

export default async function AdminDashboard() {
  await requireAdmin();

  const [metrics, users, dailyActivity, taskAnalytics, entryAnalytics, whitelist, feedback] = await Promise.all([
    getPlatformMetrics(),
    getAllUsers(),
    getDailyActivity(),
    getTaskAnalytics(),
    getEntryAnalytics(),
    getWhitelist(),
    getAllFeedback().catch(() => []),
  ]);

  // Try to get whitelist requests (may fail if table doesn't exist yet)
  let whitelistRequests: { id: string; email: string; name: string | null; reason: string | null; status: string; created_at: string }[] = [];
  try {
    whitelistRequests = await getWhitelistRequests();
  } catch {
    // Table may not exist yet
  }

  const activeUsersLast7 = users.filter(
    (u) => u.lastActive && new Date(u.lastActive).getTime() > Date.now() - 7 * 24 * 3600 * 1000
  ).length;

  const taskCompletionRate = taskAnalytics.total > 0
    ? Math.round((taskAnalytics.statuses.done / taskAnalytics.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Dashboard"
        description="Manage users, whitelist, emails, and monitor platform health"
        actions={
          <>
            <Link href="/admin/logs">
              <Button variant="outline" size="sm">
                <Activity className="mr-1.5 h-4 w-4" />
                System Logs
              </Button>
            </Link>
            <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              Admin Only
            </span>
          </>
        }
      />

      {/* Key Metrics Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Users</CardDescription>
            <CardTitle className="text-2xl">{metrics.totalUsers}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-zinc-400">{activeUsersLast7} active this week</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Entries</CardDescription>
            <CardTitle className="text-2xl">{metrics.totalEntries}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-zinc-400">Avg {entryAnalytics.avgScore}/10 score</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Tasks</CardDescription>
            <CardTitle className="text-2xl">{metrics.totalTasks}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-zinc-400">{taskCompletionRate}% done</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Content</CardDescription>
            <CardTitle className="text-2xl">{metrics.totalPages + metrics.totalBoards}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-xs text-zinc-400">{metrics.totalPages} pages, {metrics.totalBoards} boards</p></CardContent>
        </Card>
      </div>

      {/* Tabbed interface */}
      <AdminTabs
        users={users}
        whitelist={whitelist}
        whitelistRequests={whitelistRequests}
        dailyActivity={dailyActivity}
        taskAnalytics={taskAnalytics}
        entryAnalytics={entryAnalytics}
        feedback={feedback}
      />
    </div>
  );
}
