"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Send,
  Pencil,
  Trash2,
  CheckCircle2,
  Reply,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { useRealtime } from "@/lib/realtime/use-realtime";
import {
  getComments,
  addComment,
  updateComment,
  deleteComment,
  resolveComment,
} from "@/lib/collaboration/comments-actions";
import { MentionAutocomplete } from "./mention-autocomplete";
import type { CommentWithAuthor, CommentThread } from "@/lib/types/collaboration";

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

/** Render @[Name](userId) as styled inline mention spans */
function renderContent(content: string) {
  const regex = /@\[([^\]]+)\]\([^)]+\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Text before the match
    if (match.index > lastIndex) {
      parts.push(
        <span key={"t" + lastIndex}>{content.slice(lastIndex, match.index)}</span>
      );
    }
    // The mention
    parts.push(
      <span
        key={"m" + match.index}
        className="rounded bg-indigo-100 px-1 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
      >
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < content.length) {
    parts.push(<span key={"t" + lastIndex}>{content.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : content;
}

// ---------------------------------------------------------------------------
// UserAvatar
// ---------------------------------------------------------------------------

function UserAvatar({
  name,
  avatarUrl,
  userId,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  userId: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  const text = size === "sm" ? "text-[10px]" : "text-xs";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(dim, "rounded-full object-cover")}
      />
    );
  }

  return (
    <div
      className={cn(
        dim,
        text,
        "flex items-center justify-center rounded-full font-semibold text-white",
        getColor(userId)
      )}
    >
      {(name.charAt(0) || "?").toUpperCase()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentForm
// ---------------------------------------------------------------------------

function CommentForm({
  onSubmit,
  placeholder = "Write a comment...",
  autoFocus = false,
  onCancel,
  initialValue = "",
  submitLabel = "Send",
  workspaceId,
}: {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  initialValue?: string;
  submitLabel?: string;
  workspaceId: string;
}) {
  const [content, setContent] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setContent(value);

    const cursorPos = e.target.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const handleMentionSelect = (user: { id: string; name: string }) => {
    if (!textareaRef.current) return;

    const cursorPos = textareaRef.current.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    const atIdx = textBefore.lastIndexOf("@");

    const mentionText = "@[" + user.name + "](" + user.id + ")";
    const newContent =
      textBefore.slice(0, atIdx) + mentionText + " " + textAfter;

    setContent(newContent);
    setMentionQuery(null);

    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = atIdx + mentionText.length + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && mentionQuery === null) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative">
      {mentionQuery !== null && (
        <MentionAutocomplete
          query={mentionQuery}
          workspaceId={workspaceId}
          onSelect={handleMentionSelect}
        />
      )}
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
        />
        <div className="flex flex-col gap-1">
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={submitting || !content.trim()}
            title={submitLabel}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          {onCancel && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onCancel}
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
        Ctrl+Enter to send. Type @ to mention someone.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SingleComment
// ---------------------------------------------------------------------------

function SingleComment({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  isReply = false,
  workspaceId,
}: {
  comment: CommentWithAuthor;
  currentUserId: string;
  onReply: (parentId: string) => void;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  onResolve: (commentId: string) => void;
  isReply?: boolean;
  workspaceId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const isOwner = comment.user_id === currentUserId;
  const profileName = comment.user_profile?.name ?? "Unknown";
  const profileAvatar = comment.user_profile?.avatar_url ?? null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
        isReply && "ml-8 border-l-2 border-zinc-200 pl-4 dark:border-zinc-700",
        comment.resolved && "opacity-60"
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="flex items-start gap-2.5">
        <UserAvatar
          name={profileName}
          avatarUrl={profileAvatar}
          userId={comment.user_id}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {profileName}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {formatRelativeTime(comment.created_at)}
            </span>
            {comment.updated_at !== comment.created_at && (
              <span className="text-xs italic text-zinc-400 dark:text-zinc-500">
                (edited)
              </span>
            )}
            {comment.resolved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Resolved
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-1.5">
              <CommentForm
                initialValue={comment.content}
                submitLabel="Save"
                autoFocus
                workspaceId={workspaceId}
                onSubmit={async (content) => {
                  await onEdit(comment.id, content);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : (
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {renderContent(comment.content)}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <AnimatePresence>
          {showActions && !editing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-0.5"
            >
              {!isReply && !comment.resolved && (
                <button
                  onClick={() => onResolve(comment.id)}
                  title="Resolve thread"
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-emerald-600 dark:hover:bg-zinc-700 dark:hover:text-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => onReply(comment.id)}
                title="Reply"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-indigo-600 dark:hover:bg-zinc-700 dark:hover:text-indigo-400"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              {isOwner && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    title="Edit"
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(comment.id)}
                    title="Delete"
                    className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CommentSection (main export)
// ---------------------------------------------------------------------------

interface CommentSectionProps {
  entityType: string;
  entityId: string;
}

export function CommentSection({ entityType, entityId }: CommentSectionProps) {
  const workspaceId = useWorkspaceId();
  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const data = await getComments(workspaceId, entityType, entityId);
      setThreads(
        (data ?? []).map((c: Record<string, unknown>) => {
          const comment = c as unknown as CommentWithAuthor;
          const profile = (c.user_profiles ?? c.user_profile ?? { name: "Unknown", avatar_url: null }) as { name: string; avatar_url: string | null };
          return {
            ...comment,
            user_profile: profile,
            replies: [] as CommentThread[],
          } satisfies CommentThread;
        })
      );
    } catch {
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, entityType, entityId]);

  const fetchReplies = useCallback(
    async (parentCommentId: string): Promise<CommentWithAuthor[]> => {
      if (!workspaceId) return [];
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("comments")
          .select(
            "*, user_profiles!comments_user_id_fkey(name, avatar_url)"
          )
          .eq("parent_comment_id", parentCommentId)
          .order("created_at", { ascending: true });

        return (data ?? []).map((c: Record<string, unknown>) => {
          const comment = c as unknown as CommentWithAuthor;
          const profile = (c.user_profiles ?? c.user_profile ?? { name: "Unknown", avatar_url: null }) as { name: string; avatar_url: string | null };
          return { ...comment, user_profile: profile };
        });
      } catch {
        return [];
      }
    },
    [workspaceId]
  );

  // Get current user
  useEffect(() => {
    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    })();
  }, []);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Load replies once threads are fetched
  useEffect(() => {
    if (threads.length === 0) return;
    let cancelled = false;

    (async () => {
      const updated = await Promise.all(
        threads.map(async (thread) => {
          if (thread.replies && thread.replies.length > 0) return thread;
          const replies = await fetchReplies(thread.id);
          return { ...thread, replies };
        })
      );

      if (!cancelled) {
        const hasNew = updated.some(
          (t, i) => t.replies.length !== threads[i].replies.length
        );
        if (hasNew) setThreads(updated);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads.length, fetchReplies]);

  // Real-time subscription
  useRealtime({
    table: "comments",
    filter: "entity_type=eq." + entityType,
    enabled: !!workspaceId,
    onInsert: () => fetchComments(),
    onUpdate: () => fetchComments(),
    onDelete: () => fetchComments(),
  });

  const handleAddComment = async (
    content: string,
    parentCommentId?: string
  ) => {
    if (!workspaceId) return;
    await addComment(
      workspaceId,
      entityType,
      entityId,
      content,
      parentCommentId
    );
    setReplyTo(null);
    await fetchComments();
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  };

  const handleEdit = async (commentId: string, content: string) => {
    await updateComment(commentId, content);
    await fetchComments();
    toast.success("Comment updated");
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      await fetchComments();
      toast.success("Comment deleted");
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleResolve = async (commentId: string) => {
    if (!workspaceId) return;
    try {
      await resolveComment(commentId, workspaceId);
      await fetchComments();
      toast.success("Thread resolved");
    } catch {
      toast.error("Failed to resolve thread");
    }
  };

  const totalCount = threads.reduce(
    (acc, t) => acc + 1 + (t.replies?.length ?? 0),
    0
  );

  if (!workspaceId) return null;

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <MessageSquare className="h-4 w-4 text-zinc-500" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Comments
        </h3>
        {totalCount > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-100 px-1.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {totalCount}
          </span>
        )}
      </div>

      {/* Comments list */}
      <div
        ref={scrollRef}
        className="max-h-96 flex-1 overflow-y-auto px-2 py-2"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="mb-2 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No comments yet. Be the first!
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {threads.map((thread) => (
              <div key={thread.id} className="mb-1">
                <SingleComment
                  comment={thread}
                  currentUserId={currentUserId}
                  onReply={(parentId) => setReplyTo(parentId)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onResolve={handleResolve}
                  workspaceId={workspaceId}
                />

                {/* Replies */}
                <AnimatePresence>
                  {thread.replies?.map((reply) => (
                    <SingleComment
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      isReply
                      onReply={(parentId) => setReplyTo(parentId)}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onResolve={handleResolve}
                      workspaceId={workspaceId}
                    />
                  ))}
                </AnimatePresence>

                {/* Reply form inline */}
                <AnimatePresence>
                  {replyTo === thread.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-8 mt-1 overflow-hidden border-l-2 border-indigo-300 pl-4 dark:border-indigo-700"
                    >
                      <CommentForm
                        placeholder="Write a reply..."
                        autoFocus
                        workspaceId={workspaceId}
                        onSubmit={(content) =>
                          handleAddComment(content, thread.id)
                        }
                        onCancel={() => setReplyTo(null)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* New comment form */}
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <CommentForm
          workspaceId={workspaceId}
          onSubmit={(content) => handleAddComment(content)}
          placeholder="Write a comment..."
        />
      </div>
    </div>
  );
}
