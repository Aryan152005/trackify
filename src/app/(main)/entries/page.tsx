import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SharedSection } from "@/components/collaboration/shared-section";
import { EntriesList } from "@/components/entries/entries-list";

export default async function EntriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspaceId = await getActiveWorkspaceId();

  const query = supabase
    .from("work_entries")
    .select(`
      id,
      date,
      title,
      status,
      productivity_score,
      entry_tags ( tag_id, tags ( id, name, color ) )
    `)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(500);

  const { data: raw } = workspaceId ? await query.eq("workspace_id", workspaceId) : await query;

  const rows = (raw ?? []).map((entry) => {
    const tags = (entry.entry_tags as unknown as { tags: { name: string; color: string } | null }[] | null)
      ?.map((et) => et.tags)
      .filter(Boolean) as { name: string; color: string }[] | undefined;
    return {
      id: entry.id as string,
      date: entry.date as string,
      title: (entry.title as string) ?? "Untitled",
      status: (entry.status as string) ?? "done",
      productivity_score: (entry.productivity_score as number | null) ?? null,
      tags: tags ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Work entries</h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Your daily work log — track what you did, how it went, and keep building momentum
          </p>
        </div>
        <Link
          href="/entries/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Add entry
        </Link>
      </div>

      {rows.length > 0 ? (
        <EntriesList rows={rows} />
      ) : (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No entries yet"
          description="Start logging your daily work to build momentum and see your progress."
          actionLabel="Add entry"
          actionHref="/entries/new"
        />
      )}

      <SharedSection entityType="entry" />
    </div>
  );
}
