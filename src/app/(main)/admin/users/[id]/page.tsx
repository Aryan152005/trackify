import { requireAdmin, getUserDetail } from "@/lib/admin/actions";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";

export default async function AdminUserDetail({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const user = await getUserDetail(params.id);

  if (!user.profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-zinc-500">User not found</p>
        <Link href="/admin" className="mt-4 inline-block text-indigo-600 hover:underline">
          Back to Admin
        </Link>
      </div>
    );
  }

  const tasksDone = user.tasks.filter((t) => t.status === "done").length;
  const avgScore = user.entries.length > 0
    ? (user.entries.reduce((s, e) => s + (e.productivity_score ?? 0), 0) / user.entries.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {user.profile.name}
          </h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>

      {/* User Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Entries</CardDescription>
            <CardTitle className="text-2xl">{user.entries.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Tasks</CardDescription>
            <CardTitle className="text-2xl">{tasksDone}/{user.tasks.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Pages</CardDescription>
            <CardTitle className="text-2xl">{user.pages.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Avg Score</CardDescription>
            <CardTitle className="text-2xl">{avgScore}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">Last Sign In</CardDescription>
            <CardTitle className="text-lg">
              {user.lastSignIn ? format(new Date(user.lastSignIn), "MMM d, HH:mm") : "Never"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Entries ({user.entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.entries.length > 0 ? (
            <div className="space-y-2">
              {user.entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{entry.title}</p>
                    <p className="text-xs text-zinc-500">{entry.date} &middot; Score: {entry.productivity_score ?? "—"}/10</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    entry.status === "done"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : entry.status === "in-progress"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    {entry.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-zinc-400">No entries yet</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tasks ({user.tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.tasks.length > 0 ? (
            <div className="space-y-2">
              {user.tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{task.title}</p>
                    <p className="text-xs text-zinc-500">
                      Priority: {task.priority}
                      {task.due_date && ` · Due: ${task.due_date}`}
                      {task.completed_at && ` · Completed: ${format(new Date(task.completed_at), "MMM d")}`}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    task.status === "done"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : task.status === "in-progress"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}>
                    {task.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-zinc-400">No tasks yet</p>
          )}
        </CardContent>
      </Card>

      {/* Pages & Boards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pages ({user.pages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {user.pages.length > 0 ? (
              <div className="space-y-2">
                {user.pages.map((page) => (
                  <div key={page.id} className="rounded-lg border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{page.title || "Untitled"}</p>
                    <p className="text-xs text-zinc-500">
                      Updated: {format(new Date(page.updated_at), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-zinc-400">No pages yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Boards ({user.boards.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {user.boards.length > 0 ? (
              <div className="space-y-2">
                {user.boards.map((board) => (
                  <div key={board.id} className="rounded-lg border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{board.name}</p>
                    <p className="text-xs text-zinc-500">
                      Created: {format(new Date(board.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-zinc-400">No boards yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reminders */}
      <Card>
        <CardHeader>
          <CardTitle>Reminders ({user.reminders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {user.reminders.length > 0 ? (
            <div className="space-y-2">
              {user.reminders.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{r.title}</p>
                    <p className="text-xs text-zinc-500">
                      {format(new Date(r.reminder_time), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    r.is_completed
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  }`}>
                    {r.is_completed ? "Done" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-zinc-400">No reminders yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
