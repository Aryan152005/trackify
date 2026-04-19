import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { parseISO, isPast } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PushSettings } from "@/components/push/push-settings";
import { Plus, Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { RemindersList } from "@/components/reminders/reminders-list";

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
        description="Never miss a thing — set it, forget it, get notified (IST)"
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

      {upcoming.length === 0 && past.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No reminders yet"
          description="Set your first reminder so nothing slips through the cracks."
          actionLabel="New Reminder"
          actionHref="/reminders/new"
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Upcoming ({upcoming.length})
              </CardTitle>
              <CardDescription>
                Reminders scheduled for the future · shown in IST
              </CardDescription>
            </CardHeader>
            <CardContent>
              {upcoming.length > 0 ? (
                <RemindersList reminders={upcoming} />
              ) : (
                <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">No upcoming reminders</p>
              )}
            </CardContent>
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past Reminders ({past.length})</CardTitle>
                <CardDescription>Completed or expired reminders</CardDescription>
              </CardHeader>
              <CardContent>
                <RemindersList reminders={past} readOnly />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
