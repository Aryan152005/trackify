"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Check, Filter, FileText, ClipboardList, Columns, BookOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import {
  getMentions,
  markMentionSeen,
  markAllMentionsSeen,
} from "@/lib/collaboration/mentions-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ENTITY_TYPES = [
  { value: "", label: "All" },
  { value: "page", label: "Notes" },
  { value: "task", label: "Tasks" },
  { value: "board", label: "Boards" },
  { value: "entry", label: "Entries" },
];

const ENTITY_ICONS: Record<string, React.ReactNode> = {
  page: <FileText className="h-4 w-4 text-blue-500" />,
  task: <ClipboardList className="h-4 w-4 text-indigo-500" />,
  board: <Columns className="h-4 w-4 text-emerald-500" />,
  entry: <BookOpen className="h-4 w-4 text-amber-500" />,
};

const ENTITY_ROUTES: Record<string, string> = {
  page: "/notes",
  task: "/tasks",
  board: "/boards",
  entry: "/entries",
};

const ENTITY_LABELS: Record<string, string> = {
  page: "Note",
  task: "Task",
  board: "Board",
  entry: "Entry",
};

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-violet-500",
];

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

interface MentionRow {
  id: string;
  entity_type: string;
  entity_id: string;
  mentioned_by: string;
  seen: boolean;
  created_at: string;
  mentioned_by_profile?: { name: string; avatar_url: string | null } | null;
  comment?: { content: string; created_at: string } | null;
}

/** Strip mention markup for display */
function stripMentions(content: string): string {
  return content.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

export default function MentionsPage() {
  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Get current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const fetchMentions = useCallback(async () => {
    if (!userId || !workspaceId) return;
    setLoading(true);
    try {
      const data = await getMentions(workspaceId, userId);
      setMentions((data as MentionRow[]) ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userId, workspaceId]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  const filteredMentions = filter
    ? mentions.filter((m) => m.entity_type === filter)
    : mentions;

  // Group by entity
  const grouped = new Map<string, MentionRow[]>();
  for (const m of filteredMentions) {
    const key = `${m.entity_type}:${m.entity_id}`;
    const existing = grouped.get(key) ?? [];
    existing.push(m);
    grouped.set(key, existing);
  }

  async function handleMarkRead(mentionId: string) {
    setMentions((prev) =>
      prev.map((m) => (m.id === mentionId ? { ...m, seen: true } : m))
    );
    await markMentionSeen(mentionId);
  }

  async function handleMarkAllRead() {
    if (!workspaceId || !userId) return;
    startTransition(async () => {
      setMentions((prev) => prev.map((m) => ({ ...m, seen: true })));
      await markAllMentionsSeen(workspaceId, userId);
    });
  }

  function navigateToEntity(entityType: string, entityId: string) {
    const route = ENTITY_ROUTES[entityType];
    if (route) {
      router.push(`${route}/${entityId}`);
    }
  }

  const unreadCount = mentions.filter((m) => !m.seen).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Mentions
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            All the places where you have been @mentioned
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isPending}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Mark all read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-zinc-400" />
        <div className="flex gap-1">
          {ENTITY_TYPES.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setFilter(type.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                filter === type.value
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        </div>
      ) : filteredMentions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-sm text-zinc-500 dark:text-zinc-400">
          <AtSign className="mb-3 h-10 w-10 opacity-30" />
          <p>No mentions found</p>
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="mt-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Clear filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([key, groupMentions]) => {
            const first = groupMentions[0];
            return (
              <div
                key={key}
                className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* Entity header */}
                <button
                  type="button"
                  onClick={() =>
                    navigateToEntity(first.entity_type, first.entity_id)
                  }
                  className="flex w-full items-center gap-3 border-b border-zinc-100 px-4 py-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  {ENTITY_ICONS[first.entity_type] ?? (
                    <AtSign className="h-4 w-4 text-zinc-400" />
                  )}
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {ENTITY_LABELS[first.entity_type] ?? "Item"}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {groupMentions.length} mention
                    {groupMentions.length !== 1 ? "s" : ""}
                  </span>
                </button>

                {/* Mentions in this entity */}
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {groupMentions.map((mention) => (
                    <div
                      key={mention.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3",
                        !mention.seen &&
                          "border-l-2 border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                      )}
                    >
                      {/* Avatar */}
                      <div className="mt-0.5 shrink-0">
                        {mention.mentioned_by_profile?.avatar_url ? (
                          <img
                            src={mention.mentioned_by_profile.avatar_url}
                            alt={mention.mentioned_by_profile.name}
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white",
                              AVATAR_COLORS[
                                hashId(mention.mentioned_by) %
                                  AVATAR_COLORS.length
                              ]
                            )}
                          >
                            {(
                              mention.mentioned_by_profile?.name?.charAt(0) ??
                              "?"
                            ).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-900 dark:text-zinc-100">
                          <span className="font-medium">
                            {mention.mentioned_by_profile?.name ?? "Someone"}
                          </span>{" "}
                          mentioned you
                        </p>
                        {mention.comment?.content && (
                          <p className="mt-1 line-clamp-2 rounded bg-zinc-50 px-2 py-1.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            {stripMentions(mention.comment.content)}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                          {formatDistanceToNow(new Date(mention.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>

                      {/* Mark read */}
                      {!mention.seen && (
                        <button
                          type="button"
                          onClick={() => handleMarkRead(mention.id)}
                          className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                          title="Mark as read"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
