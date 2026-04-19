import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { getPersonalReminders } from "@/lib/personal/actions";
import { redirect } from "next/navigation";
import { isPast, parseISO } from "date-fns";
import { formatIST } from "@/lib/utils/datetime";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Bell, Lock } from "lucide-react";

export default async function PersonalRemindersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="My Reminders"
          description="Please select or create a workspace first."
        />
      </div>
    );
  }

  const reminders = await getPersonalReminders(workspaceId);
  const upcoming = (reminders ?? []).filter((r) => !r.is_completed && !isPast(parseISO(r.reminder_time)));
  const past = (reminders ?? []).filter((r) => r.is_completed || isPast(parseISO(r.reminder_time)));

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Reminders"
        description="Private reminders — fire only for you"
        actions={<Lock className="h-5 w-5 text-amber-500" />}
      />

      {upcoming.length === 0 && past.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">No private reminders yet</h3>
            <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Open any reminder and use the lock icon to mark it private. It will appear here and only notify you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming ({upcoming.length})</CardTitle>
                <CardDescription>Shown in IST</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcoming.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">{r.title}</h3>
                          <Lock className="h-3 w-3 shrink-0 text-amber-500" />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatIST(r.reminder_time)} IST
                          {r.is_recurring && ` · recurring`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past ({past.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {past.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 opacity-60 dark:border-zinc-800 dark:bg-zinc-800"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">{r.title}</h3>
                          <Lock className="h-3 w-3 shrink-0 text-amber-500" />
                        </div>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {formatIST(r.reminder_time)} IST
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
