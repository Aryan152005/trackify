"use client";

import { useCallback, useEffect, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { motion, AnimatePresence } from "framer-motion";
import { AtSign, Check, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import {
  getMentions,
  getUnreadMentionCount,
  markMentionSeen,
  markAllMentionsSeen,
} from "@/lib/collaboration/mentions-actions";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-fuchsia-500",
  "bg-teal-500",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function getColor(id: string) {
  return AVATAR_COLORS[hashStr(id) % AVATAR_COLORS.length];
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(dateStr).toLocaleDateString();
}

/** Truncate comment content for display */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MentionItem {
  id: string;
  entity_type: string;
  entity_id: string;
  seen: boolean;
  created_at: string;
  mentioned_by_profile?: {
    name: string;
    avatar_url: string | null;
  };
  comment?: {
    content: string;
    created_at: string;
  } | null;
  mentioned_by: string;
}

// ---------------------------------------------------------------------------
// Entity route mapping
// ---------------------------------------------------------------------------

function getEntityRoute(entityType: string, entityId: string): string {
  switch (entityType) {
    case "page":
      return "/notes/" + entityId;
    case "task":
      return "/tasks?id=" + entityId;
    case "board":
      return "/boards/" + entityId;
    case "entry":
      return "/entries/" + entityId;
    default:
      return "/" + entityType + "s/" + entityId;
  }
}

// ---------------------------------------------------------------------------
// MentionsPopover
// ---------------------------------------------------------------------------

export function MentionsPopover() {
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Get current user
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  // Fetch unread count periodically
  const fetchUnreadCount = useCallback(async () => {
    if (!workspaceId || !currentUserId) return;
    try {
      const count = await getUnreadMentionCount(workspaceId, currentUserId);
      setUnreadCount(count);
    } catch {
      // Silently fail for badge count
    }
  }, [workspaceId, currentUserId]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch full mentions when opened
  const fetchMentions = useCallback(async () => {
    if (!workspaceId || !currentUserId) return;
    setLoading(true);
    try {
      const data = await getMentions(workspaceId, currentUserId);
      setMentions(data as MentionItem[]);
    } catch {
      toast.error("Failed to load mentions");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, currentUserId]);

  useEffect(() => {
    if (open) fetchMentions();
  }, [open, fetchMentions]);

  const handleMarkAllRead = async () => {
    if (!workspaceId || !currentUserId) return;
    try {
      await markAllMentionsSeen(workspaceId, currentUserId);
      setMentions((prev) => prev.map((m) => ({ ...m, seen: true })));
      setUnreadCount(0);
      toast.success("All mentions marked as read");
    } catch {
      toast.error("Failed to mark mentions as read");
    }
  };

  const handleClickMention = async (mention: MentionItem) => {
    if (!mention.seen) {
      try {
        await markMentionSeen(mention.id);
        setMentions((prev) =>
          prev.map((m) => (m.id === mention.id ? { ...m, seen: true } : m))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Best-effort
      }
    }

    // Navigate to entity
    const route = getEntityRoute(mention.entity_type, mention.entity_id);
    window.location.href = route;
    setOpen(false);
  };

  if (!workspaceId) return null;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="relative rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          title="Mentions"
        >
          <AtSign className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-indigo-600 px-1 text-[9px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-80 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Mentions
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
              >
                <Check className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
              </div>
            ) : mentions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AtSign className="mb-2 h-7 w-7 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No mentions yet
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {mentions.map((mention) => {
                  const authorName =
                    mention.mentioned_by_profile?.name ?? "Someone";
                  const authorAvatar =
                    mention.mentioned_by_profile?.avatar_url ?? null;
                  const commentText = mention.comment?.content
                    ? truncate(mention.comment.content, 80)
                    : "mentioned you";

                  return (
                    <motion.button
                      key={mention.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      onClick={() => handleClickMention(mention)}
                      className={cn(
                        "flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                        !mention.seen &&
                          "bg-indigo-50/50 dark:bg-indigo-900/10"
                      )}
                    >
                      {/* Avatar */}
                      {authorAvatar ? (
                        <img
                          src={authorAvatar}
                          alt={authorName}
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                            getColor(mention.mentioned_by)
                          )}
                        >
                          {(authorName.charAt(0) || "?").toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {authorName}
                          </span>
                          {!mention.seen && (
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                          {commentText}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                          <MessageSquare className="h-2.5 w-2.5" />
                          <span className="capitalize">
                            {mention.entity_type}
                          </span>
                          <span>&middot;</span>
                          <span>
                            {formatRelativeTime(mention.created_at)}
                          </span>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
