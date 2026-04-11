import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import Image from "next/image";

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: entry } = await supabase
    .from("work_entries")
    .select(
      `
      id,
      date,
      title,
      description,
      work_done,
      learning,
      next_day_plan,
      mood,
      productivity_score,
      status,
      created_at,
      entry_tags ( tag_id, tags ( id, name, color ) )
    `
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!entry) notFound();

  // Fetch attachments (photos)
  const { data: attachments } = await supabase
    .from("attachments")
    .select("id, file_url, type")
    .eq("entry_id", id)
    .eq("type", "image");

  const tags = (entry.entry_tags as unknown as { tags: { name: string; color: string } | null }[] | null)?.map(
    (et) => et.tags
  ).filter(Boolean) as { name: string; color: string }[] | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/entries"
          className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          ← Back to entries
        </Link>
      </div>

      <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {format(new Date(entry.date), "MMMM d, yyyy")}
          </span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {entry.status}
          </span>
          {entry.productivity_score != null && (
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Score: {entry.productivity_score}/10
            </span>
          )}
        </div>

        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {entry.title}
        </h1>

        {tags && tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
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
          </div>
        )}

        {entry.description && (
          <div className="mt-4">
            <h2 className="text-sm font-medium uppercase text-zinc-500 dark:text-zinc-400">
              Description
            </h2>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">{entry.description}</p>
          </div>
        )}

        {entry.work_done && (
          <div className="mt-4">
            <h2 className="text-sm font-medium uppercase text-zinc-500 dark:text-zinc-400">
              Work done
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {entry.work_done}
            </p>
          </div>
        )}

        {entry.learning && (
          <div className="mt-4">
            <h2 className="text-sm font-medium uppercase text-zinc-500 dark:text-zinc-400">
              Learning
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {entry.learning}
            </p>
          </div>
        )}

        {entry.next_day_plan && (
          <div className="mt-4">
            <h2 className="text-sm font-medium uppercase text-zinc-500 dark:text-zinc-400">
              Next day plan
            </h2>
            <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              {entry.next_day_plan}
            </p>
          </div>
        )}

        {entry.mood && (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            Mood: {entry.mood}
          </p>
        )}

        {/* Photo Proof */}
        {attachments && attachments.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-medium uppercase text-zinc-500 dark:text-zinc-400">
              Photo Proof ({attachments.length})
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {attachments.map((att) => (
                <a
                  key={att.id}
                  href={att.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                >
                  <Image
                    src={att.file_url}
                    alt="Work proof"
                    fill
                    className="object-cover transition group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
