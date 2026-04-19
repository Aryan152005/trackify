"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Send, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getBroadcastThread,
  toggleBroadcastReaction,
  addBroadcastComment,
  deleteBroadcastComment,
  type BroadcastThread,
  type BroadcastComment,
} from "@/lib/admin/push-actions";

// Curated emoji set so the reaction bar stays compact. If a user already
// reacted with a custom emoji server-side it's still shown — we render
// WHATEVER comes back from getBroadcastThread, so custom ones are
// additive, not locked-out.
const QUICK_EMOJI = ["👍", "❤️", "🎉", "🙏", "🔥", "🤔"];

interface Props {
  broadcastId: string;
}

export function BroadcastThreadPanel({ broadcastId }: Props) {
  const [thread, setThread] = useState<BroadcastThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, startPost] = useTransition();
  const [reactingTo, setReactingTo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const t = await getBroadcastThread(broadcastId);
      setThread(t);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load thread");
    } finally {
      setLoading(false);
    }
  }, [broadcastId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Merge server reactions with QUICK_EMOJI so even brand-new broadcasts
  // show the shortcut row (zero counts, just clickable).
  const reactionChips = (() => {
    if (!thread) return [] as { emoji: string; count: number; me: boolean }[];
    const seen = new Set(thread.reactions.map((r) => r.emoji));
    const extras = QUICK_EMOJI.filter((e) => !seen.has(e)).map((emoji) => ({
      emoji,
      count: 0,
      me: false,
    }));
    return [...thread.reactions, ...extras];
  })();

  async function react(emoji: string) {
    if (!thread || reactingTo) return;
    setReactingTo(emoji);
    // Optimistic toggle.
    setThread((prev) => {
      if (!prev) return prev;
      const cur = prev.reactions.find((r) => r.emoji === emoji);
      if (cur) {
        const nextCount = cur.me ? cur.count - 1 : cur.count + 1;
        if (nextCount <= 0) {
          return {
            ...prev,
            reactions: prev.reactions.filter((r) => r.emoji !== emoji),
          };
        }
        return {
          ...prev,
          reactions: prev.reactions.map((r) =>
            r.emoji === emoji ? { ...r, count: nextCount, me: !cur.me } : r,
          ),
        };
      }
      // Brand new reaction.
      return {
        ...prev,
        reactions: [...prev.reactions, { emoji, count: 1, me: true }],
      };
    });
    try {
      await toggleBroadcastReaction(broadcastId, emoji);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't react");
      // Best-effort rollback: refetch.
      void load();
    } finally {
      setReactingTo(null);
    }
  }

  function postComment() {
    const body = draft.trim();
    if (!body || !thread) return;
    startPost(async () => {
      try {
        const c = await addBroadcastComment(broadcastId, body);
        setThread((prev) =>
          prev ? { ...prev, comments: [...prev.comments, c] } : prev,
        );
        setDraft("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't post");
      }
    });
  }

  async function removeComment(c: BroadcastComment) {
    if (!thread) return;
    const prevComments = thread.comments;
    setThread({
      ...thread,
      comments: prevComments.filter((x) => x.id !== c.id),
    });
    try {
      await deleteBroadcastComment(c.id);
    } catch (err) {
      setThread({ ...thread, comments: prevComments });
      toast.error(err instanceof Error ? err.message : "Couldn't delete");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
      </div>
    );
  }
  if (!thread) {
    return (
      <p className="py-2 text-xs text-zinc-400 dark:text-zinc-500">
        This broadcast is no longer available.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Reactions */}
      <div className="flex flex-wrap gap-1.5">
        {reactionChips.map((r) => (
          <button
            key={r.emoji}
            type="button"
            onClick={() => react(r.emoji)}
            disabled={reactingTo !== null}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition",
              r.me
                ? "border-indigo-400 bg-indigo-100 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
              reactingTo === r.emoji && "opacity-50",
            )}
          >
            <span>{r.emoji}</span>
            {r.count > 0 && <span className="tabular-nums">{r.count}</span>}
          </button>
        ))}
      </div>

      {/* Comments */}
      {thread.comments.length > 0 && (
        <ul className="space-y-1.5">
          {thread.comments.map((c) => (
            <li
              key={c.id}
              className="group flex items-start gap-2 rounded-md bg-white px-2.5 py-1.5 dark:bg-zinc-900"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                {c.author_name.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {c.author_name}
                  </span>
                  <span className="text-zinc-400">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300">
                  {c.body}
                </p>
              </div>
              {c.can_delete && (
                <button
                  type="button"
                  onClick={() => removeComment(c)}
                  title="Delete"
                  className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Compose */}
      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a reply…"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              postComment();
            }
          }}
          className="min-h-[36px] flex-1 resize-none rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          maxLength={2000}
        />
        <Button
          size="sm"
          onClick={postComment}
          disabled={!draft.trim() || posting}
          className="h-9 shrink-0 gap-1.5"
        >
          {posting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Reply
        </Button>
      </div>
    </div>
  );
}
