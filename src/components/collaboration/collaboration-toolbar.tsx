"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { MessageSquare, Share2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PresenceAvatars } from "./presence-avatars";
import { ShareDialog } from "./share-dialog";
import { CommentSection } from "./comment-section";
import { CursorOverlay } from "./cursor-overlay";
import { useWorkspaceId } from "@/lib/workspace/hooks";
import { getCommentCount } from "@/lib/collaboration/comments-actions";
import { cn } from "@/lib/utils";

interface CollaborationToolbarProps {
  entityType: string;
  entityId: string;
  entityTitle: string;
  showComments?: boolean;
  showShare?: boolean;
  showPresence?: boolean;
  showCursors?: boolean;
}

export function CollaborationToolbar({
  entityType,
  entityId,
  entityTitle,
  showComments = true,
  showShare = true,
  showPresence = true,
  showCursors = false,
}: CollaborationToolbarProps) {
  const workspaceId = useWorkspaceId();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Fetch comment count
  const fetchCount = useCallback(async () => {
    if (!workspaceId || !showComments) return;
    try {
      const count = await getCommentCount(workspaceId, entityType, entityId);
      setCommentCount(count);
    } catch {
      // silently fail
    }
  }, [workspaceId, entityType, entityId, showComments]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  // Re-fetch count when comment panel closes (user may have added comments)
  useEffect(() => {
    if (!commentsOpen) fetchCount();
  }, [commentsOpen, fetchCount]);

  return (
    <>
      {/* Toolbar bar */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* Left: Presence */}
        <div className="flex items-center gap-2">
          {showPresence && (
            <PresenceAvatars entityType={entityType} entityId={entityId} />
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {showShare && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShareOpen(true)}
              className="gap-1.5"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          )}

          {showComments && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCommentsOpen((prev) => !prev)}
              className="relative gap-1.5"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Comments</span>
              {commentCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                  {commentCount > 99 ? "99+" : commentCount}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Share dialog */}
      {showShare && (
        <ShareDialog
          entityType={entityType}
          entityId={entityId}
          entityTitle={entityTitle}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Comment slide-over panel */}
      <AnimatePresence>
        {commentsOpen && (
          <>
            {/* Backdrop (mobile) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCommentsOpen(false)}
              className="fixed inset-0 z-40 bg-black/20 lg:hidden"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Panel close button */}
              <div className="absolute right-3 top-3 z-10">
                <button
                  type="button"
                  onClick={() => setCommentsOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <CommentSection entityType={entityType} entityId={entityId} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cursor overlay */}
      {showCursors && (
        <CursorOverlay entityType={entityType} entityId={entityId} />
      )}
    </>
  );
}
