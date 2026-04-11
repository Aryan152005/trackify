import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/actions";
import Link from "next/link";
import { format } from "date-fns";

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
      description,
      status,
      productivity_score,
      created_at,
      entry_tags ( tag_id, tags ( id, name, color ) )
    `)
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(50);

  const { data: entries } = workspaceId
    ? await query.eq("workspace_id", workspaceId)
    : await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Work entries
          </h1>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            Your daily work log — track what you did, how it went, and keep building momentum
          </p>
        </div>
        <Link
          href="/entries/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Add entry
        </Link>
      </div>

      {entries && entries.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                  Score
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
                  Tags
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {entries.map((entry) => {
                const tags = (entry.entry_tags as unknown as { tags: { name: string; color: string } | null }[] | null)?.map(
                  (et) => et.tags
                ).filter(Boolean) as { name: string; color: string }[] | undefined;
                return (
                  <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {format(new Date(entry.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/entries/${entry.id}`}
                        className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        {entry.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.status}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.productivity_score ?? "—"}/10
                    </td>
                    <td className="px-4 py-3">
                      {tags && tags.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {tags.map((t) => (
                            <span
                              key={t.name}
                              className="rounded-full px-2 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: `${t.color}20`,
                                color: t.color,
                              }}
                            >
                              {t.name}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-800/30">
          <p className="text-zinc-600 dark:text-zinc-400">No entries yet.</p>
          <Link
            href="/entries/new"
            className="mt-4 inline-block text-indigo-600 hover:underline dark:text-indigo-400"
          >
            Add your first entry
          </Link>
        </div>
      )}
    </div>
  );
}
