import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO, isPast } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PushSettings } from "@/components/push/push-settings";
import { Plus, Bell } from "lucide-react";

export default async function RemindersPage() {
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

  const remindersQuery = supabase
    .from("reminders")
    .select("*")
    .eq("user_id", user.id)
    .order("reminder_time", { ascending: true });

  const { data: reminders } = workspaceId
    ? await remindersQuery.eq("workspace_id", workspaceId)
    : await remindersQuery;

  const upcoming = reminders?.filter((r) => !r.is_completed && !isPast(parseISO(r.reminder_time))) || [];
  const past = reminders?.filter((r) => r.is_completed || isPast(parseISO(r.reminder_time))) || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reminders"
        description="Never miss a thing — set it, forget it, get notified"
        actions={
          <Link href="/reminders/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Reminder
            </Button>
          </Link>
        }
      />

      <PushSettings publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""} />

      {/* Upcoming Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Upcoming ({upcoming.length})
          </CardTitle>
          <CardDescription>Reminders scheduled for the future</CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((reminder) => {
                const reminderDate = parseISO(reminder.reminder_time);
                return (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-800"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{reminder.title}</h3>
                      {reminder.description && (
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{reminder.description}</p>
                      )}
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {format(reminderDate, "MMMM d, yyyy 'at' h:mm a")}
                        {reminder.is_recurring && ` · ${reminder.recurrence_pattern}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">No upcoming reminders</p>
          )}
        </CardContent>
      </Card>

      {/* Past Reminders */}
      {past.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Past Reminders ({past.length})</CardTitle>
            <CardDescription>Completed or expired reminders</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {past.map((reminder) => {
                const reminderDate = parseISO(reminder.reminder_time);
                return (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 opacity-60 dark:border-zinc-800 dark:bg-zinc-800"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{reminder.title}</h3>
                      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {format(reminderDate, "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
