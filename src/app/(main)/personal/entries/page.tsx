import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import { getPersonalEntries } from "@/lib/personal/actions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BookOpen, Lock } from "lucide-react";

export default async function PersonalEntriesPage() {
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
          title="My Entries"
          description="Please select or create a workspace first."
        />
      </div>
    );
  }

  const entries = await getPersonalEntries(workspaceId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Entries"
        description="Private work entries — only visible to you"
        actions={<Lock className="h-5 w-5 text-amber-500" />}
      />

      {entries && entries.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{entries.length} private {entries.length === 1 ? "entry" : "entries"}</CardTitle>
            <CardDescription>Most recent first</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entries.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/entries/${entry.id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">{entry.title}</h3>
                      <Lock className="h-3 w-3 shrink-0 text-amber-500" />
                    </div>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {format(parseISO(entry.date), "MMM d, yyyy")} · {entry.status}
                      {entry.productivity_score != null && ` · ★ ${entry.productivity_score}/10`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600" />
            <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">No private entries yet</h3>
            <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Open any entry and use the lock icon to mark it private. It will then appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
