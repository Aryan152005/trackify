"use client";

import { useState } from "react";
import {
  Bell,
  ClipboardList,
  Clock,
  FileText,
  MessageSquare,
  AtSign,
  Megaphone,
  Check,
  Trash2,
  Send as SendIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { Notification, NotificationType } from "@/lib/types/notification";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BroadcastThreadPanel } from "@/components/notifications/broadcast-thread-panel";

const typeIcons: Record<NotificationType, React.ReactNode> = {
  mention: <AtSign className="h-5 w-5 text-purple-500" />,
  assignment: <ClipboardList className="h-5 w-5 text-indigo-500" />,
  reminder: <Clock className="h-5 w-5 text-orange-500" />,
  request: <FileText className="h-5 w-5 text-amber-500" />,
  nudge: <Megaphone className="h-5 w-5 text-pink-500" />,
  comment: <MessageSquare className="h-5 w-5 text-sky-500" />,
  broadcast: <SendIcon className="h-5 w-5 text-emerald-500" />,
};

/**
 * Left-accent colour on UNREAD rows so the type is scannable at a glance.
 * Mentions + assignments use stronger colours so they stand out even in
 * a long list; low-priority types get neutral indigo.
 */
const unreadAccent: Record<NotificationType, string> = {
  mention: "border-l-purple-500 bg-purple-50/60 dark:bg-purple-950/20",
  assignment: "border-l-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20",
  reminder: "border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/15",
  request: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/15",
  comment: "border-l-sky-500 bg-sky-50/40 dark:bg-sky-950/15",
  nudge: "border-l-pink-500 bg-pink-50/40 dark:bg-pink-950/15",
  broadcast: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/15",
};

interface NotificationListProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

export function NotificationList({
  notifications,
  onMarkRead,
  onDelete,
}: NotificationListProps) {
  // Broadcast rows can open an inline thread (reactions + comments). Keep
  // it collapsible so the notifications page doesn't blow up vertically
  // when a user has 10+ broadcasts.
  const [expandedBroadcast, setExpandedBroadcast] = useState<string | null>(null);
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-zinc-900">
        <Bell className="mb-3 h-10 w-10 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No notifications
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          You are all caught up!
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white overflow-hidden dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      <AnimatePresence initial={false}>
        {notifications.map((n) => {
          const isBroadcast = n.type === "broadcast" && n.entity_id;
          const threadOpen = isBroadcast && expandedBroadcast === n.entity_id;
          return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition sm:gap-4 sm:px-5 sm:py-4",
                !n.is_read && "border-l-4",
                !n.is_read && (unreadAccent[n.type] ?? "border-l-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20")
              )}
            >
              <div className="mt-0.5 shrink-0">
                {typeIcons[n.type] ?? <Bell className="h-5 w-5 text-zinc-500" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                      !n.is_read
                        ? "bg-white/60 text-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300"
                        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                    )}
                  >
                    {n.type}
                  </span>
                  <p
                    className={cn(
                      "min-w-0 text-sm leading-snug",
                      n.is_read
                        ? "text-zinc-600 dark:text-zinc-400"
                        : "font-semibold text-zinc-900 dark:text-zinc-50"
                    )}
                  >
                    {n.title}
                  </p>
                </div>
                {n.body && (
                  <p className="mt-1 text-sm text-zinc-500 line-clamp-2 dark:text-zinc-400">
                    {n.body}
                  </p>
                )}
                <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                {!n.is_read && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    title="Mark as read"
                    aria-label="Mark as read"
                    onClick={() => onMarkRead(n.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400"
                  title="Delete"
                  aria-label="Delete notification"
                  onClick={() => onDelete(n.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Broadcast extras — inline reactions + comments thread.
                Only rendered for type='broadcast' rows; clicking the
                row (or the "View thread" button) expands it inline. */}
            {isBroadcast && n.entity_id && (
              <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-[11px] font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  onClick={() => {
                    setExpandedBroadcast(threadOpen ? null : (n.entity_id as string));
                    if (!n.is_read) onMarkRead(n.id);
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" />
                    {threadOpen ? "Hide" : "React or reply"}
                  </span>
                  <span className="text-zinc-400">{threadOpen ? "▴" : "▾"}</span>
                </button>
                {threadOpen && (
                  <div className="mt-2">
                    <BroadcastThreadPanel broadcastId={n.entity_id} />
                  </div>
                )}
              </div>
            )}
          </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
